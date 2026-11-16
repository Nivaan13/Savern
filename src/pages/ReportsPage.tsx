import React, { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useSavern } from '../context/SavernContext.tsx';
import { EXPENSE_CATEGORIES } from '../types/finance.ts';
import {
  activeRecords,
  calculateMonthlyComparison,
  exportTransactionsToCsv,
  formatCurrency,
  formatDateDisplay,
  getTodayISO,
} from '../lib/financeEngine.ts';
import { SavernLogo } from '../components/SavernLogo.tsx';

type DatePreset =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'current_month'
  | 'prev_month'
  | 'current_fy'
  | 'prev_fy'
  | 'custom';

function shiftDays(iso: string, delta: number): string {
  const dt = new Date(`${iso}T00:00:00`);
  dt.setDate(dt.getDate() + delta);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getPresetBounds(preset: DatePreset, fyStartMonth: number, today: string): [string, string] {
  const now = new Date(`${today}T00:00:00`);
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  if (preset === 'today') return [today, today];
  if (preset === 'yesterday') {
    const yest = shiftDays(today, -1);
    return [yest, yest];
  }
  if (preset === '7d') return [shiftDays(today, -6), today];
  if (preset === '30d') return [shiftDays(today, -29), today];
  if (preset === 'current_month') {
    return [`${y}-${String(m).padStart(2, '0')}-01`, today];
  }
  if (preset === 'prev_month') {
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    const lastDay = new Date(prevY, prevM, 0).getDate();
    return [
      `${prevY}-${String(prevM).padStart(2, '0')}-01`,
      `${prevY}-${String(prevM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    ];
  }
  if (preset === 'current_fy') {
    const fyYear = m >= fyStartMonth ? y : y - 1;
    return [`${fyYear}-${String(fyStartMonth).padStart(2, '0')}-01`, today];
  }
  if (preset === 'prev_fy') {
    const curFyYear = m >= fyStartMonth ? y : y - 1;
    const prevFyStart = curFyYear - 1;
    const endMonth = fyStartMonth === 1 ? 12 : fyStartMonth - 1;
    const endYear = fyStartMonth === 1 ? prevFyStart : curFyYear;
    const lastDay = new Date(endYear, endMonth, 0).getDate();
    return [
      `${prevFyStart}-${String(fyStartMonth).padStart(2, '0')}-01`,
      `${endYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    ];
  }
  return [shiftDays(today, -29), today];
}

export const ReportsPage: React.FC = () => {
  const { data, showToast } = useSavern();
  const prefs = data.userPreferences;
  const today = getTodayISO();

  const [preset, setPreset] = useState<DatePreset>('current_month');
  const [customStart, setCustomStart] = useState(shiftDays(today, -29));
  const [customEnd, setCustomEnd] = useState(today);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const [startDate, endDate] = useMemo(() => {
    if (preset === 'custom') return [customStart, customEnd];
    return getPresetBounds(preset, prefs.financialYearStartMonth || 4, today);
  }, [preset, customStart, customEnd, prefs.financialYearStartMonth, today]);

  const accounts = useMemo(() => activeRecords(data.accounts), [data.accounts]);
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  const filteredTx = useMemo(() => {
    return activeRecords(data.transactions)
      .filter((tx) => {
        if (tx.date < startDate || tx.date > endDate) return false;
        if (categoryFilter !== 'ALL' && tx.category !== categoryFilter) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.transactions, startDate, endDate, categoryFilter]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    const byCat: Record<string, number> = {};
    for (const tx of filteredTx) {
      if (tx.type === 'income') income += tx.amount;
      else if (tx.type === 'expense') {
        const eff = tx.isRefund ? -tx.amount : tx.amount;
        expense += eff;
        byCat[tx.category] = (byCat[tx.category] || 0) + eff;
      }
    }
    return {
      income,
      expense: Math.max(0, expense),
      net: income - Math.max(0, expense),
      categoryRows: Object.entries(byCat)
        .map(([category, amount]) => ({ category, amount: Math.max(0, amount) }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [filteredTx]);

  const comparison = useMemo(
    () => calculateMonthlyComparison(data.transactions, today),
    [data.transactions, today]
  );

  const fmt = (v: number) => formatCurrency(v, prefs.currency, prefs.numberFormat, prefs.hideAmounts);

  const handleExportCsv = () => {
    const csv = exportTransactionsToCsv(filteredTx, accounts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `savern-report-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('CSV report exported', 'success');
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Controls & Exports */}
      <div className="no-print rounded-xl border border-[#273449] bg-[#151F30] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['today', 'Today'],
                ['yesterday', 'Yesterday'],
                ['7d', 'Last 7d'],
                ['30d', 'Last 30d'],
                ['current_month', 'This Month'],
                ['prev_month', 'Last Month'],
                ['current_fy', 'Current FY'],
                ['prev_fy', 'Previous FY'],
                ['custom', 'Custom'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPreset(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  preset === key
                    ? 'bg-[#1B2940] text-[#24D6A0] border border-[#24D6A0]/40'
                    : 'bg-[#101827] text-[#94A3B8] border border-[#273449] hover:text-[#F5F7FA]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 rounded-lg border border-[#273449] bg-[#101827] px-3.5 py-2 text-xs font-medium text-[#F5F7FA] hover:bg-[#1B2940]"
            >
              <Download className="h-3.5 w-3.5 text-[#39A0ED]" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 rounded-lg bg-[#24D6A0] px-4 py-2 text-xs font-semibold text-[#080D16] hover:bg-[#28C997]"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / PDF Report</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {preset === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-[#273449] bg-[#101827] px-3 py-1.5 text-[#F5F7FA]"
              />
              <span className="text-[#94A3B8]">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-[#273449] bg-[#101827] px-3 py-1.5 text-[#F5F7FA]"
              />
            </div>
          )}

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#94A3B8]">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-[#273449] bg-[#101827] px-3 py-1.5 text-[#F5F7FA]"
            >
              <option value="ALL">All Categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-[#94A3B8] ml-auto">
            Showing {formatDateDisplay(startDate, prefs.dateFormat)} to{' '}
            {formatDateDisplay(endDate, prefs.dateFormat)} ({filteredTx.length} records)
          </span>
        </div>
      </div>

      {/* Printable Header (visible in print) */}
      <div className="hidden print:flex items-center justify-between border-b border-slate-300 pb-4 mb-4">
        <SavernLogo size="lg" />
        <div className="text-right text-xs">
          <p className="font-bold text-base">Financial Statement Report</p>
          <p>
            Period: {formatDateDisplay(startDate, prefs.dateFormat)} —{' '}
            {formatDateDisplay(endDate, prefs.dateFormat)}
          </p>
        </div>
      </div>

      {/* Period Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="print-surface rounded-xl border border-[#273449] bg-[#151F30] p-4">
          <p className="text-xs text-[#94A3B8]">Period Income</p>
          <p className="mt-1.5 font-display text-xl font-bold text-[#28C997] font-mono-num">
            {fmt(totals.income)}
          </p>
        </div>
        <div className="print-surface rounded-xl border border-[#273449] bg-[#151F30] p-4">
          <p className="text-xs text-[#94A3B8]">Period Expenses</p>
          <p className="mt-1.5 font-display text-xl font-bold text-[#F16C78] font-mono-num">
            {fmt(totals.expense)}
          </p>
        </div>
        <div className="print-surface rounded-xl border border-[#273449] bg-[#151F30] p-4">
          <p className="text-xs text-[#94A3B8]">Net Cash Flow</p>
          <p
            className={`mt-1.5 font-display text-xl font-bold font-mono-num ${
              totals.net >= 0 ? 'text-[#24D6A0]' : 'text-[#F16C78]'
            }`}
          >
            {totals.net >= 0 ? '+' : ''}
            {fmt(totals.net)}
          </p>
        </div>
      </div>

      {/* Monthly Comparison Engine */}
      <div className="print-surface rounded-xl border border-[#273449] bg-[#151F30] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-[#F5F7FA]">
              Monthly Comparison Engine (MTD Fair Comparison)
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Compares Days 1–{comparison.dayCutoff} of {comparison.currentMonth} (incomplete current
              month) against Days 1–{comparison.dayCutoff} of {comparison.prevMonth}
            </p>
          </div>
          {comparison.expenseChangePct !== null && (
            <span
              className={`text-xs font-semibold font-mono-num ${
                comparison.expenseChangePct <= 0 ? 'text-[#28C997]' : 'text-[#F16C78]'
              }`}
            >
              {comparison.expenseChangePct > 0 ? '+' : ''}
              {comparison.expenseChangePct}% MTD spend vs last month
            </span>
          )}
        </div>

        {comparison.categories.length === 0 ? (
          <p className="text-xs text-[#94A3B8] py-8 text-center">
            No expense records available across current or previous month-to-date.
          </p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-center">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison.categories.slice(0, 7)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#273449" vertical={false} />
                  <XAxis dataKey="category" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#101827',
                      borderColor: '#273449',
                      borderRadius: '8px',
                      color: '#F5F7FA',
                      fontSize: '12px',
                    }}
                    formatter={(value: unknown) => fmt(Number(value) || 0)}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="current"
                    name={`${comparison.currentMonth} (MTD)`}
                    fill="#24D6A0"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="previous"
                    name={`${comparison.prevMonth} (MTD)`}
                    fill="#39A0ED"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {comparison.categories.map((row) => (
                <div
                  key={row.category}
                  className="flex items-center justify-between rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-xs"
                >
                  <span className="font-medium text-[#F5F7FA]">{row.category}</span>
                  <div className="flex items-center gap-4 font-mono-num">
                    <span className="text-[#94A3B8]">Prev: {fmt(row.previous)}</span>
                    <span className="text-[#F5F7FA] font-semibold">Now: {fmt(row.current)}</span>
                    <span
                      className={`w-16 text-right ${
                        row.changePct === null
                          ? 'text-[#94A3B8]'
                          : row.changePct <= 0
                            ? 'text-[#28C997]'
                            : 'text-[#F16C78]'
                      }`}
                    >
                      {row.changePct === null
                        ? 'New'
                        : `${row.changePct > 0 ? '+' : ''}${row.changePct}%`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Category Summary + Ledger */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="print-surface rounded-xl border border-[#273449] bg-[#151F30] p-5">
          <h3 className="font-display text-sm font-semibold text-[#F5F7FA] mb-3">
            Selected Period Breakdown
          </h3>
          {totals.categoryRows.length === 0 ? (
            <p className="text-xs text-[#94A3B8]">No expenses in selected date range.</p>
          ) : (
            <div className="space-y-2.5">
              {totals.categoryRows.map((c) => {
                const pct =
                  totals.expense > 0 ? Math.round((c.amount / totals.expense) * 1000) / 10 : 0;
                return (
                  <div key={c.category} className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#F5F7FA]">{c.category}</span>
                      <span className="font-mono-num text-[#94A3B8]">
                        {fmt(c.amount)} · {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#101827] overflow-hidden">
                      <div
                        className="h-full bg-[#24D6A0]"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="xl:col-span-2 print-surface rounded-xl border border-[#273449] bg-[#151F30] overflow-hidden">
          <div className="border-b border-[#273449] px-5 py-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-[#F5F7FA]">
              Statement Transactions ({filteredTx.length})
            </h3>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#273449] bg-[#101827] text-[#94A3B8]">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Account</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#273449]">
                {filteredTx.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#94A3B8]">
                      No transactions in this period.
                    </td>
                  </tr>
                ) : (
                  filteredTx.slice(0, 100).map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-2.5 text-[#94A3B8] whitespace-nowrap">
                        {formatDateDisplay(tx.date, prefs.dateFormat)}
                      </td>
                      <td className="px-4 py-2.5 text-[#F5F7FA]">{tx.description}</td>
                      <td className="px-4 py-2.5 text-[#94A3B8]">{tx.category}</td>
                      <td className="px-4 py-2.5 text-[#94A3B8]">
                        {accountMap.get(tx.accountId) || '—'}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono-num font-semibold ${
                          tx.type === 'income' || tx.isRefund
                            ? 'text-[#28C997]'
                            : tx.type === 'expense'
                              ? 'text-[#F16C78]'
                              : 'text-[#39A0ED]'
                        }`}
                      >
                        {tx.type === 'income' || tx.isRefund ? '+' : tx.type === 'expense' ? '-' : ''}
                        {fmt(Math.abs(tx.amount))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
