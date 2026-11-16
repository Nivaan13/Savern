import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Edit2, Landmark, Plus, Scale, Trash2 } from 'lucide-react';
import { useSavern } from '../context/SavernContext.tsx';
import { Account, AccountType } from '../types/finance.ts';
import {
  activeRecords,
  calculateTotalBalances,
  formatCurrency,
  formatDateDisplay,
  getTodayISO,
} from '../lib/financeEngine.ts';
import { Modal } from '../components/ui/Modal.tsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';

export const AccountsPage: React.FC = () => {
  const { data, saveEntity, deleteEntity, setQuickAddMode, showToast } = useSavern();
  const prefs = data.userPreferences;
  const accounts = activeRecords(data.accounts);
  const balances = useMemo(
    () => calculateTotalBalances(data.accounts, data.transactions),
    [data.accounts, data.transactions]
  );

  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('savings');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [institution, setInstitution] = useState('');
  const [description, setDescription] = useState('');

  // Balance Reconciliation Modal
  const [reconcileAcc, setReconcileAcc] = useState<Account | null>(null);
  const [actualBalanceInput, setActualBalanceInput] = useState('');
  const [reconcileReason, setReconcileReason] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNewAccount = () => {
    setEditingAcc(null);
    setName('');
    setType('savings');
    setOpeningBalance('0');
    setInstitution('');
    setDescription('');
    setAccountModalOpen(true);
  };

  const openEditAccount = (acc: Account) => {
    setEditingAcc(acc);
    setName(acc.name);
    setType(acc.type);
    setOpeningBalance(String(acc.openingBalance));
    setInstitution(acc.institution || '');
    setDescription(acc.description || '');
    setAccountModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await saveEntity('accounts', {
      id: editingAcc?.id,
      name: name.trim(),
      type,
      openingBalance: Number(openingBalance) || 0,
      currency: prefs.currency,
      institution: institution.trim() || null,
      description: description.trim() || null,
    });
    showToast(editingAcc ? 'Account updated' : 'Account added', 'success');
    setAccountModalOpen(false);
  };

  const handleReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcileAcc) return;
    const calculated = balances.perAccount.get(reconcileAcc.id) || 0;
    const actual = Number(actualBalanceInput);
    if (!Number.isFinite(actual)) return;
    const diff = Math.round((actual - calculated) * 100) / 100;
    if (diff === 0) {
      showToast('Calculated balance already matches actual balance', 'info');
      setReconcileAcc(null);
      return;
    }
    if (!reconcileReason.trim()) return;

    await saveEntity('transactions', {
      type: 'adjustment',
      amount: diff,
      description: `Balance Reconciliation · ${reconcileAcc.name}`,
      category: 'Adjustment',
      accountId: reconcileAcc.id,
      date: getTodayISO(),
      time: '12:00',
      paymentMethod: 'Other',
      notes: reconcileReason.trim(),
      tags: ['reconciliation'],
      isRefund: false,
      reconciliationReason: reconcileReason.trim(),
    });
    showToast('Balance reconciliation adjustment recorded', 'success');
    setReconcileAcc(null);
  };

  const accountHistory = useMemo(() => {
    return activeRecords(data.transactions)
      .filter((tx) => {
        if (selectedAccountId === 'all') return true;
        return tx.accountId === selectedAccountId || tx.toAccountId === selectedAccountId;
      })
      .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
      .slice(0, 30);
  }, [data.transactions, selectedAccountId]);

  const fmt = (v: number) => formatCurrency(v, prefs.currency, prefs.numberFormat, prefs.hideAmounts);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-[#94A3B8]">
            Net Manual Balance across {accounts.length} account{accounts.length === 1 ? '' : 's'}
          </p>
          <h2 className="font-display text-2xl font-bold text-[#F5F7FA] font-mono-num">
            {fmt(balances.totalAvailable)}
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={accounts.length < 2}
            onClick={() => setQuickAddMode('transfer')}
            className="flex items-center gap-1.5 rounded-lg border border-[#273449] bg-[#151F30] px-3.5 py-2 text-xs font-medium text-[#F5F7FA] hover:bg-[#1B2940] disabled:opacity-40"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-[#39A0ED]" />
            <span>Transfer</span>
          </button>
          <button
            type="button"
            onClick={openNewAccount}
            className="flex items-center gap-1.5 rounded-lg bg-[#24D6A0] px-4 py-2 text-xs font-semibold text-[#080D16] hover:bg-[#28C997]"
          >
            <Plus className="h-4 w-4" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No accounts configured"
          description="Add a Cash Wallet, Savings Account, or Current Account to start tracking balances accurately."
          actionLabel="Add First Account"
          onAction={openNewAccount}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            const current = balances.perAccount.get(acc.id) || 0;
            return (
              <div
                key={acc.id}
                className="rounded-xl border border-[#273449] bg-[#151F30] p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-[#94A3B8]">
                        {acc.type} {acc.institution ? `· ${acc.institution}` : ''}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-[#F5F7FA]">{acc.name}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditAccount(acc)}
                        className="rounded p-1.5 text-[#94A3B8] hover:bg-[#1B2940] hover:text-[#F5F7FA]"
                        aria-label="Edit account"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(acc.id)}
                        className="rounded p-1.5 text-[#94A3B8] hover:bg-[#F16C78]/10 hover:text-[#F16C78]"
                        aria-label="Delete account"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-4 font-display text-2xl font-bold text-[#24D6A0] font-mono-num">
                    {fmt(current)}
                  </p>
                  <p className="mt-1 text-xs text-[#94A3B8] font-mono-num">
                    Opening: {fmt(acc.openingBalance)}
                  </p>
                  {acc.description && (
                    <p className="mt-2 text-xs text-[#94A3B8]">{acc.description}</p>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-[#273449] pt-3">
                  <button
                    type="button"
                    onClick={() => setSelectedAccountId(acc.id)}
                    className="text-xs font-medium text-[#39A0ED] hover:underline"
                  >
                    Filter Ledger
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReconcileAcc(acc);
                      setActualBalanceInput(String(current));
                      setReconcileReason('');
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-[#273449] bg-[#101827] px-3 py-1 text-xs font-medium text-[#F5F7FA] hover:bg-[#1B2940]"
                  >
                    <Scale className="h-3.5 w-3.5 text-[#F6B94A]" />
                    <span>Reconcile</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Account Transaction History */}
      <div className="rounded-xl border border-[#273449] bg-[#151F30] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-base font-semibold text-[#F5F7FA]">Account Ledger History</h3>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="rounded-lg border border-[#273449] bg-[#101827] px-3 py-1.5 text-xs text-[#F5F7FA]"
          >
            <option value="all">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {accountHistory.length === 0 ? (
          <p className="text-xs text-[#94A3B8] py-6">No transactions recorded for this view.</p>
        ) : (
          <div className="divide-y divide-[#273449]">
            {accountHistory.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#F5F7FA]">{tx.description}</p>
                  <p className="text-xs text-[#94A3B8]">
                    {formatDateDisplay(tx.date, prefs.dateFormat)} · {tx.type}
                    {tx.reconciliationReason ? ` · ${tx.reconciliationReason}` : ''}
                  </p>
                </div>
                <span
                  className={`font-semibold font-mono-num shrink-0 ${
                    tx.type === 'transfer'
                      ? 'text-[#39A0ED]'
                      : tx.type === 'income' || (tx.type === 'adjustment' && tx.amount > 0)
                        ? 'text-[#28C997]'
                        : 'text-[#F16C78]'
                  }`}
                >
                  {fmt(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Account Modal */}
      <Modal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        title={editingAcc ? 'Edit Account' : 'Add Financial Account'}
      >
        <form onSubmit={handleSaveAccount} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Account Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SBI Savings"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Account Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              >
                <option value="savings">Savings</option>
                <option value="cash">Cash</option>
                <option value="current">Current Account</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">
                Opening Balance ({prefs.currency})
              </label>
              <input
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Institution / Bank</label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAccountModalOpen(false)}
              className="rounded-lg border border-[#273449] px-4 py-2 text-sm text-[#94A3B8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#24D6A0] px-5 py-2 text-sm font-semibold text-[#080D16]"
            >
              Save Account
            </button>
          </div>
        </form>
      </Modal>

      {/* Balance Reconciliation Modal */}
      <Modal
        open={!!reconcileAcc}
        onClose={() => setReconcileAcc(null)}
        title={`Reconcile ${reconcileAcc?.name || ''}`}
        subtitle="Creates an explicit adjustment transaction without silently altering past history"
      >
        {reconcileAcc && (
          <form onSubmit={handleReconcile} className="space-y-4">
            <div className="rounded-lg border border-[#273449] bg-[#101827] p-3 flex justify-between text-sm">
              <span className="text-[#94A3B8]">Calculated Balance</span>
              <span className="font-semibold text-[#F5F7FA] font-mono-num">
                {fmt(balances.perAccount.get(reconcileAcc.id) || 0)}
              </span>
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Actual Balance *</label>
              <input
                type="number"
                step="0.01"
                value={actualBalanceInput}
                onChange={(e) => setActualBalanceInput(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Adjustment Reason *</label>
              <input
                type="text"
                value={reconcileReason}
                onChange={(e) => setReconcileReason(e.target.value)}
                placeholder="e.g. Bank interest credit / untracked cash rounding"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReconcileAcc(null)}
                className="rounded-lg border border-[#273449] px-4 py-2 text-sm text-[#94A3B8]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#24D6A0] px-5 py-2 text-sm font-semibold text-[#080D16]"
              >
                Record Adjustment
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Account"
        message="Deleting this account hides it from active balances. Past transaction records remain preserved in history."
        confirmLabel="Delete Account"
        onConfirm={async () => {
          if (deleteId) {
            await deleteEntity('accounts', deleteId);
            showToast('Account removed', 'info');
          }
        }}
      />
    </div>
  );
};
