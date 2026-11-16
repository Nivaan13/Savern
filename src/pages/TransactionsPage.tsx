import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowUpDown,
  Copy,
  Edit2,
  Plus,
  Receipt,
  Repeat,
  Search,
  Trash2,
} from 'lucide-react';
import { useSavern } from '../context/SavernContext.tsx';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  RecurringTransaction,
  Transaction,
  TransactionType,
} from '../types/finance.ts';
import {
  activeRecords,
  formatCurrency,
  formatDateDisplay,
  getTodayISO,
} from '../lib/financeEngine.ts';
import { Modal } from '../components/ui/Modal.tsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';

function computeNextDate(
  dateStr: string,
  freq: RecurringTransaction['frequency'],
  customDays?: number | null
): string {
  const dt = new Date(`${dateStr}T00:00:00`);
  if (freq === 'daily') dt.setDate(dt.getDate() + 1);
  else if (freq === 'weekly') dt.setDate(dt.getDate() + 7);
  else if (freq === 'monthly') dt.setMonth(dt.getMonth() + 1);
  else if (freq === 'yearly') dt.setFullYear(dt.getFullYear() + 1);
  else dt.setDate(dt.getDate() + Math.max(1, customDays || 30));
  return dt.toISOString().slice(0, 10);
}

export const TransactionsPage: React.FC = () => {
  const { data, saveEntity, deleteEntity, showToast } = useSavern();
  const [searchParams, setSearchParams] = useSearchParams();
  const prefs = data.userPreferences;
  const accounts = activeRecords(data.accounts);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const [tab, setTab] = useState<'ledger' | 'recurring'>('ledger');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [filterCategory, setFilterCategory] = useState(searchParams.get('category') || 'all');
  const [filterAccount, setFilterAccount] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) setFilterCategory(cat);
  }, [searchParams]);

  // Add/Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [time, setTime] = useState('12:00');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [notes, setNotes] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [isRefund, setIsRefund] = useState(false);
  const [formError, setFormError] = useState('');

  // Recurring Modal state
  const [recOpen, setRecOpen] = useState(false);
  const [recType, setRecType] = useState<'income' | 'expense'>('expense');
  const [recAmount, setRecAmount] = useState('');
  const [recDesc, setRecDesc] = useState('');
  const [recCat, setRecCat] = useState('Rent');
  const [recAccount, setRecAccount] = useState('');
  const [recFreq, setRecFreq] = useState<RecurringTransaction['frequency']>('monthly');
  const [recCustomDays, setRecCustomDays] = useState('14');
  const [recNextDate, setRecNextDate] = useState(getTodayISO());

  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'tx' | 'rec'; id: string; label: string } | null>(null);

  const openNewTx = (type: TransactionType = 'expense') => {
    setEditingTx(null);
    setTxType(type);
    setAmount('');
    setDescription('');
    setCategory(type === 'income' ? 'Salary' : 'Food');
    setAccountId(accounts[0]?.id || '');
    setToAccountId(accounts[1]?.id || accounts[0]?.id || '');
    setDate(getTodayISO());
    setTime('12:00');
    setPaymentMethod('UPI');
    setNotes('');
    setTagsText('');
    setIsRefund(false);
    setFormError('');
    setModalOpen(true);
  };

  const openEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setTxType(tx.type);
    setAmount(String(tx.amount));
    setDescription(tx.description);
    setCategory(tx.category);
    setAccountId(tx.accountId);
    setToAccountId(tx.toAccountId || '');
    setDate(tx.date);
    setTime(tx.time);
    setPaymentMethod(tx.paymentMethod);
    setNotes(tx.notes || '');
    setTagsText((tx.tags || []).join(', '));
    setIsRefund(!!tx.isRefund);
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveTx = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setFormError('Amount must be greater than zero.');
      return;
    }
    if (!description.trim()) {
      setFormError('Description is required.');
      return;
    }
    if (!accountId) {
      setFormError('Select an account.');
      return;
    }
    if (txType === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      setFormError('Select a different destination account for transfer.');
      return;
    }

    await saveEntity('transactions', {
      id: editingTx?.id,
      type: txType,
      amount: num,
      description: description.trim().slice(0, 200),
      category: txType === 'transfer' ? 'Transfer' : category,
      accountId,
      toAccountId: txType === 'transfer' ? toAccountId : null,
      date,
      time,
      paymentMethod,
      notes: notes.trim() || null,
      tags: tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10),
      isRefund: txType === 'expense' ? isRefund : false,
    });
    showToast(editingTx ? 'Transaction updated' : 'Transaction added', 'success');
    setModalOpen(false);
  };

  const handleDuplicate = async (tx: Transaction) => {
    await saveEntity('transactions', {
      type: tx.type,
      amount: tx.amount,
      description: `${tx.description} (Copy)`.slice(0, 200),
      category: tx.category,
      accountId: tx.accountId,
      toAccountId: tx.toAccountId || null,
      date: getTodayISO(),
      time: tx.time,
      paymentMethod: tx.paymentMethod,
      notes: tx.notes || null,
      tags: tx.tags || [],
      isRefund: tx.isRefund || false,
    });
    showToast('Transaction duplicated for today', 'success');
  };

  const handleSaveRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(recAmount);
    if (!Number.isFinite(num) || num <= 0 || !recDesc.trim() || !recAccount) return;
    await saveEntity('recurringTransactions', {
      type: recType,
      amount: num,
      description: recDesc.trim(),
      category: recCat,
      accountId: recAccount,
      paymentMethod: 'UPI',
      frequency: recFreq,
      customIntervalDays: recFreq === 'custom' ? Math.max(1, Number(recCustomDays) || 14) : null,
      nextDate: recNextDate,
      lastGeneratedDate: null,
      isActive: true,
    });
    showToast('Recurring template saved', 'success');
    setRecOpen(false);
  };

  const handleRecordRecurringOccurrence = async (rec: RecurringTransaction) => {
    await saveEntity('transactions', {
      type: rec.type,
      amount: rec.amount,
      description: rec.description,
      category: rec.category,
      accountId: rec.accountId,
      date: rec.nextDate,
      time: '09:00',
      paymentMethod: rec.paymentMethod,
      notes: 'Recorded from recurring template',
      tags: ['recurring'],
      isRefund: false,
      recurringId: rec.id,
    });
    await saveEntity('recurringTransactions', {
      ...rec,
      lastGeneratedDate: rec.nextDate,
      nextDate: computeNextDate(rec.nextDate, rec.frequency, rec.customIntervalDays),
    });
    showToast('Occurrence recorded & next date scheduled', 'success');
  };

  const filteredTx = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeRecords(data.transactions)
      .filter((tx) => {
        if (filterType !== 'all' && tx.type !== filterType) return false;
        if (filterCategory !== 'all' && tx.category !== filterCategory) return false;
        if (filterAccount !== 'all' && tx.accountId !== filterAccount && tx.toAccountId !== filterAccount)
          return false;
        if (dateFrom && tx.date < dateFrom) return false;
        if (dateTo && tx.date > dateTo) return false;
        if (
          q &&
          !tx.description.toLowerCase().includes(q) &&
          !tx.category.toLowerCase().includes(q) &&
          !(tx.notes || '').toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'amount') {
          return sortDir === 'desc' ? b.amount - a.amount : a.amount - b.amount;
        }
        const cmp = `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`);
        return sortDir === 'desc' ? -cmp : cmp;
      });
  }, [
    data.transactions,
    filterType,
    filterCategory,
    filterAccount,
    dateFrom,
    dateTo,
    search,
    sortBy,
    sortDir,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredTx.length / PAGE_SIZE));
  const pagedTx = filteredTx.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const liveRecurring = activeRecords(data.recurringTransactions);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-lg border border-[#273449] bg-[#101827] p-1">
          <button
            type="button"
            onClick={() => setTab('ledger')}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'ledger' ? 'bg-[#1B2940] text-[#24D6A0]' : 'text-[#94A3B8] hover:text-[#F5F7FA]'
            }`}
          >
            Transaction Ledger ({activeRecords(data.transactions).length})
          </button>
          <button
            type="button"
            onClick={() => setTab('recurring')}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'recurring' ? 'bg-[#1B2940] text-[#24D6A0]' : 'text-[#94A3B8] hover:text-[#F5F7FA]'
            }`}
          >
            Recurring Templates ({liveRecurring.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {tab === 'ledger' ? (
            <button
              type="button"
              onClick={() => openNewTx('expense')}
              className="flex items-center gap-1.5 rounded-lg bg-[#24D6A0] px-4 py-2 text-xs font-semibold text-[#080D16] hover:bg-[#28C997]"
            >
              <Plus className="h-4 w-4" />
              <span>Add Transaction</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRecAccount(accounts[0]?.id || '');
                setRecOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-[#24D6A0] px-4 py-2 text-xs font-semibold text-[#080D16] hover:bg-[#28C997]"
            >
              <Plus className="h-4 w-4" />
              <span>Add Recurring Rule</span>
            </button>
          )}
        </div>
      </div>

      {tab === 'ledger' ? (
        <>
          {/* Filters */}
          <div className="rounded-xl border border-[#273449] bg-[#151F30] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search description, category, notes..."
                className="w-full rounded-lg border border-[#273449] bg-[#101827] py-2 pl-9 pr-3 text-xs text-[#F5F7FA] focus:border-[#24D6A0] focus:outline-none"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as any);
                setPage(1);
              }}
              className="rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-xs text-[#F5F7FA]"
            >
              <option value="all">All Types</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
              <option value="transfer">Transfers</option>
              <option value="adjustment">Adjustments</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => {
                const val = e.target.value;
                setFilterCategory(val);
                if (val === 'all') searchParams.delete('category');
                else searchParams.set('category', val);
                setSearchParams(searchParams, { replace: true });
                setPage(1);
              }}
              className="rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-xs text-[#F5F7FA]"
            >
              <option value="all">All Categories</option>
              {Array.from(new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={filterAccount}
              onChange={(e) => {
                setFilterAccount(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-xs text-[#F5F7FA]"
            >
              <option value="all">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                if (sortBy === 'date') setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
                else {
                  setSortBy('date');
                  setSortDir('desc');
                }
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-xs text-[#F5F7FA] hover:bg-[#1B2940]"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-[#39A0ED]" />
              <span>
                {sortBy === 'date' ? 'Date' : 'Amount'} ({sortDir})
              </span>
            </button>

            <div className="sm:col-span-2 lg:col-span-6 flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                <span>From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded border border-[#273449] bg-[#101827] px-2.5 py-1 text-xs text-[#F5F7FA]"
                />
                <span>To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded border border-[#273449] bg-[#101827] px-2.5 py-1 text-xs text-[#F5F7FA]"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setSortBy((s) => (s === 'date' ? 'amount' : 'date'));
                }}
                className="text-xs text-[#39A0ED] hover:underline"
              >
                Sort by {sortBy === 'date' ? 'Amount' : 'Date'}
              </button>
              {(filterCategory !== 'all' || filterType !== 'all' || filterAccount !== 'all' || dateFrom || dateTo || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setFilterType('all');
                    setFilterCategory('all');
                    setFilterAccount('all');
                    setDateFrom('');
                    setDateTo('');
                    searchParams.delete('category');
                    setSearchParams(searchParams, { replace: true });
                  }}
                  className="text-xs text-[#F16C78] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          {pagedTx.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No matching transactions"
              description="You haven't recorded any transactions matching these filters yet."
              actionLabel="Record Transaction"
              onAction={() => openNewTx('expense')}
            />
          ) : (
            <div className="rounded-xl border border-[#273449] bg-[#151F30] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#273449] bg-[#101827] text-xs font-medium text-[#94A3B8]">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#273449] text-sm">
                    {pagedTx.map((tx) => {
                      const isPositive =
                        tx.type === 'income' ||
                        (tx.type === 'expense' && tx.isRefund) ||
                        (tx.type === 'adjustment' && tx.amount > 0);
                      return (
                        <tr key={tx.id} className="hover:bg-[#1B2940]/50 transition-colors">
                          <td className="px-4 py-3 text-xs text-[#94A3B8] whitespace-nowrap font-mono-num">
                            {formatDateDisplay(tx.date, prefs.dateFormat)}
                          </td>
                          <td className="px-4 py-3 min-w-[180px]">
                            <p className="font-medium text-[#F5F7FA]">{tx.description}</p>
                            {tx.notes && (
                              <p className="text-xs text-[#94A3B8] truncate max-w-xs">{tx.notes}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#94A3B8] whitespace-nowrap">
                            {tx.category}
                            {tx.isRefund && ' · Refund'}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#94A3B8] whitespace-nowrap">
                            {accountMap.get(tx.accountId) || 'Account'}
                            {tx.toAccountId ? ` → ${accountMap.get(tx.toAccountId) || ''}` : ''}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#94A3B8] whitespace-nowrap">
                            {tx.paymentMethod}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold whitespace-nowrap font-mono-num ${
                              tx.type === 'transfer'
                                ? 'text-[#39A0ED]'
                                : isPositive
                                  ? 'text-[#28C997]'
                                  : 'text-[#F16C78]'
                            }`}
                          >
                            {tx.type === 'transfer' ? '' : isPositive ? '+' : '-'}
                            {formatCurrency(
                              Math.abs(tx.amount),
                              prefs.currency,
                              prefs.numberFormat,
                              prefs.hideAmounts
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditTx(tx)}
                                className="rounded p-1.5 text-[#94A3B8] hover:bg-[#1B2940] hover:text-[#F5F7FA]"
                                title="Edit"
                                aria-label="Edit transaction"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicate(tx)}
                                className="rounded p-1.5 text-[#94A3B8] hover:bg-[#1B2940] hover:text-[#39A0ED]"
                                title="Duplicate"
                                aria-label="Duplicate transaction"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({
                                    kind: 'tx',
                                    id: tx.id,
                                    label: tx.description,
                                  })
                                }
                                className="rounded p-1.5 text-[#94A3B8] hover:bg-[#F16C78]/10 hover:text-[#F16C78]"
                                title="Delete"
                                aria-label="Delete transaction"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[#273449] px-4 py-3 text-xs text-[#94A3B8]">
                  <span>
                    Page {page} of {totalPages} · {filteredTx.length} total records
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="rounded border border-[#273449] px-3 py-1 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded border border-[#273449] px-3 py-1 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-[#273449] bg-[#101827] px-4 py-3 text-xs text-[#94A3B8]">
            Recurring templates track expected repeating income and bills. Savern never silently
            creates duplicate transactions—confirm each occurrence explicitly when it clears.
          </div>

          {liveRecurring.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="No recurring rules yet"
              description="Create recurring templates for rent, salary, or subscriptions to track upcoming due dates."
              actionLabel="Add Recurring Rule"
              onAction={() => {
                setRecAccount(accounts[0]?.id || '');
                setRecOpen(true);
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {liveRecurring.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-xl border border-[#273449] bg-[#151F30] p-5 flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#F5F7FA]">{rec.description}</p>
                      <p className="mt-1 text-xs text-[#94A3B8]">
                        {rec.category} · {rec.frequency} · Next:{' '}
                        {formatDateDisplay(rec.nextDate, prefs.dateFormat)}
                      </p>
                    </div>
                    <span
                      className={`text-base font-bold font-mono-num ${
                        rec.type === 'income' ? 'text-[#28C997]' : 'text-[#F16C78]'
                      }`}
                    >
                      {formatCurrency(rec.amount, prefs.currency, prefs.numberFormat, prefs.hideAmounts)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#273449] pt-3">
                    <span className="text-xs text-[#94A3B8]">
                      Account: {accountMap.get(rec.accountId) || 'Account'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRecordRecurringOccurrence(rec)}
                        className="rounded-lg bg-[#24D6A0]/15 border border-[#24D6A0]/40 px-3 py-1 text-xs font-medium text-[#24D6A0] hover:bg-[#24D6A0]/25"
                      >
                        Record Occurrence
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({ kind: 'rec', id: rec.id, label: rec.description })
                        }
                        className="rounded p-1.5 text-[#94A3B8] hover:text-[#F16C78]"
                        aria-label="Delete recurring template"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Transaction Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTx ? 'Edit Transaction' : 'Add Transaction'}
      >
        <form onSubmit={handleSaveTx} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-[#F16C78]/40 bg-[#F16C78]/10 px-3 py-2 text-xs text-[#F16C78]">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 rounded-lg border border-[#273449] bg-[#101827] p-1">
            {(['expense', 'income', 'transfer'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTxType(t);
                  setCategory(t === 'income' ? 'Salary' : t === 'transfer' ? 'Transfer' : 'Food');
                }}
                className={`rounded-md py-1.5 text-xs font-semibold capitalize ${
                  txType === t ? 'bg-[#1B2940] text-[#24D6A0]' : 'text-[#94A3B8]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1">Description *</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {txType !== 'transfer' && (
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                >
                  {(txType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                {txType === 'transfer' ? 'From Account *' : 'Account *'}
              </label>
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

            {txType === 'transfer' && (
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                  To Account *
                </label>
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
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1">Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1">Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {txType === 'expense' && (
            <label className="flex items-center gap-2 text-xs text-[#94A3B8] cursor-pointer">
              <input
                type="checkbox"
                checked={isRefund}
                onChange={(e) => setIsRefund(e.target.checked)}
              />
              <span>Refund transaction (credits account &amp; offsets expense category)</span>
            </label>
          )}

          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-[#273449] px-4 py-2 text-sm text-[#94A3B8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#24D6A0] px-5 py-2 text-sm font-semibold text-[#080D16]"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>

      {/* Recurring Rule Modal */}
      <Modal open={recOpen} onClose={() => setRecOpen(false)} title="Add Recurring Rule">
        <form onSubmit={handleSaveRecurring} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#273449] bg-[#101827] p-1">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setRecType(t);
                  setRecCat(t === 'income' ? 'Salary' : 'Rent');
                }}
                className={`rounded-md py-1.5 text-xs font-semibold capitalize ${
                  recType === t ? 'bg-[#1B2940] text-[#24D6A0]' : 'text-[#94A3B8]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={recAmount}
                onChange={(e) => setRecAmount(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Description *</label>
              <input
                type="text"
                value={recDesc}
                onChange={(e) => setRecDesc(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Category</label>
              <select
                value={recCat}
                onChange={(e) => setRecCat(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              >
                {(recType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Account</label>
              <select
                value={recAccount}
                onChange={(e) => setRecAccount(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Frequency</label>
              <select
                value={recFreq}
                onChange={(e) => setRecFreq(e.target.value as any)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom interval (days)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Next Expected Date</label>
              <input
                type="date"
                value={recNextDate}
                onChange={(e) => setRecNextDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
          </div>
          {recFreq === 'custom' && (
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Interval (Days)</label>
              <input
                type="number"
                min="1"
                value={recCustomDays}
                onChange={(e) => setRecCustomDays(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setRecOpen(false)}
              className="rounded-lg border border-[#273449] px-4 py-2 text-sm text-[#94A3B8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#24D6A0] px-5 py-2 text-sm font-semibold text-[#080D16]"
            >
              Save Template
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Record"
        message={`Are you sure you want to delete "${deleteTarget?.label}"? This updates your account balance immediately.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === 'tx') await deleteEntity('transactions', deleteTarget.id);
          else await deleteEntity('recurringTransactions', deleteTarget.id);
          showToast('Record deleted', 'info');
        }}
      />
    </div>
  );
};
