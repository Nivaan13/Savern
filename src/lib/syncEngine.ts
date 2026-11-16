import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  BaseEntity,
  EntityCollectionKey,
  SyncOperation,
  WorkspaceData,
} from '../types/finance.ts';
import { db, handleFirestoreError, OperationType } from './firebase.ts';
import {
  getSyncQueueForWorkspace,
  removeSyncOperations,
  setLastSyncTime,
  updateSyncOperationStatus,
} from './indexedDb.ts';
import { createDefaultPreferences } from './demoData.ts';

const FIRESTORE_COLLECTION_MAP: Record<EntityCollectionKey, string> = {
  userPreferences: 'preferences',
  accounts: 'accounts',
  transactions: 'transactions',
  budgets: 'budgets',
  savingsGoals: 'savings_goals',
  savingsContributions: 'savings_contributions',
  loans: 'loans',
  loanPayments: 'loan_payments',
  emiPlans: 'emi_plans',
  emiPayments: 'emi_payments',
  insurancePolicies: 'insurance_policies',
  medicalClaims: 'medical_claims',
  investments: 'investments',
  sipPlans: 'sip_plans',
  recurringTransactions: 'recurring_transactions',
  notifications: 'notifications',
};

function sanitizeForFirestore(
  entityType: EntityCollectionKey,
  data: Record<string, unknown>,
  uid: string,
  isNew: boolean
) {
  const clean: Record<string, unknown> = { ...data, userId: uid };
  // Enforce Firestore schema compatibility and server timestamps
  delete clean.appLockPinHash;
  if (entityType === 'transactions') {
    clean.tags = Array.isArray(clean.tags) ? clean.tags.slice(0, 10) : [];
  }
  if (isNew || !clean._firestoreCreated) {
    clean.createdAt = serverTimestamp();
  }
  delete clean._firestoreCreated;
  clean.updatedAt = serverTimestamp();
  return clean;
}

export async function syncPrivateProfileToFirestore(user: User): Promise<void> {
  const profilePath = `users/${user.uid}/private/profile`;
  try {
    await setDoc(
      doc(db, 'users', user.uid, 'private', 'profile'),
      {
        uid: user.uid,
        email: user.email || '',
        displayName: (user.displayName || '').slice(0, 120),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }
}

export async function pushQueueToCloud(
  user: User,
  workspaceKey: string
): Promise<{
  appliedCount: number;
  conflicts: SyncOperation[];
  error?: string;
}> {
  const queue = await getSyncQueueForWorkspace(workspaceKey);
  if (queue.length === 0) {
    return { appliedCount: 0, conflicts: [] };
  }

  const token = await user.getIdToken();
  const payloadOps = queue.map((op) => ({
    opId: op.opId,
    entityType: op.entityType,
    entityId: op.entityId,
    opType: op.opType,
    version: op.version,
    updatedAt: op.timestamp,
    data: op.data,
  }));

  const response = await fetch('/api/sync/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ operations: payloadOps }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Cloud SQL sync failed (${response.status})`);
  }

  const json = await response.json();
  const results = (json.results || []) as Array<{
    opId: string;
    entityId: string;
    status: 'applied' | 'conflict' | 'rejected';
    reason?: string;
  }>;

  const appliedOpIds: string[] = [];
  const conflicts: SyncOperation[] = [];

  for (const op of queue) {
    const res = results.find((r) => r.opId === op.opId);
    if (!res) continue;
    if (res.status === 'applied') {
      // Mirror to Firestore collection for multi-device Firebase persistence
      const fsCol = FIRESTORE_COLLECTION_MAP[op.entityType];
      const docPath = `users/${user.uid}/${fsCol}/${op.entityId}`;
      try {
        if (op.opType === 'delete') {
          await deleteDoc(doc(db, 'users', user.uid, fsCol, op.entityId));
        } else {
          const fsPayload = sanitizeForFirestore(
            op.entityType,
            op.data,
            user.uid,
            op.version <= 1
          );
          await setDoc(doc(db, 'users', user.uid, fsCol, op.entityId), fsPayload, {
            merge: true,
          });
        }
      } catch (fsErr) {
        // Log structured error per firebase-integration-rpc
        console.warn('Firestore mirror warning:', fsErr);
      }
      appliedOpIds.push(op.opId);
    } else if (res.status === 'conflict') {
      const conflictOp: SyncOperation = {
        ...op,
        status: 'conflict',
        errorMessage: res.reason || 'Version conflict detected',
      };
      conflicts.push(conflictOp);
      await updateSyncOperationStatus(conflictOp);
    } else {
      await updateSyncOperationStatus({
        ...op,
        status: 'error',
        errorMessage: res.reason || 'Sync rejected',
      });
    }
  }

  await removeSyncOperations(appliedOpIds);
  const nowIso = new Date().toISOString();
  await setLastSyncTime(workspaceKey, nowIso);
  return { appliedCount: appliedOpIds.length, conflicts };
}

function mergeByVersion<T extends BaseEntity>(localItems: T[], remoteItems: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of remoteItems) {
    map.set(item.id, item);
  }
  for (const local of localItems) {
    const existing = map.get(local.id);
    if (!existing || local.version > existing.version || local.updatedAt > existing.updatedAt) {
      map.set(local.id, local);
    }
  }
  return Array.from(map.values());
}

export async function pullSnapshotFromCloud(
  user: User,
  localWorkspace: WorkspaceData
): Promise<WorkspaceData> {
  const token = await user.getIdToken();
  const response = await fetch('/api/sync/pull', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Failed to pull cloud snapshot (${response.status})`);
  }

  const json = await response.json();
  const snap = json.snapshot || {};

  const mapSqlRows = <T extends BaseEntity>(rows: any[] = []): T[] =>
    rows.map((r) => ({
      ...r,
      userId: user.uid,
    }));

  // Also check Firestore accounts if SQL was empty on first load
  let fsAccounts: any[] = [];
  if ((snap.accounts || []).length === 0) {
    const accPath = `users/${user.uid}/accounts`;
    try {
      const fsSnap = await getDocs(collection(db, 'users', user.uid, 'accounts'));
      fsAccounts = fsSnap.docs.map((d) => ({ ...d.data(), id: d.id, userId: user.uid }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, accPath);
    }
  }

  const remotePrefsList = mapSqlRows<any>(snap.userPreferences || []);
  const remotePref = remotePrefsList[0];
  const mergedPrefs =
    remotePref &&
    remotePref.version >= localWorkspace.userPreferences.version
      ? { ...createDefaultPreferences(user.uid, false), ...remotePref, userId: user.uid }
      : localWorkspace.userPreferences;

  return {
    userPreferences: mergedPrefs,
    accounts: mergeByVersion(
      localWorkspace.accounts,
      mapSqlRows(snap.accounts || []).length > 0 ? mapSqlRows(snap.accounts) : fsAccounts
    ),
    transactions: mergeByVersion(localWorkspace.transactions, mapSqlRows(snap.transactions)),
    budgets: mergeByVersion(localWorkspace.budgets, mapSqlRows(snap.budgets)),
    savingsGoals: mergeByVersion(localWorkspace.savingsGoals, mapSqlRows(snap.savingsGoals)),
    savingsContributions: mergeByVersion(
      localWorkspace.savingsContributions,
      mapSqlRows(snap.savingsContributions)
    ),
    loans: mergeByVersion(localWorkspace.loans, mapSqlRows(snap.loans)),
    loanPayments: mergeByVersion(localWorkspace.loanPayments, mapSqlRows(snap.loanPayments)),
    emiPlans: mergeByVersion(localWorkspace.emiPlans, mapSqlRows(snap.emiPlans)),
    emiPayments: mergeByVersion(localWorkspace.emiPayments, mapSqlRows(snap.emiPayments)),
    insurancePolicies: mergeByVersion(
      localWorkspace.insurancePolicies,
      mapSqlRows(snap.insurancePolicies)
    ),
    medicalClaims: mergeByVersion(localWorkspace.medicalClaims, mapSqlRows(snap.medicalClaims)),
    investments: mergeByVersion(localWorkspace.investments, mapSqlRows(snap.investments)),
    sipPlans: mergeByVersion(localWorkspace.sipPlans, mapSqlRows(snap.sipPlans)),
    recurringTransactions: mergeByVersion(
      localWorkspace.recurringTransactions,
      mapSqlRows(snap.recurringTransactions)
    ),
    notifications: mergeByVersion(localWorkspace.notifications, mapSqlRows(snap.notifications)),
  };
}
