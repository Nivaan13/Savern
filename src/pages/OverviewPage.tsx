import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  Lightbulb,
  PieChart as PieIcon,
  Plus,
  Receipt,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useSavern } from '../context/SavernContext.tsx';
import {
  activeRecords,
  calculateBudgetSummary,
  calculateCashFlowForMonth,
  calculateGoalProgress,
  calculateLoanSummary,
  calculateMonthlyComparison,
  calculatePortfolioSummary,
  calculateTotalBalances,
  formatCurrency,
  formatDateDisplay,
  generateFinancialInsights,
  getCategoryColor,
  getMonthKey,
  getTimeGreeting,
  getTodayISO,
} from '../lib/financeEngine.ts';
import { EmptyState } from '../components/ui/EmptyState.tsx';

type ChartView = 'weekly' | 'monthly' | 'yearly';

export const OverviewPage: React.FC = () => {
  const { user, isDemoMode, data, toggleHideAmounts, setQuickAddMode } = useSavern();
  const navigate = useNavigate();
  const [chartView, setChartView] = useState<ChartView>('monthly');

  const prefs = data.userPreferences;
  const hide = prefs.hideAmounts;
  const fmt = (val: number) => formatCurrency(val, prefs.currency, prefs.numberFormat, hide);
  const today = getTodayISO();
  const curMonth = getMonthKey(today);

  const displayName =
    user && !isDemoMode ? user.displayName?.split(' ')[0] || 'Member' : 'Alex';

  const balances = useMemo(
    () => calculateTotalBalances(data.accounts, data.transactions),
    [data.accounts, data.transactions]
  );

  const curFlow = useMemo(
    () => calculateCashFlowForMonth(data.transactions, curMonth),
    [data.transactions, curMonth]
  );

  const comparison = useMemo(
    () => calculateMonthlyComparison(data.transactions, today),
    [data.transactions, today]
  );

  const budgetSummary = useMemo(
    () => calculateBudgetSummary(data.budgets, data.transactions, curMonth),
    [data.budgets, data.transactions, curMonth]
  );

  const loanSummary = useMemo(
    () => calculateLoanSummary(data.loans, data.loanPayments, data.emiPlans, today),
    [data.loans, data.loanPayments, data.emiPlans, today]
  );

  const portfolio = useMemo(
    () => calculatePortfolioSummary(data.investments, data.sipPlans),
    [data.investments, data.sipPlans]
  );

  const insights = useMemo(() => generateFinancialInsights(data, today), [data, today]);

  const activeGoals = useMemo(
    () =>
      activeRecords(data.savingsGoals).map((g) => ({
        goal: g,
        progress: calculateGoalProgress(g, data.savingsContributions, today),
      })),
    [data.savingsGoals, data.savingsContributions, today]
  );

  const totalGoalSaved = activeGoals.reduce((sum, g) => sum + g.progress.savedAmount, 0);

  // Spending Overview Series
  const chartSeries = useMemo(() => {
    const liveTx = activeRecords(data.transactions);
    if (chartView === 'weekly') {
      const days: Array<{ label: string; income: number; expenses: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const dt = new Date(`${today}T00:00:00`);
        dt.setDate(dt.getDate() - i);
        const iso = dt.toISOString().slice(0, 10);
        const dayTx = liveTx.filter((t) => t.date === iso);
        const income = dayTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expenses = dayTx
          .filter((t) => t.type === 'expense')
          .reduce((s, t) => s + (t.isRefund ? -t.amount : t.amount), 0);
        days.push({
          label: dt.toLocaleDateString('en-IN', { weekday: 'short' }),
          income,
          expenses: Math.max(0, expenses),
        });
      }
      return days;
    }

    if (chartView === 'yearly') {
      const months: Array<{ label: string; income: number; expenses: number }> = [];
      const base = new Date(`${today}T00:00:00`);
      for (let i = 11; i >= 0; i--) {
        const dt = new Date(base.getFullYear(), base.getMonth() - i, 1);
        const mKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        const flow = calculateCashFlowForMonth(liveTx, mKey);
        months.push({
          label: dt.toLocaleDateString('en-IN', { month: 'short' }),
          income: flow.income,
          expenses: flow.expenses,
        });
      }
      return months;
    }

    // Monthly view: group into 4-5 day buckets across current month
    const [y, m] = curMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const buckets: Array<{ label: string; income: number; expenses: number }> = [];
    for (let start = 1; start <= daysInMonth; start += 5) {
      const end = Math.min(daysInMonth, start + 4);
      let income = 0;
      let expenses = 0;
      for (const tx of liveTx) {
        if (!tx.date.startsWith(curMonth)) continue;
        const d = Number(tx.date.slice(8, 10));
        if (d >= start && d <= end) {
          if (tx.type === 'income') income += tx.amount;
          if (tx.type === 'expense') expenses += tx.isRefund ? -tx.amount : tx.amount;
        }
      }
      buckets.push({
        label: `${start}–${end}`,
        income,
        expenses: Math.max(0, expenses),
      });
    }
    return buckets;
  }, [data.transactions, chartView, today, curMonth]);

  // Donut category breakdown
  const categoryBreakdown = useMemo(() => {
    const entries = Object.entries(curFlow.byCategory)
      .filter(([, val]) => val > 0)
      .map(([name, value]) => ({
        name,
        value,
        pct: curFlow.expenses > 0 ? Math.round((value / curFlow.expenses) * 1000) / 10 : 0,
        color: getCategoryColor(name),
      }))
      .sort((a, b) => b.value - a.value);
    return entries;
  }, [curFlow]);

  const recentTx = useMemo(() => {
    const accountMap = new Map(activeRecords(data.accounts).map((a) => [a.id, a.name]));
    return activeRecords(data.transactions)
      .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
      .slice(0, 7)
      .map((tx) => ({
        ...tx,
        accountName: accountMap.get(tx.accountId) || 'Account',
      }));
  }, [data.transactions, data.accounts]);

  const upcomingPayments = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      kind: string;
      dueDate: string;
      amount: number;
      route: string;
    }> = [];

    for (const emi of activeRecords(data.emiPlans)) {
      if (emi.installmentsPaid < emi.totalTenureMonths) {
        items.push({
          id: `emi_${emi.id}`,
          title: emi.loanName,
          kind: 'EMI',
          dueDate: emi.nextPaymentDate,
          amount: emi.emiAmount,
          route: '/loans',
        });
      }
    }
    for (const loan of loanSummary.enrichedLoans) {
      if (loan.outstanding > 0 && loan.direction !== 'lent') {
        items.push({
          id: `loan_${loan.id}`,
          title: loan.title,
          kind: 'Loan Repayment',
          dueDate: loan.dueDate,
          amount: loan.outstanding,
          route: '/loans',
        });
      }
    }
    for (const sip of activeRecords(data.sipPlans)) {
      if (sip.status === 'active') {
        items.push({
          id: `sip_${sip.id}`,
          title: sip.sipName,
          kind: 'SIP',
          dueDate: sip.nextInstallmentDate,
          amount: sip.monthlyAmount,
          route: '/investments',
        });
      }
    }
    for (const rec of activeRecords(data.recurringTransactions)) {
      if (rec.isActive && rec.type === 'expense') {
        items.push({
          id: `rec_${rec.id}`,
          title: rec.description,
          kind: 'Recurring',
          dueDate: rec.nextDate,
          amount: rec.amount,
          route: '/transactions',
        });
      }
    }
    return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);
  }, [data.emiPlans, data.sipPlans, data.recurringTransactions, loanSummary.enrichedLoans]);

  const summaryCards = [
    {
      label: 'Total Income',
      value: fmt(curFlow.income),
      delta: comparison.incomeChangePct,
      sub: 'This month',
      icon: ArrowUpRight,
      tone: 'text-[#28C997]',
    },
    {
      label: 'Total Expenses',
      value: fmt(curFlow.expenses),
      delta: comparison.expenseChangePct,
      sub: `MTD vs prev (${comparison.dayCutoff}d)`,
      icon: ArrowDownRight,
      tone: 'text-[#F16C78]',
    },
    {
      label: 'Remaining Budget',
      value:
        budgetSummary.totalBudgetLimit > 0
          ? fmt(budgetSummary.remainingBudget)
          : 'Not set',
      delta: null,
      sub:
        budgetSummary.totalBudgetLimit > 0
          ? `${budgetSummary.usedPct}% of ${fmt(budgetSummary.totalBudgetLimit)} used`
          : 'Set a monthly budget',
      icon: PieIcon,
      tone: budgetSummary.remainingBudget < 0 ? 'text-[#F16C78]' : 'text-[#39A0ED]',
    },
    {
      label: 'Goal Savings',
      value: fmt(totalGoalSaved),
      delta: null,
      sub: `${activeGoals.length} active goal${activeGoals.length === 1 ? '' : 's'}`,
      icon: Target,
      tone: 'text-[#24D6A0]',
    },
    {
      label: 'Outstanding Debt',
      value: fmt(loanSummary.totalOutstandingDebt),
      delta: null,
      sub: `EMI ${fmt(loanSummary.monthlyEmiObligation)}/mo`,
      icon: CreditCard,
      tone: 'text-[#F6B94A]',
    },
    {
      label: 'Total Investments',
      value: fmt(portfolio.currentValue),
      delta: portfolio.totalInvested > 0 ? portfolio.absoluteReturnPct : null,
      sub: `Invested ${fmt(portfolio.totalInvested)}`,
      icon: TrendingUp,
      tone: portfolio.profitLoss >= 0 ? 'text-[#28C997]' : 'text-[#F16C78]',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F7FA]">
            {getTimeGreeting(displayName)}
          </h2>
          <p className="mt-1 text-sm text-[#94A3B8]">
            {formatDateDisplay(today, prefs.dateFormat)}
            <span aria-hidden="true"> · </span>
            <span>Financial Overview &amp; Cash Flow</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleHideAmounts}
            className="flex items-center gap-2 rounded-lg border border-[#273449] bg-[#151F30] px-3.5 py-2 text-xs font-medium text-[#F5F7FA] hover:bg-[#1B2940] whitespace-nowrap"
          >
            {hide ? <Eye className="h-3.5 w-3.5 text-[#39A0ED]" /> : <EyeOff className="h-3.5 w-3.5 text-[#94A3B8]" />}
            <span>{hide ? 'Reveal Amounts' : 'Hide Amounts'}</span>
          </button>
          <button
            type="button"
            onClick={() => setQuickAddMode('expense')}
            className="flex items-center gap-1.5 rounded-lg bg-[#24D6A0] px-4 py-2 text-xs font-semibold text-[#080D16] hover:bg-[#28C997] whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Main Balance Hero Card */}
      <section className="rounded-xl border border-[#273449] bg-[#151F30] p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#94A3B8]">
              <Wallet className="h-4 w-4 text-[#24D6A0]" />
              <span>Total Available Balance</span>
              <span aria-hidden="true">·</span>
              <span>{activeRecords(data.accounts).length} tracked accounts</span>
            </div>
            <p className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#F5F7FA] font-mono-num">
              {fmt(balances.totalAvailable)}
            </p>
            <p className="mt-2 text-xs text-[#94A3B8]">
              Calculated from manually tracked opening balances, income, expenses, and transfers.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 lg:gap-6 border-t lg:border-t-0 lg:border-l border-[#273449] pt-4 lg:pt-0 lg:pl-6">
            <div>
              <p className="text-xs text-[#94A3B8]">Cash Balance</p>
              <p className="mt-1 text-base font-semibold text-[#F5F7FA] font-mono-num">
                {fmt(balances.cashBalance)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8]">Bank Balance</p>
              <p className="mt-1 text-base font-semibold text-[#F5F7FA] font-mono-num">
                {fmt(balances.bankBalance)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8]">Month Income</p>
              <p className="mt-1 text-base font-semibold text-[#28C997] font-mono-num">
                +{fmt(curFlow.income)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8]">Month Expenses</p>
              <p className="mt-1 text-base font-semibold text-[#F16C78] font-mono-num">
                -{fmt(curFlow.expenses)}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs text-[#94A3B8]">Net Cash Flow</p>
              <p
                className={`mt-1 text-base font-semibold font-mono-num ${
                  curFlow.netCashFlow >= 0 ? 'text-[#28C997]' : 'text-[#F16C78]'
                }`}
              >
                {curFlow.netCashFlow >= 0 ? '+' : ''}
                {fmt(curFlow.netCashFlow)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6 Financial Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-[#273449] bg-[#151F30] p-5 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#94A3B8]">{card.label}</span>
                <Icon className={`h-4 w-4 ${card.tone}`} />
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <span className="font-display text-2xl font-bold text-[#F5F7FA] font-mono-num">
                  {card.value}
                </span>
                {card.delta !== null && card.delta !== undefined && (
                  <span
                    className={`text-xs font-semibold font-mono-num ${
                      card.delta >= 0 ? 'text-[#28C997]' : 'text-[#F16C78]'
                    }`}
                  >
                    {card.delta > 0 ? '+' : ''}
                    {card.delta}%
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-[#94A3B8]">{card.sub}</p>
            </div>
          );
        })}
      </section>

      {/* Charts Row: Spending Overview + Category Breakdown Donut */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 rounded-xl border border-[#273449] bg-[#151F30] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-semibold text-[#F5F7FA]">
                Spending &amp; Income Overview
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Income vs expense comparison across {chartView} intervals
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-[#273449] bg-[#101827] p-1">
              {(['weekly', 'monthly', 'yearly'] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setChartView(view)}
                  className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    chartView === view
                      ? 'bg-[#1B2940] text-[#24D6A0]'
                      : 'text-[#94A3B8] hover:text-[#F5F7FA]'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>

          <div className="h-72 w-full">
            {chartSeries.every((d) => d.income === 0 && d.expenses === 0) ? (
              <div className="flex h-full items-center justify-center text-sm text-[#94A3B8]">
                No income or expense records for this timeframe yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartView === 'yearly' ? (
                  <AreaChart data={chartSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#28C997" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#28C997" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F16C78" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#F16C78" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#273449" vertical={false} />
                    <XAxis dataKey="label" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#101827',
                        borderColor: '#273449',
                        borderRadius: '8px',
                        color: '#F5F7FA',
                        fontSize: '12px',
                      }}
                      formatter={(val: unknown) => fmt(Number(val) || 0)}
                    />
                    <Area
                      type="monotone"
                      dataKey="income"
                      name="Income"
                      stroke="#28C997"
                      fillOpacity={1}
                      fill="url(#incArea)"
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      name="Expenses"
                      stroke="#F16C78"
                      fillOpacity={1}
                      fill="url(#expArea)"
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={chartSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#273449" vertical={false} />
                    <XAxis dataKey="label" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#101827',
                        borderColor: '#273449',
                        borderRadius: '8px',
                        color: '#F5F7FA',
                        fontSize: '12px',
                      }}
                      formatter={(val: unknown) => fmt(Number(val) || 0)}
                    />
                    <Bar dataKey="income" name="Income" fill="#28C997" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#F16C78" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Breakdown Donut */}
        <div className="xl:col-span-5 rounded-xl border border-[#273449] bg-[#151F30] p-5 flex flex-col">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-[#F5F7FA]">
              Expense Category Breakdown
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Click any category to view matching transactions
            </p>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-[#94A3B8] py-12">
              No expenses recorded this month yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center flex-1">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={2}
                      onClick={(entry) => {
                        if (entry?.name) {
                          navigate(`/transactions?category=${encodeURIComponent(entry.name)}`);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {categoryBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="#151F30" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#101827',
                        borderColor: '#273449',
                        borderRadius: '8px',
                        color: '#F5F7FA',
                        fontSize: '12px',
                      }}
                      formatter={(val: unknown) => fmt(Number(val) || 0)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {categoryBreakdown.map((cat) => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() =>
                      navigate(`/transactions?category=${encodeURIComponent(cat.name)}`)
                    }
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[#1B2940]"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="truncate text-[#F5F7FA]">{cat.name}</span>
                    </span>
                    <span className="shrink-0 font-mono-num text-[#94A3B8]">
                      {fmt(cat.value)} · {cat.pct}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Bottom Grid: Recent Transactions, Upcoming Payments, Savings Goals, Insights */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Recent Transactions */}
        <div className="xl:col-span-7 rounded-xl border border-[#273449] bg-[#151F30] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#F5F7FA]">Recent Transactions</h3>
            <button
              type="button"
              onClick={() => navigate('/transactions')}
              className="text-xs font-medium text-[#39A0ED] hover:underline"
            >
              View All
            </button>
          </div>

          {recentTx.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No transactions recorded"
              description="You haven't recorded any transactions yet. Start by adding your first income or expense."
              actionLabel="Add Expense"
              onAction={() => setQuickAddMode('expense')}
            />
          ) : (
            <div className="divide-y divide-[#273449]">
              {recentTx.map((tx) => {
                const isPos =
                  tx.type === 'income' || (tx.type === 'expense' && tx.isRefund) || (tx.type === 'adjustment' && tx.amount > 0);
                return (
                  <div key={tx.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#F5F7FA]">
                        {tx.description}
                      </p>
                      <p className="mt-0.5 text-xs text-[#94A3B8]">
                        {tx.category}
                        <span aria-hidden="true"> · </span>
                        {tx.accountName}
                        <span aria-hidden="true"> · </span>
                        {formatDateDisplay(tx.date, prefs.dateFormat)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-semibold font-mono-num ${
                          tx.type === 'transfer'
                            ? 'text-[#39A0ED]'
                            : isPos
                              ? 'text-[#28C997]'
                              : 'text-[#F16C78]'
                        }`}
                      >
                        {tx.type === 'transfer' ? '' : isPos ? '+' : '-'}
                        {fmt(Math.abs(tx.amount))}
                      </p>
                      <p className="text-[11px] capitalize text-[#94A3B8]">
                        {tx.isRefund ? 'Refund' : tx.type}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Upcoming Payments + Savings Preview + Insights */}
        <div className="xl:col-span-5 space-y-6">
          {/* Upcoming Payments */}
          <div className="rounded-xl border border-[#273449] bg-[#151F30] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-[#F6B94A]" />
                <h3 className="text-base font-semibold text-[#F5F7FA]">Upcoming Payments</h3>
              </div>
              <button
                type="button"
                onClick={() => navigate('/calendar')}
                className="text-xs font-medium text-[#39A0ED] hover:underline"
              >
                Calendar
              </button>
            </div>
            {upcomingPayments.length === 0 ? (
              <p className="text-xs text-[#94A3B8] py-4">
                No upcoming EMIs, loan repayments, or SIP installments scheduled.
              </p>
            ) : (
              <div className="divide-y divide-[#273449]">
                {upcomingPayments.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.route)}
                    className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-[#1B2940]/60 rounded px-1"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#F5F7FA]">{item.title}</p>
                      <p className="text-xs text-[#94A3B8]">
                        {item.kind}
                        <span aria-hidden="true"> · </span>
                        Due {formatDateDisplay(item.dueDate, prefs.dateFormat)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[#F6B94A] font-mono-num shrink-0">
                      {fmt(item.amount)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Savings Goals Preview */}
          <div className="rounded-xl border border-[#273449] bg-[#151F30] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-[#24D6A0]" />
                <h3 className="text-base font-semibold text-[#F5F7FA]">Savings Goals</h3>
              </div>
              <button
                type="button"
                onClick={() => navigate('/goals')}
                className="text-xs font-medium text-[#39A0ED] hover:underline"
              >
                Manage
              </button>
            </div>
            {activeGoals.length === 0 ? (
              <p className="text-xs text-[#94A3B8] py-3">
                Every big achievement starts with a goal. Create your first savings goal.
              </p>
            ) : (
              <div className="space-y-4">
                {activeGoals.slice(0, 3).map(({ goal, progress }) => (
                  <div key={goal.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#F5F7FA] truncate">{goal.name}</span>
                      <span className="font-mono-num text-[#24D6A0]">
                        {progress.progressPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#101827]">
                      <div
                        className="h-full bg-[#24D6A0] transition-all"
                        style={{ width: `${Math.min(100, progress.progressPct)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-[#94A3B8] font-mono-num">
                      <span>Saved {fmt(progress.savedAmount)}</span>
                      <span>Remaining {fmt(progress.remainingAmount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Real Data-Driven Financial Insights */}
          <div className="rounded-xl border border-[#273449] bg-[#151F30] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-[#39A0ED]" />
              <h3 className="text-base font-semibold text-[#F5F7FA]">Financial Insights</h3>
            </div>
            <ul className="space-y-2.5 text-xs leading-relaxed text-[#94A3B8]">
              {insights.map((text, idx) => (
                <li key={idx} className="border-b border-[#273449]/60 pb-2 last:border-b-0 last:pb-0">
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};
