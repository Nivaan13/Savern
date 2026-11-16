import React, { useMemo, useState } from 'react';
import { PieChart as PieIcon, Plus, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSavern } from '../context/SavernContext.tsx';
import { Budget, EXPENSE_CATEGORIES } from '../types/finance.ts';
import {
  activeRecords,
  calculateBudgetSummary,
  calculateCashFlowForMonth,
  formatCurrency,
  getMonthKey,
  getPreviousMonthKey,
  getTodayISO,
} from '../lib/financeEngine.ts';
import { Modal } from '../components/ui/Modal.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.tsx';

export const BudgetsPage: React.FC = () => {
  const { data, saveEntity, deleteEntity, showToast } = useSavern();
  const prefs = data.userPreferences;
  const currentMonth = getMonthKey(getTodayISO());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const summary = useMemo(
    () => calculateBudgetSummary(data.budgets, data.transactions, selectedMonth),
    [data.budgets, data.transactions, selectedMonth]
  );

  // Historical budget review across months present in budgets or last 6 months
  const historyRows = useMemo(() => {
    const months = new Set<string>([currentMonth, getPreviousMonthKey(currentMonth)]);
    for (const b of activeRecords(data.budgets)) {
      months.add(b.monthKey);
    }
    return Array.from(months)
      .sort((a, b) => b.localeCompare(a))
      .map((mKey) => {
        const bSum = calculateBudgetSummary(data.budgets, data.transactions, mKey);
        const flow = calculateCashFlowForMonth(data.transactions, mKey);
        const diff = bSum.totalBudgetLimit > 0 ? bSum.totalBudgetLimit - flow.expenses : 0;
        const pct =
          bSum.totalBudgetLimit > 0
            ? Math.round((flow.expenses / bSum.totalBudgetLimit) * 1000) / 10
            : 0;
        return {
          monthKey: mKey,
          budgeted: bSum.totalBudgetLimit,
          actual: flow.expenses,
          diff,
          pct,
        };
      });
  }, [data.budgets, data.transactions, currentMonth]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [category, setCategory] = useState('TOTAL');
  const [limitAmount, setLimitAmount] = useState('');
  const [thresholds, setThresholds] = useState<number[]>([50, 75, 90, 100]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openModal = (b?: Budget) => {
    if (b) {
      setEditingBudget(b);
      setCategory(b.category);
      setLimitAmount(String(b.limitAmount));
      setThresholds(b.alertThresholds);
    } else {
      setEditingBudget(null);
      setCategory(summary.totalBudgetRecord ? 'Food' : 'TOTAL');
      setLimitAmount('');
      setThresholds([50, 75, 90, 100]);
    }
    setModalOpen(true);
  };

  const toggleThreshold = (t: number) => {
    setThresholds((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].sort((a, b) => a - b)
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = Number(limitAmount);
    if (!Number.isFinite(limit) || limit <= 0) return;

    const existingForCat = activeRecords(data.budgets).find(
      (b) => b.monthKey === selectedMonth && b.category === category
    );

    await saveEntity('budgets', {
      id: editingBudget?.id || existingForCat?.id,
      monthKey: selectedMonth,
      category,
      limitAmount: limit,
      alertThresholds: thresholds,
      triggeredThresholds: editingBudget?.triggeredThresholds || existingForCat?.triggeredThresholds || [],
    });
    showToast('Budget saved', 'success');
    setModalOpen(false);
  };

  const fmt = (v: number) => formatCurrency(v, prefs.currency, prefs.numberFormat, prefs.hideAmounts);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-[#94A3B8]" htmlFor="budget-month">
            Budget Month
          </label>
          <input
            id="budget-month"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-[#273449] bg-[#151F30] px-3 py-1.5 text-sm text-[#F5F7FA]"
          />
        </div>

        <button
          type="button"
          onClick={() => openModal()}
          className="flex items-center gap-1.5 rounded-lg bg-[#24D6A0] px-4 py-2 text-xs font-semibold text-[#080D16] hover:bg-[#28C997]"
        >
          <Plus className="h-4 w-4" />
          <span>Set Budget</span>
        </button>
      </div>

      {/* Overall Monthly Budget Card */}
      {summary.totalBudgetRecord ? (
        <div className="rounded-xl border border-[#273449] bg-[#151F30] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[#94A3B8]">Monthly Total Budget · {selectedMonth}</p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-display text-3xl font-bold text-[#F5F7FA] font-mono-num">
                  {fmt(summary.totalSpent)}
                </span>
                <span className="text-sm text-[#94A3B8] font-mono-num">
                  of {fmt(summary.totalBudgetLimit)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-[#94A3B8]">Remaining</p>
                <p
                  className={`text-lg font-bold font-mono-num ${
                    summary.remainingBudget < 0 ? 'text-[#F16C78]' : 'text-[#28C997]'
                  }`}
                >
                  {fmt(summary.remainingBudget)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openModal(summary.totalBudgetRecord)}
                className="rounded-lg border border-[#273449] bg-[#101827] px-3 py-1.5 text-xs text-[#F5F7FA] hover:bg-[#1B2940]"
              >
                Edit
              </button>
            </div>
          </div>

          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-[#101827]">
            <div
              className={`h-full transition-all ${
                summary.usedPct >= 100
                  ? 'bg-[#F16C78]'
                  : summary.usedPct >= 75
                    ? 'bg-[#F6B94A]'
                    : 'bg-[#24D6A0]'
              }`}
              style={{ width: `${Math.min(100, summary.usedPct)}%` }}
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8]">
            <span className="font-mono-num">{summary.usedPct}% used</span>
            <span>
              Alert thresholds: {summary.totalBudgetRecord.alertThresholds.map((t) => `${t}%`).join(', ')}
            </span>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={PieIcon}
          title={`No total monthly budget for ${selectedMonth}`}
          description="Set a monthly expense ceiling to track remaining budget and trigger alerts at 50%, 75%, 90%, and 100%."
          actionLabel="Set Monthly Budget"
          onAction={() => openModal()}
        />
      )}

      {/* Category Budgets */}
      <div className="rounded-xl border border-[#273449] bg-[#151F30] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#F5F7FA]">Category Budgets</h3>
          <span className="text-xs text-[#94A3B8]">
            {summary.categoryBudgets.length} configured
          </span>
        </div>

        {summary.categoryBudgets.length === 0 ? (
          <p className="text-xs text-[#94A3B8] py-4">
            Add category-specific limits (Food, Shopping, Travel, Bills, etc.) using Set Budget.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summary.categoryBudgets.map((cb) => (
              <div
                key={cb.id}
                className="rounded-xl border border-[#273449] bg-[#101827] p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#F5F7FA]">{cb.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono-num text-[#94A3B8]">
                      {cb.usedPct}% used
                    </span>
                    <button
                      type="button"
                      onClick={() => openModal(cb)}
                      className="text-xs text-[#39A0ED] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(cb.id)}
                      className="text-[#94A3B8] hover:text-[#F16C78]"
                      aria-label="Delete category budget"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#151F30]">
                  <div
                    className={`h-full ${
                      cb.usedPct >= 100
                        ? 'bg-[#F16C78]'
                        : cb.usedPct >= 75
                          ? 'bg-[#F6B94A]'
                          : 'bg-[#24D6A0]'
                    }`}
                    style={{ width: `${Math.min(100, cb.usedPct)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-[#94A3B8] font-mono-num">
                  <span>Spent: {fmt(cb.spent)}</span>
                  <span>Limit: {fmt(cb.limitAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Budget vs Actual Chart + History */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-6 rounded-xl border border-[#273449] bg-[#151F30] p-5">
          <h3 className="text-base font-semibold text-[#F5F7FA] mb-4">
            Category Budget vs Actual
          </h3>
          <div className="h-64 w-full">
            {summary.categoryBudgets.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-[#94A3B8]">
                Configure category budgets to visualize consumption.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.categoryBudgets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#273449" vertical={false} />
                  <XAxis dataKey="category" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#101827',
                      borderColor: '#273449',
                      borderRadius: '8px',
                      color: '#F5F7FA',
                    }}
                    formatter={(val: unknown) => fmt(Number(val) || 0)}
                  />
                  <Bar dataKey="limitAmount" name="Budget" fill="#39A0ED" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spent" name="Actual" fill="#24D6A0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="xl:col-span-6 rounded-xl border border-[#273449] bg-[#151F30] p-5">
          <h3 className="text-base font-semibold text-[#F5F7FA] mb-4">Budget History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#273449] text-[#94A3B8]">
                  <th className="py-2">Month</th>
                  <th className="py-2 text-right">Budgeted</th>
                  <th className="py-2 text-right">Actual</th>
                  <th className="py-2 text-right">Difference</th>
                  <th className="py-2 text-right">Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#273449]">
                {historyRows.map((row) => (
                  <tr key={row.monthKey}>
                    <td className="py-2.5 font-mono-num text-[#F5F7FA]">{row.monthKey}</td>
                    <td className="py-2.5 text-right font-mono-num text-[#94A3B8]">
                      {row.budgeted > 0 ? fmt(row.budgeted) : '—'}
                    </td>
                    <td className="py-2.5 text-right font-mono-num text-[#F5F7FA]">
                      {fmt(row.actual)}
                    </td>
                    <td
                      className={`py-2.5 text-right font-mono-num ${
                        row.diff >= 0 ? 'text-[#28C997]' : 'text-[#F16C78]'
                      }`}
                    >
                      {row.budgeted > 0 ? fmt(row.diff) : '—'}
                    </td>
                    <td className="py-2.5 text-right font-mono-num text-[#94A3B8]">
                      {row.budgeted > 0 ? `${row.pct}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBudget ? 'Update Budget' : 'Configure Budget'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Scope / Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={!!editingBudget}
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
            >
              <option value="TOTAL">TOTAL — Overall Monthly Budget</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">
              Monthly Limit ({prefs.currency}) *
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={limitAmount}
              onChange={(e) => setLimitAmount(e.target.value)}
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              required
            />
          </div>
          <div>
            <p className="text-xs text-[#94A3B8] mb-2">Alert Thresholds</p>
            <div className="flex flex-wrap gap-2">
              {[50, 75, 90, 100].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleThreshold(t)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium font-mono-num ${
                    thresholds.includes(t)
                      ? 'border-[#24D6A0] bg-[#24D6A0]/15 text-[#24D6A0]'
                      : 'border-[#273449] bg-[#101827] text-[#94A3B8]'
                  }`}
                >
                  {t}%
                </button>
              ))}
            </div>
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
              Save Budget
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Budget"
        message="Remove this budget limit for the selected month?"
        confirmLabel="Remove"
        onConfirm={async () => {
          if (deleteId) {
            await deleteEntity('budgets', deleteId);
            showToast('Budget deleted', 'info');
          }
        }}
      />
    </div>
  );
};
