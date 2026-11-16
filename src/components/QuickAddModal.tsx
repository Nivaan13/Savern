import React, { useEffect, useState } from 'react';
import { useSavern } from '../context/SavernContext.tsx';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  TransactionType,
} from '../types/finance.ts';
import { activeRecords, getTodayISO } from '../lib/financeEngine.ts';
import { Modal } from './ui/Modal.tsx';

export const QuickAddModal: React.FC = () => {
  const { quickAddMode, setQuickAddMode, data, saveEntity, showToast } = useSavern();
  const accounts = activeRecords(data.accounts);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [time, setTime] = useState('12:00');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isRefund, setIsRefund] = useState(false);

  // Loan fields
  const [loanDirection, setLoanDirection] = useState<'borrowed' | 'lent'>('borrowed');
  const [counterparty, setCounterparty] = useState('');
  const [dueDate, setDueDate] = useState(getTodayISO());

  // Goal fields
  const [goalName, setGoalName] = useState('');
  const [goalInitial, setGoalInitial] = useState('0');
  const [goalCategory, setGoalCategory] = useState('Laptop');
  const [goalPriority, setGoalPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!quickAddMode) return;
    setError('');
    setAmount('');
    setDescription('');
    setNotes('');
    setTagsInput('');
    setIsRefund(false);
    setDate(getTodayISO());
    const now = new Date();
    setTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    setAccountId(accounts[0]?.id || '');
    setToAccountId(accounts[1]?.id || accounts[0]?.id || '');
    setCategory(quickAddMode === 'income' ? 'Salary' : 'Food');
    setCounterparty('');
    setGoalName('');
    setGoalInitial('0');
  }, [quickAddMode]);

  if (!quickAddMode) return null;

  const titles: Record<Exclude<typeof quickAddMode, null>, string> = {
    expense: 'Add Expense',
    income: 'Add Income',
    transfer: 'Transfer Between Accounts',
    loan: 'Add Loan Record',
    goal: 'Create Savings Goal',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

    setSaving(true);
    try {
      if (quickAddMode === 'expense' || quickAddMode === 'income') {
        if (!description.trim()) {
          setError('Description is required.');
          setSaving(false);
          return;
        }
        if (!accountId) {
          setError('Please create or select an account first.');
          setSaving(false);
          return;
        }
        if (!category) {
          setError('Category is required.');
          setSaving(false);
          return;
        }
        const tags = tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10);

        await saveEntity('transactions', {
          type: quickAddMode as TransactionType,
          amount: numAmount,
          description: description.trim().slice(0, 200),
          category,
          accountId,
          date,
          time,
          paymentMethod,
          notes: notes.trim() || null,
          tags,
          isRefund: quickAddMode === 'expense' ? isRefund : false,
        });
        showToast(`${quickAddMode === 'income' ? 'Income' : 'Expense'} recorded`, 'success');
      } else if (quickAddMode === 'transfer') {
        if (!accountId || !toAccountId || accountId === toAccountId) {
          setError('Select two different accounts for an internal transfer.');
          setSaving(false);
          return;
        }
        await saveEntity('transactions', {
          type: 'transfer',
          amount: numAmount,
          description: description.trim() || 'Account Transfer',
          category: 'Transfer',
          accountId,
          toAccountId,
          date,
          time,
          paymentMethod,
          notes: notes.trim() || 'Internal account transfer',
          tags: ['transfer'],
          isRefund: false,
        });
        showToast('Transfer recorded', 'success');
      } else if (quickAddMode === 'loan') {
        if (!counterparty.trim() || !description.trim()) {
          setError('Counterparty name and loan title are required.');
          setSaving(false);
          return;
        }
        await saveEntity('loans', {
          direction: loanDirection,
          counterpartyName: counterparty.trim(),
          title: description.trim(),
          principalAmount: numAmount,
          interestRate: 0,
          startDate: date,
          dueDate,
          repaymentFrequency: 'monthly',
          notes: notes.trim() || null,
        });
        showToast('Loan record saved', 'success');
      } else if (quickAddMode === 'goal') {
        if (!goalName.trim()) {
          setError('Goal name is required.');
          setSaving(false);
          return;
        }
        await saveEntity('savingsGoals', {
          name: goalName.trim(),
          targetAmount: numAmount,
          initialSavedAmount: Math.max(0, Number(goalInitial) || 0),
          targetDate: dueDate,
          category: goalCategory,
          description: notes.trim() || null,
          priority: goalPriority,
          linkedAccountId: accountId || null,
        });
        showToast('Savings goal created', 'success');
      }
      setQuickAddMode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!quickAddMode}
      onClose={() => setQuickAddMode(null)}
      title={titles[quickAddMode]}
      subtitle="Recorded offline immediately and synced when connected"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-[#F16C78]/40 bg-[#F16C78]/10 px-3 py-2 text-xs text-[#F16C78]">
            {error}
          </div>
        )}

        {quickAddMode === 'loan' && (
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#101827] p-1 border border-[#273449]">
            {(['borrowed', 'lent'] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => setLoanDirection(dir)}
                className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                  loanDirection === dir
                    ? 'bg-[#1B2940] text-[#24D6A0]'
                    : 'text-[#94A3B8] hover:text-[#F5F7FA]'
                }`}
              >
                {dir === 'borrowed' ? 'Money Borrowed' : 'Money Lent'}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
              {quickAddMode === 'goal' ? 'Target Amount' : 'Amount'} ({data.userPreferences.currency}) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num focus:border-[#24D6A0] focus:outline-none"
              required
            />
          </div>

          {quickAddMode === 'goal' ? (
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Goal Name *
              </label>
              <input
                type="text"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder="e.g. Buy a Laptop"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] focus:border-[#24D6A0] focus:outline-none"
                required
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                {quickAddMode === 'loan' ? 'Loan Title *' : 'Description *'}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={quickAddMode === 'transfer' ? 'ATM Withdrawal' : 'What was this for?'}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] focus:border-[#24D6A0] focus:outline-none"
                required={quickAddMode !== 'transfer'}
              />
            </div>
          )}
        </div>

        {(quickAddMode === 'expense' || quickAddMode === 'income') && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] focus:border-[#24D6A0] focus:outline-none"
                >
                  {(quickAddMode === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Account *</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] focus:border-[#24D6A0] focus:outline-none"
                >
                  {accounts.length === 0 ? (
                    <option value="">No accounts yet</option>
                  ) : (
                    accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] focus:border-[#24D6A0] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] focus:border-[#24D6A0] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] focus:border-[#24D6A0] focus:outline-none"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {quickAddMode === 'expense' && (
              <label className="flex items-center gap-2 text-xs text-[#94A3B8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRefund}
                  onChange={(e) => setIsRefund(e.target.checked)}
                  className="rounded border-[#273449] bg-[#101827] text-[#24D6A0]"
                />
                <span>Mark as expense refund (reduces category spending and credits account)</span>
              </label>
            )}

            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="groceries, monthly, urgent"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] focus:border-[#24D6A0] focus:outline-none"
              />
            </div>
          </>
        )}

        {quickAddMode === 'transfer' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">From Account *</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">To Account *</label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
          </div>
        )}

        {quickAddMode === 'loan' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                {loanDirection === 'borrowed' ? 'Lender Name *' : 'Borrower Name *'}
              </label>
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="Person or bank"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Start Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
          </div>
        )}

        {quickAddMode === 'goal' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Initial Saved
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={goalInitial}
                onChange={(e) => setGoalInitial(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Category</label>
              <select
                value={goalCategory}
                onChange={(e) => setGoalCategory(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              >
                {['Laptop', 'Smartphone', 'Bicycle', 'Vehicle', 'Education', 'Vacation', 'Emergency fund', 'Custom'].map(
                  (c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Target Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional context..."
            className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] focus:border-[#24D6A0] focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setQuickAddMode(null)}
            className="rounded-lg border border-[#273449] bg-[#101827] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-[#F5F7FA]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#24D6A0] px-5 py-2 text-sm font-semibold text-[#080D16] hover:bg-[#28C997] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Record'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
