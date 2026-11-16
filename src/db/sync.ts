import { and, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  accounts,
  budgets,
  emiPayments,
  emiPlans,
  insurancePolicies,
  investments,
  loanPayments,
  loans,
  medicalClaims,
  notifications,
  recurringTransactions,
  savingsContributions,
  savingsGoals,
  sipPlans,
  transactions,
  userPreferences,
} from './schema.ts';

export type SyncEntityType =
  | 'userPreferences'
  | 'accounts'
  | 'transactions'
  | 'budgets'
  | 'savingsGoals'
  | 'savingsContributions'
  | 'loans'
  | 'loanPayments'
  | 'emiPlans'
  | 'emiPayments'
  | 'insurancePolicies'
  | 'medicalClaims'
  | 'investments'
  | 'sipPlans'
  | 'recurringTransactions'
  | 'notifications';

export interface SyncOperationPayload {
  opId: string;
  entityType: SyncEntityType;
  entityId: string;
  opType: 'upsert' | 'delete';
  version: number;
  updatedAt: string;
  data: Record<string, unknown>;
}

const TABLE_MAP = {
  userPreferences,
  accounts,
  transactions,
  budgets,
  savingsGoals,
  savingsContributions,
  loans,
  loanPayments,
  emiPlans,
  emiPayments,
  insurancePolicies,
  medicalClaims,
  investments,
  sipPlans,
  recurringTransactions,
  notifications,
} as const;

export async function pullUserSnapshot(userUid: string) {
  try {
    const [
      prefsRows,
      accountRows,
      txRows,
      budgetRows,
      goalRows,
      contribRows,
      loanRows,
      loanPaymentRows,
      emiPlanRows,
      emiPaymentRows,
      policyRows,
      claimRows,
      investmentRows,
      sipRows,
      recurringRows,
      notificationRows,
    ] = await Promise.all([
      db.select().from(userPreferences).where(eq(userPreferences.userUid, userUid)),
      db.select().from(accounts).where(eq(accounts.userUid, userUid)),
      db.select().from(transactions).where(eq(transactions.userUid, userUid)),
      db.select().from(budgets).where(eq(budgets.userUid, userUid)),
      db.select().from(savingsGoals).where(eq(savingsGoals.userUid, userUid)),
      db.select().from(savingsContributions).where(eq(savingsContributions.userUid, userUid)),
      db.select().from(loans).where(eq(loans.userUid, userUid)),
      db.select().from(loanPayments).where(eq(loanPayments.userUid, userUid)),
      db.select().from(emiPlans).where(eq(emiPlans.userUid, userUid)),
      db.select().from(emiPayments).where(eq(emiPayments.userUid, userUid)),
      db.select().from(insurancePolicies).where(eq(insurancePolicies.userUid, userUid)),
      db.select().from(medicalClaims).where(eq(medicalClaims.userUid, userUid)),
      db.select().from(investments).where(eq(investments.userUid, userUid)),
      db.select().from(sipPlans).where(eq(sipPlans.userUid, userUid)),
      db.select().from(recurringTransactions).where(eq(recurringTransactions.userUid, userUid)),
      db.select().from(notifications).where(eq(notifications.userUid, userUid)),
    ]);

    return {
      userPreferences: prefsRows,
      accounts: accountRows,
      transactions: txRows,
      budgets: budgetRows,
      savingsGoals: goalRows,
      savingsContributions: contribRows,
      loans: loanRows,
      loanPayments: loanPaymentRows,
      emiPlans: emiPlanRows,
      emiPayments: emiPaymentRows,
      insurancePolicies: policyRows,
      medicalClaims: claimRows,
      investments: investmentRows,
      sipPlans: sipRows,
      recurringTransactions: recurringRows,
      notifications: notificationRows,
    };
  } catch (error) {
    console.error('Failed to pull user snapshot from PostgreSQL:', error);
    throw new Error('Failed to load cloud financial records.', { cause: error });
  }
}

export async function applySyncOperations(userUid: string, ops: SyncOperationPayload[]) {
  const results: Array<{
    opId: string;
    entityId: string;
    status: 'applied' | 'conflict' | 'rejected';
    serverVersion?: number;
    serverRecord?: unknown;
    reason?: string;
  }> = [];

  for (const op of ops) {
    const table = TABLE_MAP[op.entityType];
    if (!table) {
      results.push({ opId: op.opId, entityId: op.entityId, status: 'rejected', reason: 'Unknown entity type' });
      continue;
    }

    try {
      const existingRows = await db
        .select()
        .from(table as any)
        .where(and(eq((table as any).id, op.entityId), eq((table as any).userUid, userUid)));

      const existing = existingRows[0] as { version: number; updatedAt: string } | undefined;

      if (existing && op.version < existing.version) {
        results.push({
          opId: op.opId,
          entityId: op.entityId,
          status: 'conflict',
          serverVersion: existing.version,
          serverRecord: existing,
          reason: 'Server has a newer record version',
        });
        continue;
      }

      if (op.opType === 'delete') {
        const nowIso = new Date().toISOString();
        if (existing) {
          await db
            .update(table as any)
            .set({
              deletedAt: nowIso,
              updatedAt: nowIso,
              version: Math.max(op.version, existing.version + 1),
            })
            .where(and(eq((table as any).id, op.entityId), eq((table as any).userUid, userUid)));
        }
        results.push({ opId: op.opId, entityId: op.entityId, status: 'applied' });
        continue;
      }

      const cleanRow: Record<string, unknown> = {
        ...op.data,
        id: op.entityId,
        userUid,
        version: existing ? Math.max(op.version, existing.version) : Math.max(1, op.version || 1),
        createdAt: (op.data.createdAt as string) || op.updatedAt || new Date().toISOString(),
        updatedAt: op.updatedAt || new Date().toISOString(),
      };
      // Remove client-only fields not present in SQL table
      delete cleanRow.userId;

      await db
        .insert(table as any)
        .values(cleanRow)
        .onConflictDoUpdate({
          target: (table as any).id,
          set: cleanRow,
        });

      results.push({ opId: op.opId, entityId: op.entityId, status: 'applied' });
    } catch (error) {
      console.error(`Failed sync operation ${op.opId} (${op.entityType}):`, error);
      results.push({
        opId: op.opId,
        entityId: op.entityId,
        status: 'rejected',
        reason: 'Database write failed',
      });
    }
  }

  return results;
}
