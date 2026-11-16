import React, { useState } from 'react';
import { Download, Lock, RefreshCw, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { useSavern } from '../context/SavernContext.tsx';
import { UserPreferences } from '../types/finance.ts';
import { exportTransactionsToCsv, formatDateDisplay } from '../lib/financeEngine.ts';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.tsx';
import { PWAInstallButton } from '../components/PWAInstallButton.tsx';

export async function hashPinSha256(pin: string): Promise<string> {
  const enc = new TextEncoder().encode(`savern-pin-v1:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const SettingsPage: React.FC = () => {
  const {
    user,
    isDemoMode,
    data,
    isOnline,
    syncStatus,
    pendingSyncCount,
    conflictOps,
    lastSyncedAt,
    syncError,
    updatePreferences,
    runSyncNow,
    resetDemoData,
    clearAllUserData,
    deleteCloudAccount,
    showToast,
  } = useSavern();

  const prefs = data.userPreferences;
  const [pinInput, setPinInput] = useState('');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmDeleteCloudOpen, setConfirmDeleteCloudOpen] = useState(false);

  const handleDownloadJsonBackup = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `savern-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('JSON backup downloaded', 'success');
  };

  const handleDownloadCsv = () => {
    const csv = exportTransactionsToCsv(data.transactions, data.accounts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `savern-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Transactions CSV downloaded', 'success');
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pinInput)) {
      showToast('Enter a 4-digit numeric PIN', 'warning');
      return;
    }
    const hash = await hashPinSha256(pinInput);
    await updatePreferences({ appLockPinHash: hash });
    setPinInput('');
    showToast('Local App Lock PIN enabled', 'success');
  };

  const handleRemovePin = async () => {
    await updatePreferences({ appLockPinHash: null });
    showToast('App Lock PIN removed', 'info');
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Profile Card */}
      <section className="rounded-xl border border-[#273449] bg-[#151F30] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Profile'}
                referrerPolicy="no-referrer"
                className="h-12 w-12 rounded-xl border border-[#273449] object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#273449] bg-[#101827] text-lg font-bold text-[#24D6A0]">
                {(user?.displayName || 'S').slice(0, 1)}
              </div>
            )}
            <div>
              <h2 className="font-display text-base font-semibold text-[#F5F7FA]">
                {user && !isDemoMode ? user.displayName || 'Savern Member' : 'Demo Explorer'}
              </h2>
              <p className="text-xs text-[#94A3B8]">
                {user && !isDemoMode
                  ? `${user.email} · Private Cloud Workspace`
                  : 'Local Demo Workspace (isolated from cloud accounts)'}
              </p>
            </div>
          </div>
          <PWAInstallButton />
        </div>
      </section>

      {/* Regional & Formatting Preferences */}
      <section className="rounded-xl border border-[#273449] bg-[#151F30] p-5 space-y-4">
        <h2 className="font-display text-base font-semibold text-[#F5F7FA]">
          Regional & Financial Preferences
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-[#94A3B8] mb-1">Currency</label>
            <select
              value={prefs.currency}
              onChange={(e) => updatePreferences({ currency: e.target.value })}
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="AED">AED (د.إ)</option>
            </select>
          </div>

          <div>
            <label className="block text-[#94A3B8] mb-1">Number Formatting</label>
            <select
              value={prefs.numberFormat}
              onChange={(e) =>
                updatePreferences({ numberFormat: e.target.value as 'en-IN' | 'en-US' })
              }
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
            >
              <option value="en-IN">Indian (1,00,000)</option>
              <option value="en-US">International (100,000)</option>
            </select>
          </div>

          <div>
            <label className="block text-[#94A3B8] mb-1">Date Format</label>
            <select
              value={prefs.dateFormat}
              onChange={(e) =>
                updatePreferences({
                  dateFormat: e.target.value as UserPreferences['dateFormat'],
                })
              }
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
            >
              <option value="DD MMM YYYY">DD MMM YYYY (16 Nov 2026)</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY (16/11/2026)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (2026-11-16)</option>
            </select>
          </div>

          <div>
            <label className="block text-[#94A3B8] mb-1">Timezone</label>
            <select
              value={prefs.timezone}
              onChange={(e) => updatePreferences({ timezone: e.target.value })}
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Asia/Dubai">Asia/Dubai</option>
            </select>
          </div>

          <div>
            <label className="block text-[#94A3B8] mb-1">Financial Year Start</label>
            <select
              value={prefs.financialYearStartMonth}
              onChange={(e) =>
                updatePreferences({ financialYearStartMonth: Number(e.target.value) })
              }
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
            >
              <option value={4}>April (Apr–Mar, India FY)</option>
              <option value={1}>January (Jan–Dec)</option>
            </select>
          </div>

          <div>
            <label className="block text-[#94A3B8] mb-1">Layout Density (Dark Mode Only)</label>
            <select
              value={prefs.layoutDensity}
              onChange={(e) =>
                updatePreferences({
                  layoutDensity: e.target.value as 'comfortable' | 'compact',
                })
              }
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </div>
        </div>
      </section>

      {/* Alert Toggles */}
      <section className="rounded-xl border border-[#273449] bg-[#151F30] p-5 space-y-3">
        <h2 className="font-display text-base font-semibold text-[#F5F7FA]">
          Smart Reminder Preferences
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {(
            [
              ['budgetAlertsEnabled', 'Budget threshold alerts (50/75/90/100%)'],
              ['emiRemindersEnabled', 'EMI upcoming & due-day alerts'],
              ['loanRemindersEnabled', 'Loan due date reminders'],
              ['sipRemindersEnabled', 'Mutual fund SIP installment reminders'],
            ] as const
          ).map(([field, label]) => (
            <label
              key={field}
              className="flex items-center justify-between rounded-lg border border-[#273449] bg-[#101827] px-3.5 py-2.5 cursor-pointer"
            >
              <span className="text-xs text-[#F5F7FA]">{label}</span>
              <input
                type="checkbox"
                checked={prefs[field]}
                onChange={(e) => updatePreferences({ [field]: e.target.checked })}
              />
            </label>
          ))}
        </div>
      </section>

      {/* App Lock Security */}
      <section className="rounded-xl border border-[#273449] bg-[#151F30] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-[#24D6A0]" />
          <h2 className="font-display text-base font-semibold text-[#F5F7FA]">
            Local App Lock PIN
          </h2>
        </div>
        <p className="text-xs text-[#94A3B8]">
          Optional 4-digit local privacy lock stored hashed on this device.
        </p>

        {prefs.appLockPinHash ? (
          <div className="flex items-center justify-between rounded-lg border border-[#28C997]/30 bg-[#28C997]/10 px-4 py-3 text-xs">
            <span className="text-[#28C997] font-medium">App Lock PIN is enabled on this device</span>
            <button
              type="button"
              onClick={handleRemovePin}
              className="rounded-lg border border-[#273449] bg-[#101827] px-3 py-1.5 text-[#F16C78] hover:bg-[#1B2940]"
            >
              Remove PIN
            </button>
          </div>
        ) : (
          <form onSubmit={handleSetPin} className="flex flex-wrap items-center gap-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="4-digit PIN"
              className="w-36 rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
            />
            <button
              type="submit"
              className="rounded-lg bg-[#24D6A0] px-4 py-2 text-xs font-semibold text-[#080D16] hover:bg-[#28C997]"
            >
              Enable App Lock
            </button>
          </form>
        )}
      </section>

      {/* Cloud Sync & Data Export */}
      <section className="rounded-xl border border-[#273449] bg-[#151F30] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-[#F5F7FA]">
              Sync, Backups & Account Data
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Status: <span className="capitalize text-[#F5F7FA]">{syncStatus}</span> ·{' '}
              {isOnline ? 'Online' : 'Offline'} · {pendingSyncCount} pending operation(s)
              {lastSyncedAt
                ? ` · Last sync ${formatDateDisplay(lastSyncedAt.slice(0, 10), prefs.dateFormat)}`
                : ''}
            </p>
          </div>
          {user && !isDemoMode && (
            <button
              type="button"
              onClick={runSyncNow}
              className="flex items-center gap-1.5 rounded-lg border border-[#273449] bg-[#101827] px-3.5 py-2 text-xs font-medium text-[#24D6A0] hover:bg-[#1B2940]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Sync Now</span>
            </button>
          )}
        </div>

        {syncError && (
          <div className="flex items-center gap-2 rounded-lg border border-[#F16C78]/40 bg-[#F16C78]/10 px-3 py-2 text-xs text-[#F16C78]">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{syncError}</span>
          </div>
        )}

        {conflictOps.length > 0 && (
          <div className="rounded-lg border border-[#F6B94A]/40 bg-[#F6B94A]/10 p-3 space-y-1 text-xs">
            <p className="font-semibold text-[#F6B94A]">
              {conflictOps.length} Version Conflict(s) Detected
            </p>
            {conflictOps.map((c) => (
              <p key={c.opId} className="text-[#94A3B8]">
                {c.entityType} ({c.entityId}): {c.errorMessage}
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDownloadJsonBackup}
            className="flex items-center gap-1.5 rounded-lg border border-[#273449] bg-[#101827] px-3.5 py-2 text-xs font-medium text-[#F5F7FA] hover:bg-[#1B2940]"
          >
            <Upload className="h-3.5 w-3.5 text-[#24D6A0]" />
            <span>Download Full JSON Backup</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 rounded-lg border border-[#273449] bg-[#101827] px-3.5 py-2 text-xs font-medium text-[#F5F7FA] hover:bg-[#1B2940]"
          >
            <Download className="h-3.5 w-3.5 text-[#39A0ED]" />
            <span>Export Transactions CSV</span>
          </button>

          {isDemoMode ? (
            <button
              type="button"
              onClick={resetDemoData}
              className="flex items-center gap-1.5 rounded-lg border border-[#273449] bg-[#101827] px-3.5 py-2 text-xs font-medium text-[#F6B94A] hover:bg-[#1B2940]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reset Demo Data</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[#273449] bg-[#101827] px-3.5 py-2 text-xs font-medium text-[#F6B94A] hover:bg-[#1B2940]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear Local Cache</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteCloudOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[#F16C78]/40 bg-[#F16C78]/10 px-3.5 py-2 text-xs font-medium text-[#F16C78] hover:bg-[#F16C78]/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Cloud Account Data</span>
              </button>
            </>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        title="Clear Local Workspace Cache"
        message="This resets the IndexedDB workspace on this device. Cloud records remain safe."
        confirmLabel="Clear Local"
        onConfirm={clearAllUserData}
      />

      <ConfirmDialog
        open={confirmDeleteCloudOpen}
        onClose={() => setConfirmDeleteCloudOpen(false)}
        title="Delete Cloud Account Data"
        message="This permanently removes your financial records from Cloud SQL and signs you out. This cannot be undone."
        confirmLabel="Delete Forever"
        onConfirm={deleteCloudAccount}
      />
    </div>
  );
};
