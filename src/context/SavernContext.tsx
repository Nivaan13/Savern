import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  Account,
  BaseEntity,
  Budget,
  EmiPayment,
  EmiPlan,
  EntityCollectionKey,
  InsurancePolicy,
  Investment,
  Loan,
  LoanPayment,
  MedicalClaim,
  NotificationItem,
  RecurringTransaction,
  SavingsContribution,
  SavingsGoal,
  SipPlan,
  SyncOperation,
  SyncStateStatus,
  Transaction,
  UserPreferences,
  WorkspaceData,
} from '../types/finance.ts';
import { auth, googleAuthProvider, testFirestoreConnection } from '../lib/firebase.ts';
import { createDemoWorkspace, createEmptyWorkspace } from '../lib/demoData.ts';
import {
  deleteWorkspaceFromIdb,
  enqueueSyncOperation,
  getLastSyncTime,
  getSyncQueueForWorkspace,
  loadWorkspaceFromIdb,
  saveWorkspaceToIdb,
} from '../lib/indexedDb.ts';
import {
  pullSnapshotFromCloud,
  pushQueueToCloud,
  syncPrivateProfileToFirestore,
} from '../lib/syncEngine.ts';
import {
  activeRecords,
  calculateBudgetSummary,
  formatCurrency,
  getMonthKey,
  getTodayISO,
} from '../lib/financeEngine.ts';

export type QuickAddMode = 'expense' | 'income' | 'transfer' | 'loan' | 'goal' | null;

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: 'success' | 'error' | 'info' | 'warning';
}

interface SavernContextValue {
  user: User | null;
  authReady: boolean;
  isDemoMode: boolean;
  workspaceKey: string;
  data: WorkspaceData;
  isLoadingData: boolean;
  isOnline: boolean;
  syncStatus: SyncStateStatus;
  pendingSyncCount: number;
  conflictOps: SyncOperation[];
  lastSyncedAt: string | null;
  syncError: string | null;
  quickAddMode: QuickAddMode;
  setQuickAddMode: (mode: QuickAddMode) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  toasts: ToastMessage[];
  showToast: (title: string, variant?: ToastMessage['variant'], description?: string) => void;
  dismissToast: (id: string) => void;
  signInWithGoogle: () => Promise<void>;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  resetDemoData: () => Promise<void>;
  logout: () => Promise<void>;
  runSyncNow: () => Promise<void>;
  updatePreferences: (patch: Partial<UserPreferences>) => Promise<void>;
  toggleHideAmounts: () => Promise<void>;
  // Entity CRUD
  saveEntity: <K extends Exclude<EntityCollectionKey, 'userPreferences'>>(
    collectionKey: K,
    record: Omit<WorkspaceData[K][number], 'id' | 'userId' | 'version' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    }
  ) => Promise<WorkspaceData[K][number]>;
  deleteEntity: <K extends Exclude<EntityCollectionKey, 'userPreferences'>>(
    collectionKey: K,
    id: string
  ) => Promise<void>;
  completeOnboarding: (params: {
    openingBalance: number;
    accountName: string;
    currency: string;
    monthlyIncome: number;
    monthlyBudget: number;
    timezone: string;
    dailyReminderEnabled: boolean;
    dailyReminderTime: string;
  }) => Promise<void>;
  clearAllUserData: () => Promise<void>;
  deleteCloudAccount: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const SavernContext = createContext<SavernContextValue | null>(null);

export const SavernProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem('savern_mode') !== 'auth';
  });
  const [data, setData] = useState<WorkspaceData>(() => createDemoWorkspace());
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncStatus, setSyncStatus] = useState<SyncStateStatus>('demo');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [conflictOps, setConflictOps] = useState<SyncOperation[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [quickAddMode, setQuickAddMode] = useState<QuickAddMode>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const workspaceKey = user && !isDemoMode ? `user:${user.uid}` : 'demo';
  const currentUserId = user && !isDemoMode ? user.uid : 'demo-user';
  const dataRef = useRef(data);
  dataRef.current = data;

  const showToast = useCallback(
    (title: string, variant: ToastMessage['variant'] = 'info', description?: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev.slice(-4), { id, title, variant, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Boot Firestore connection check per firebase-integration-rpc
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Network listeners
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => {
      setIsOnline(false);
      if (!isDemoMode && user) setSyncStatus('offline');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [isDemoMode, user]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setIsDemoMode(false);
        localStorage.setItem('savern_mode', 'auth');
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const refreshQueueStatus = useCallback(async (wKey: string, onlineNow: boolean, demo: boolean) => {
    if (demo) {
      setPendingSyncCount(0);
      setConflictOps([]);
      setSyncStatus('demo');
      return;
    }
    const queue = await getSyncQueueForWorkspace(wKey);
    const conflicts = queue.filter((q) => q.status === 'conflict');
    setPendingSyncCount(queue.length);
    setConflictOps(conflicts);
    if (!onlineNow) {
      setSyncStatus('offline');
    } else if (queue.length > 0) {
      setSyncStatus(conflicts.length > 0 ? 'error' : 'pending');
    }
  }, []);

  const runSyncNow = useCallback(async () => {
    if (!user || isDemoMode) {
      setSyncStatus('demo');
      return;
    }
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }
    setSyncStatus('syncing');
    setSyncError(null);
    const wKey = `user:${user.uid}`;
    try {
      await syncPrivateProfileToFirestore(user);
      const pushRes = await pushQueueToCloud(user, wKey);
      const merged = await pullSnapshotFromCloud(user, dataRef.current);
      setData(merged);
      await saveWorkspaceToIdb(wKey, merged);
      const remainingQueue = await getSyncQueueForWorkspace(wKey);
      setPendingSyncCount(remainingQueue.length);
      setConflictOps(pushRes.conflicts);
      const syncedIso = await getLastSyncTime(wKey);
      setLastSyncedAt(syncedIso || new Date().toISOString());
      if (pushRes.conflicts.length > 0) {
        setSyncStatus('error');
        setSyncError(`${pushRes.conflicts.length} record conflict(s) require review.`);
      } else if (remainingQueue.length > 0) {
        setSyncStatus('pending');
      } else {
        setSyncStatus('synced');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Synchronization failed';
      setSyncError(msg);
      setSyncStatus('error');
    }
  }, [user, isDemoMode]);

  // Load workspace from IndexedDB + Sync from Cloud when workspaceKey changes
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;

    async function initWorkspace() {
      setIsLoadingData(true);
      if (isDemoMode || !user) {
        const cachedDemo = await loadWorkspaceFromIdb('demo');
        const nextDemo = cachedDemo || createDemoWorkspace();
        if (!cachedDemo) {
          await saveWorkspaceToIdb('demo', nextDemo);
        }
        if (!cancelled) {
          setData(nextDemo);
          setSyncStatus('demo');
          setPendingSyncCount(0);
          setIsLoadingData(false);
        }
        return;
      }

      const wKey = `user:${user.uid}`;
      const cachedUser = await loadWorkspaceFromIdb(wKey);
      const initial = cachedUser || createEmptyWorkspace(user.uid);
      if (!cancelled) {
        setData(initial);
        setIsLoadingData(false);
      }

      await refreshQueueStatus(wKey, navigator.onLine, false);
      const syncedIso = await getLastSyncTime(wKey);
      if (!cancelled) setLastSyncedAt(syncedIso);

      if (navigator.onLine) {
        await runSyncNow();
      }
    }

    initWorkspace();
    return () => {
      cancelled = true;
    };
  }, [authReady, isDemoMode, user, refreshQueueStatus, runSyncNow]);

  // Trigger sync automatically when connectivity returns
  useEffect(() => {
    if (isOnline && user && !isDemoMode) {
      runSyncNow();
    }
  }, [isOnline, user, isDemoMode, runSyncNow]);

  // In-app 22:00 daily expense reminder check while app is active
  useEffect(() => {
    const prefs = data.userPreferences;
    if (!prefs.dailyReminderEnabled) return;

    const timer = setInterval(() => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      if (!prefs.dailyReminderDays.includes(dayOfWeek)) return;
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const todayKey = `savern_daily_reminded_${workspaceKey}_${getTodayISO()}`;
      if (hhmm === prefs.dailyReminderTime && !localStorage.getItem(todayKey)) {
        localStorage.setItem(todayKey, '1');
        const message =
          "Time to update your expenses! Record today's spending to keep your Savern reports accurate.";
        showToast('Daily Expense Reminder', 'info', message);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification('SAVERN Expense Reminder', { body: message, icon: '/pwa-192x192.png' });
          } catch {
            // ignore notification errors in restricted contexts
          }
        }
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [data.userPreferences, workspaceKey, showToast]);

  const signInWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      setIsDemoMode(false);
      localStorage.setItem('savern_mode', 'auth');
      showToast(`Signed in as ${result.user.displayName || result.user.email}`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed';
      showToast('Authentication failed', 'error', msg);
      throw err;
    }
  }, [showToast]);

  const enterDemoMode = useCallback(() => {
    setIsDemoMode(true);
    localStorage.setItem('savern_mode', 'demo');
    showToast('Exploring Demo Workspace', 'info', 'Fictional data is isolated from cloud accounts.');
  }, [showToast]);

  const exitDemoMode = useCallback(() => {
    if (user) {
      setIsDemoMode(false);
      localStorage.setItem('savern_mode', 'auth');
    }
  }, [user]);

  const resetDemoData = useCallback(async () => {
    const fresh = createDemoWorkspace();
    await saveWorkspaceToIdb('demo', fresh);
    if (isDemoMode || !user) {
      setData(fresh);
    }
    showToast('Demo data reset', 'success');
  }, [isDemoMode, user, showToast]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setIsDemoMode(true);
    localStorage.setItem('savern_mode', 'demo');
    showToast('Signed out', 'info');
  }, [showToast]);

  const persistAndQueue = useCallback(
    async (
      nextData: WorkspaceData,
      entityType: EntityCollectionKey,
      entityId: string,
      opType: 'upsert' | 'delete',
      record: Record<string, unknown>,
      version: number
    ) => {
      setData(nextData);
      await saveWorkspaceToIdb(workspaceKey, nextData);

      if (user && !isDemoMode) {
        const op: SyncOperation = {
          opId: crypto.randomUUID(),
          workspaceKey,
          userId: user.uid,
          entityType,
          entityId,
          opType,
          timestamp: new Date().toISOString(),
          status: 'pending',
          version,
          data: record,
        };
        await enqueueSyncOperation(op);
        const queue = await getSyncQueueForWorkspace(workspaceKey);
        setPendingSyncCount(queue.length);
        if (navigator.onLine) {
          runSyncNow();
        } else {
          setSyncStatus('offline');
        }
      }
    },
    [workspaceKey, user, isDemoMode, runSyncNow]
  );

  const updatePreferences = useCallback(
    async (patch: Partial<UserPreferences>) => {
      const prev = dataRef.current;
      const updated: UserPreferences = {
        ...prev.userPreferences,
        ...patch,
        userId: currentUserId,
        version: prev.userPreferences.version + 1,
        updatedAt: new Date().toISOString(),
      };
      const nextData = { ...prev, userPreferences: updated };
      await persistAndQueue(
        nextData,
        'userPreferences',
        updated.id,
        'upsert',
        updated as unknown as Record<string, unknown>,
        updated.version
      );
    },
    [currentUserId, persistAndQueue]
  );

  const toggleHideAmounts = useCallback(async () => {
    await updatePreferences({ hideAmounts: !dataRef.current.userPreferences.hideAmounts });
  }, [updatePreferences]);

  const checkBudgetAlerts = useCallback(
    async (nextData: WorkspaceData, txDate: string): Promise<WorkspaceData> => {
      if (!nextData.userPreferences.budgetAlertsEnabled) return nextData;
      const monthKey = getMonthKey(txDate);
      const summary = calculateBudgetSummary(nextData.budgets, nextData.transactions, monthKey);
      const now = new Date().toISOString();
      let modified = false;
      const updatedBudgets = [...nextData.budgets];
      const newNotifications = [...nextData.notifications];

      const checkList: Array<{ budget: Budget; spent: number; pct: number }> = [];
      if (summary.totalBudgetRecord) {
        checkList.push({
          budget: summary.totalBudgetRecord,
          spent: summary.totalSpent,
          pct: summary.usedPct,
        });
      }
      for (const cb of summary.categoryBudgets) {
        checkList.push({ budget: cb, spent: cb.spent, pct: cb.usedPct });
      }

      for (const item of checkList) {
        const newlyReached = item.budget.alertThresholds.filter(
          (t) => item.pct >= t && !item.budget.triggeredThresholds.includes(t)
        );
        if (newlyReached.length > 0) {
          modified = true;
          const highest = Math.max(...newlyReached);
          const idx = updatedBudgets.findIndex((b) => b.id === item.budget.id);
          if (idx >= 0) {
            updatedBudgets[idx] = {
              ...updatedBudgets[idx],
              triggeredThresholds: Array.from(
                new Set([...updatedBudgets[idx].triggeredThresholds, ...newlyReached])
              ),
              version: updatedBudgets[idx].version + 1,
              updatedAt: now,
            };
          }
          const label = item.budget.category === 'TOTAL' ? 'Monthly Budget' : `${item.budget.category} Budget`;
          const notif: NotificationItem = {
            id: `notif_${crypto.randomUUID()}`,
            userId: currentUserId,
            kind: 'budget',
            title: `${label} ${highest}% Threshold Reached`,
            message: `Spent ${formatCurrency(
              item.spent,
              nextData.userPreferences.currency,
              nextData.userPreferences.numberFormat
            )} of ${formatCurrency(
              item.budget.limitAmount,
              nextData.userPreferences.currency,
              nextData.userPreferences.numberFormat
            )} (${item.pct}%).`,
            isRead: false,
            dueDate: getTodayISO(),
            dedupeKey: `budget_${item.budget.id}_${highest}`,
            version: 1,
            createdAt: now,
            updatedAt: now,
          };
          newNotifications.unshift(notif);
          showToast(notif.title, highest >= 100 ? 'error' : 'warning', notif.message);
        }
      }

      if (!modified) return nextData;
      return {
        ...nextData,
        budgets: updatedBudgets,
        notifications: newNotifications,
      };
    },
    [currentUserId, showToast]
  );

  const saveEntity = useCallback(
    async <K extends Exclude<EntityCollectionKey, 'userPreferences'>>(
      collectionKey: K,
      input: Omit<WorkspaceData[K][number], 'id' | 'userId' | 'version' | 'createdAt' | 'updatedAt'> & {
        id?: string;
      }
    ): Promise<WorkspaceData[K][number]> => {
      const prev = dataRef.current;
      const list = prev[collectionKey] as BaseEntity[];
      const now = new Date().toISOString();
      const existing = input.id ? list.find((item) => item.id === input.id) : undefined;
      const id = existing?.id || input.id || `${collectionKey.slice(0, 4)}_${crypto.randomUUID()}`;
      const record = {
        ...input,
        id,
        userId: currentUserId,
        version: existing ? existing.version + 1 : 1,
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
        deletedAt: null,
      } as unknown as WorkspaceData[K][number];

      const nextList = existing
        ? list.map((item) => (item.id === id ? record : item))
        : [record, ...list];

      let nextData: WorkspaceData = {
        ...prev,
        [collectionKey]: nextList,
      };

      if (collectionKey === 'transactions') {
        nextData = await checkBudgetAlerts(nextData, (record as unknown as Transaction).date);
      }

      await persistAndQueue(
        nextData,
        collectionKey,
        id,
        'upsert',
        record as unknown as Record<string, unknown>,
        record.version
      );

      return record;
    },
    [currentUserId, persistAndQueue, checkBudgetAlerts]
  );

  const deleteEntity = useCallback(
    async <K extends Exclude<EntityCollectionKey, 'userPreferences'>>(
      collectionKey: K,
      id: string
    ) => {
      const prev = dataRef.current;
      const list = prev[collectionKey] as BaseEntity[];
      const target = list.find((item) => item.id === id);
      if (!target) return;
      const now = new Date().toISOString();
      const updated = {
        ...target,
        deletedAt: now,
        updatedAt: now,
        version: target.version + 1,
      };
      const nextList = list.map((item) => (item.id === id ? updated : item));
      const nextData = { ...prev, [collectionKey]: nextList };
      await persistAndQueue(
        nextData,
        collectionKey,
        id,
        'delete',
        updated as unknown as Record<string, unknown>,
        updated.version
      );
    },
    [persistAndQueue]
  );

  const completeOnboarding = useCallback(
    async (params: {
      openingBalance: number;
      accountName: string;
      currency: string;
      monthlyIncome: number;
      monthlyBudget: number;
      timezone: string;
      dailyReminderEnabled: boolean;
      dailyReminderTime: string;
    }) => {
      const now = new Date().toISOString();
      const today = getTodayISO();
      const curMonth = getMonthKey(today);
      const prev = dataRef.current;

      const updatedPrefs: UserPreferences = {
        ...prev.userPreferences,
        currency: params.currency,
        timezone: params.timezone,
        dailyReminderEnabled: params.dailyReminderEnabled,
        dailyReminderTime: params.dailyReminderTime,
        onboardingCompleted: true,
        version: prev.userPreferences.version + 1,
        updatedAt: now,
      };

      const newAccounts: Account[] =
        activeRecords(prev.accounts).length > 0
          ? prev.accounts
          : [
              {
                id: `acc_${crypto.randomUUID()}`,
                userId: currentUserId,
                name: params.accountName || 'Primary Bank Account',
                type: 'savings',
                openingBalance: Math.max(0, params.openingBalance),
                currency: params.currency,
                description: 'Initial opening balance configured during onboarding',
                version: 1,
                createdAt: now,
                updatedAt: now,
              },
            ];

      const newTransactions = [...prev.transactions];
      if (params.monthlyIncome > 0 && newAccounts[0]) {
        newTransactions.unshift({
          id: `tx_${crypto.randomUUID()}`,
          userId: currentUserId,
          type: 'income',
          amount: params.monthlyIncome,
          description: 'Monthly Income',
          category: 'Salary',
          accountId: newAccounts[0].id,
          date: today,
          time: '09:00',
          paymentMethod: 'Bank transfer',
          notes: 'Added during Savern onboarding',
          tags: ['income'],
          isRefund: false,
          version: 1,
          createdAt: now,
          updatedAt: now,
        });
      }

      const newBudgets = [...prev.budgets];
      if (params.monthlyBudget > 0) {
        newBudgets.push({
          id: `bud_${curMonth}_total`,
          userId: currentUserId,
          monthKey: curMonth,
          category: 'TOTAL',
          limitAmount: params.monthlyBudget,
          alertThresholds: [50, 75, 90, 100],
          triggeredThresholds: [],
          version: 1,
          createdAt: now,
          updatedAt: now,
        });
      }

      const nextData: WorkspaceData = {
        ...prev,
        userPreferences: updatedPrefs,
        accounts: newAccounts,
        transactions: newTransactions,
        budgets: newBudgets,
      };

      setData(nextData);
      await saveWorkspaceToIdb(workspaceKey, nextData);

      if (user && !isDemoMode) {
        await enqueueSyncOperation({
          opId: crypto.randomUUID(),
          workspaceKey,
          userId: user.uid,
          entityType: 'userPreferences',
          entityId: updatedPrefs.id,
          opType: 'upsert',
          timestamp: now,
          status: 'pending',
          version: updatedPrefs.version,
          data: updatedPrefs as unknown as Record<string, unknown>,
        });
        for (const acc of newAccounts) {
          await enqueueSyncOperation({
            opId: crypto.randomUUID(),
            workspaceKey,
            userId: user.uid,
            entityType: 'accounts',
            entityId: acc.id,
            opType: 'upsert',
            timestamp: now,
            status: 'pending',
            version: acc.version,
            data: acc as unknown as Record<string, unknown>,
          });
        }
        if (newTransactions.length > prev.transactions.length) {
          const tx = newTransactions[0];
          await enqueueSyncOperation({
            opId: crypto.randomUUID(),
            workspaceKey,
            userId: user.uid,
            entityType: 'transactions',
            entityId: tx.id,
            opType: 'upsert',
            timestamp: now,
            status: 'pending',
            version: tx.version,
            data: tx as unknown as Record<string, unknown>,
          });
        }
        if (newBudgets.length > prev.budgets.length) {
          const b = newBudgets[newBudgets.length - 1];
          await enqueueSyncOperation({
            opId: crypto.randomUUID(),
            workspaceKey,
            userId: user.uid,
            entityType: 'budgets',
            entityId: b.id,
            opType: 'upsert',
            timestamp: now,
            status: 'pending',
            version: b.version,
            data: b as unknown as Record<string, unknown>,
          });
        }
        if (navigator.onLine) {
          await runSyncNow();
        }
      }
      showToast('Welcome to SAVERN!', 'success', 'Your financial workspace is ready.');
    },
    [currentUserId, workspaceKey, user, isDemoMode, runSyncNow, showToast]
  );

  const clearAllUserData = useCallback(async () => {
    const empty = createEmptyWorkspace(currentUserId);
    empty.userPreferences.onboardingCompleted = true;
    setData(empty);
    await deleteWorkspaceFromIdb(workspaceKey);
    await saveWorkspaceToIdb(workspaceKey, empty);
    showToast('Local workspace cleared', 'info');
  }, [currentUserId, workspaceKey, showToast]);

  const deleteCloudAccount = useCallback(async () => {
    if (!user || isDemoMode) {
      await clearAllUserData();
      return;
    }
    const token = await user.getIdToken();
    const res = await fetch('/api/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error('Failed to delete cloud records.');
    }
    await deleteWorkspaceFromIdb(workspaceKey);
    await signOut(auth);
    setIsDemoMode(true);
    localStorage.setItem('savern_mode', 'demo');
    showToast('Cloud account data deleted', 'success');
  }, [user, isDemoMode, workspaceKey, clearAllUserData, showToast]);

  const markNotificationRead = useCallback(
    async (id: string) => {
      const target = dataRef.current.notifications.find((n) => n.id === id);
      if (!target || target.isRead) return;
      await saveEntity('notifications', { ...target, isRead: true });
    },
    [saveEntity]
  );

  const markAllNotificationsRead = useCallback(async () => {
    const unread = activeRecords(dataRef.current.notifications).filter((n) => !n.isRead);
    for (const item of unread) {
      await saveEntity('notifications', { ...item, isRead: true });
    }
  }, [saveEntity]);

  const value = useMemo<SavernContextValue>(
    () => ({
      user,
      authReady,
      isDemoMode,
      workspaceKey,
      data,
      isLoadingData,
      isOnline,
      syncStatus,
      pendingSyncCount,
      conflictOps,
      lastSyncedAt,
      syncError,
      quickAddMode,
      setQuickAddMode,
      isSearchOpen,
      setIsSearchOpen,
      toasts,
      showToast,
      dismissToast,
      signInWithGoogle,
      enterDemoMode,
      exitDemoMode,
      resetDemoData,
      logout,
      runSyncNow,
      updatePreferences,
      toggleHideAmounts,
      saveEntity,
      deleteEntity,
      completeOnboarding,
      clearAllUserData,
      deleteCloudAccount,
      markNotificationRead,
      markAllNotificationsRead,
    }),
    [
      user,
      authReady,
      isDemoMode,
      workspaceKey,
      data,
      isLoadingData,
      isOnline,
      syncStatus,
      pendingSyncCount,
      conflictOps,
      lastSyncedAt,
      syncError,
      quickAddMode,
      isSearchOpen,
      toasts,
      showToast,
      dismissToast,
      signInWithGoogle,
      enterDemoMode,
      exitDemoMode,
      resetDemoData,
      logout,
      runSyncNow,
      updatePreferences,
      toggleHideAmounts,
      saveEntity,
      deleteEntity,
      completeOnboarding,
      clearAllUserData,
      deleteCloudAccount,
      markNotificationRead,
      markAllNotificationsRead,
    ]
  );

  return <SavernContext.Provider value={value}>{children}</SavernContext.Provider>;
};

export function useSavern() {
  const ctx = useContext(SavernContext);
  if (!ctx) throw new Error('useSavern must be used within SavernProvider');
  return ctx;
}
