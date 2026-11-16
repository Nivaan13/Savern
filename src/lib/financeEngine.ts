import {
  Account,
  Budget,
  EmiPlan,
  InsurancePolicy,
  Investment,
  Loan,
  LoanPayment,
  MedicalClaim,
  SavingsContribution,
  SavingsGoal,
  SipPlan,
  Transaction,
  WorkspaceData,
} from '../types/finance.ts';

export const CATEGORY_COLORS: Record<string, string> = {
  Food: '#24D6A0',
  Groceries: '#39A0ED',
  Transport: '#F6B94A',
  Shopping: '#A78BFA',
  Education: '#38BDF8',
  Entertainment: '#FB7185',
  Medical: '#F43F5E',
  Bills: '#F59E0B',
  Rent: '#818CF8',
  Travel: '#2DD4BF',
  'Personal care': '#E879F9',
  Salary: '#28C997',
  Freelance: '#39A0ED',
  'Investment Return': '#24D6A0',
  Reimbursement: '#60A5FA',
  Other: '#94A3B8',
};

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || '#94A3B8';
}

export function formatCurrency(
  amount: number,
  currency = 'INR',
  numberFormat: 'en-IN' | 'en-US' = 'en-IN',
  hideAmounts = false
): string {
  if (hideAmounts) {
    return currency === 'INR' ? '₹ ••••••' : `${currency} ••••••`;
  }
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(numberFormat, {
      style: 'currency',
      currency,
      maximumFractionDigits: Math.abs(safe % 1) > 0.001 ? 2 : 0,
    }).format(safe);
  } catch {
    const sign = safe < 0 ? '-' : '';
    return `${sign}${currency} ${Math.abs(safe).toLocaleString(numberFormat)}`;
  }
}

export function formatDateDisplay(
  dateStr: string,
  format: 'DD MMM YYYY' | 'YYYY-MM-DD' | 'DD/MM/YYYY' = 'DD MMM YYYY'
): string {
  if (!dateStr) return '—';
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  if (format === 'YYYY-MM-DD') return dateStr;
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  if (format === 'DD/MM/YYYY') return `${dd}/${mm}/${yyyy}`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dd} ${months[parsed.getMonth()]} ${yyyy}`;
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function getPreviousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function getTimeGreeting(name?: string | null): string {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${greeting}, ${name}` : greeting;
}

export function activeRecords<T extends { deletedAt?: string | null }>(items: T[]): T[] {
  return items.filter((item) => !item.deletedAt);
}

// Available balance = Opening balance + Income - Expenses + Incoming transfers - Outgoing transfers + Adjustments
export function calculateAccountBalance(account: Account, transactions: Transaction[]): number {
  let balance = Number(account.openingBalance) || 0;
  for (const tx of activeRecords(transactions)) {
    if (tx.type === 'income' && tx.accountId === account.id) {
      balance += tx.amount;
    } else if (tx.type === 'expense' && tx.accountId === account.id) {
      balance += tx.isRefund ? tx.amount : -tx.amount;
    } else if (tx.type === 'transfer') {
      if (tx.accountId === account.id) balance -= tx.amount;
      if (tx.toAccountId === account.id) balance += tx.amount;
    } else if (tx.type === 'adjustment' && tx.accountId === account.id) {
      balance += tx.amount;
    }
  }
  return Math.round(balance * 100) / 100;
}

export function calculateTotalBalances(accounts: Account[], transactions: Transaction[]) {
  const liveAccounts = activeRecords(accounts);
  let totalAvailable = 0;
  let cashBalance = 0;
  let bankBalance = 0;
  let otherBalance = 0;

  const perAccount = new Map<string, number>();

  for (const acc of liveAccounts) {
    const bal = calculateAccountBalance(acc, transactions);
    perAccount.set(acc.id, bal);
    totalAvailable += bal;
    if (acc.type === 'cash') cashBalance += bal;
    else if (acc.type === 'savings' || acc.type === 'current') bankBalance += bal;
    else otherBalance += bal;
  }

  return {
    totalAvailable: Math.round(totalAvailable * 100) / 100,
    cashBalance: Math.round(cashBalance * 100) / 100,
    bankBalance: Math.round(bankBalance * 100) / 100,
    otherBalance: Math.round(otherBalance * 100) / 100,
    perAccount,
  };
}

export function calculateCashFlowForMonth(
  transactions: Transaction[],
  monthKey: string,
  maxDayOfMonth?: number
) {
  let income = 0;
  let expenses = 0;
  const byCategory: Record<string, number> = {};

  for (const tx of activeRecords(transactions)) {
    if (tx.type !== 'income' && tx.type !== 'expense') continue;
    if (!tx.date.startsWith(monthKey)) continue;
    if (maxDayOfMonth !== undefined) {
      const day = Number(tx.date.slice(8, 10));
      if (day > maxDayOfMonth) continue;
    }
    if (tx.type === 'income') {
      income += tx.amount;
    } else {
      const effectiveExpense = tx.isRefund ? -tx.amount : tx.amount;
      expenses += effectiveExpense;
      byCategory[tx.category] = (byCategory[tx.category] || 0) + effectiveExpense;
    }
  }

  return {
    income: Math.round(income * 100) / 100,
    expenses: Math.round(Math.max(0, expenses) * 100) / 100,
    netCashFlow: Math.round((income - expenses) * 100) / 100,
    byCategory,
  };
}

export function calculatePercentageChange(current: number, previous: number): number | null {
  if (previous <= 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round((((current - previous) / previous) * 100) * 10) / 10;
}

export function calculateMonthlyComparison(transactions: Transaction[], referenceDate = getTodayISO()) {
  const currentMonth = getMonthKey(referenceDate);
  const prevMonth = getPreviousMonthKey(currentMonth);
  const todayDay = Number(referenceDate.slice(8, 10));

  // Fair MTD comparison for current month vs same days of previous month, plus full prev month
  const currentMTD = calculateCashFlowForMonth(transactions, currentMonth, todayDay);
  const prevMTD = calculateCashFlowForMonth(transactions, prevMonth, todayDay);
  const prevFull = calculateCashFlowForMonth(transactions, prevMonth);

  const categories = Array.from(
    new Set([
      ...Object.keys(currentMTD.byCategory),
      ...Object.keys(prevMTD.byCategory),
    ])
  ).map((category) => {
    const currentVal = Math.max(0, currentMTD.byCategory[category] || 0);
    const previousVal = Math.max(0, prevMTD.byCategory[category] || 0);
    return {
      category,
      current: currentVal,
      previous: previousVal,
      changePct: calculatePercentageChange(currentVal, previousVal),
    };
  });

  return {
    currentMonth,
    prevMonth,
    dayCutoff: todayDay,
    currentExpenses: currentMTD.expenses,
    prevMtdExpenses: prevMTD.expenses,
    prevFullExpenses: prevFull.expenses,
    currentIncome: currentMTD.income,
    prevMtdIncome: prevMTD.income,
    expenseChangePct: calculatePercentageChange(currentMTD.expenses, prevMTD.expenses),
    incomeChangePct: calculatePercentageChange(currentMTD.income, prevMTD.income),
    categories: categories.sort((a, b) => b.current - a.current),
  };
}

export function calculateBudgetSummary(
  budgets: Budget[],
  transactions: Transaction[],
  monthKey = getMonthKey(getTodayISO())
) {
  const monthBudgets = activeRecords(budgets).filter((b) => b.monthKey === monthKey);
  const { expenses, byCategory } = calculateCashFlowForMonth(transactions, monthKey);
  const totalBudgetRecord = monthBudgets.find((b) => b.category === 'TOTAL');
  const totalBudgetLimit = totalBudgetRecord ? totalBudgetRecord.limitAmount : 0;
  const remainingBudget = totalBudgetLimit > 0 ? totalBudgetLimit - expenses : 0;
  const usedPct = totalBudgetLimit > 0 ? Math.round((expenses / totalBudgetLimit) * 1000) / 10 : 0;

  const categoryBudgets = monthBudgets
    .filter((b) => b.category !== 'TOTAL')
    .map((b) => {
      const spent = Math.max(0, byCategory[b.category] || 0);
      const pct = b.limitAmount > 0 ? Math.round((spent / b.limitAmount) * 1000) / 10 : 0;
      return {
        ...b,
        spent,
        remaining: b.limitAmount - spent,
        usedPct: pct,
      };
    });

  return {
    monthKey,
    totalBudgetRecord,
    totalBudgetLimit,
    totalSpent: expenses,
    remainingBudget,
    usedPct,
    categoryBudgets,
  };
}

export function calculateGoalProgress(
  goal: SavingsGoal,
  contributions: SavingsContribution[],
  referenceDate = getTodayISO()
) {
  const goalContribs = activeRecords(contributions).filter((c) => c.goalId === goal.id);
  const contribSum = goalContribs.reduce((sum, c) => sum + c.amount, 0);
  const savedAmount = Math.round(((goal.initialSavedAmount || 0) + contribSum) * 100) / 100;
  const remainingAmount = Math.max(0, Math.round((goal.targetAmount - savedAmount) * 100) / 100);
  const exceededAmount = Math.max(0, Math.round((savedAmount - goal.targetAmount) * 100) / 100);
  const progressPct =
    goal.targetAmount > 0
      ? Math.min(100, Math.round((savedAmount / goal.targetAmount) * 10000) / 100)
      : 0;

  const ref = new Date(`${referenceDate}T00:00:00`);
  const target = new Date(`${goal.targetDate}T00:00:00`);
  const diffDays = Math.ceil((target.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
  const monthsRemaining = Math.max(0, Math.ceil(diffDays / 30));
  const targetPassed = diffDays < 0 && remainingAmount > 0;
  const requiredMonthlySavings =
    remainingAmount <= 0
      ? 0
      : monthsRemaining > 0
        ? Math.ceil(remainingAmount / monthsRemaining)
        : remainingAmount;

  return {
    savedAmount,
    remainingAmount,
    exceededAmount,
    isCompleted: savedAmount >= goal.targetAmount,
    progressPct,
    monthsRemaining,
    diffDays,
    targetPassed,
    requiredMonthlySavings,
    contributions: goalContribs.sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export function calculateReducingBalanceEmi(
  principal: number,
  annualRatePct: number,
  tenureMonths: number
): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  if (annualRatePct <= 0) return Math.round((principal / tenureMonths) * 100) / 100;
  const r = annualRatePct / 12 / 100;
  const factor = Math.pow(1 + r, tenureMonths);
  const emi = (principal * r * factor) / (factor - 1);
  return Math.round(emi * 100) / 100;
}

export function calculateLoanSummary(
  loans: Loan[],
  loanPayments: LoanPayment[],
  emiPlans: EmiPlan[],
  referenceDate = getTodayISO()
) {
  const liveLoans = activeRecords(loans);
  const livePayments = activeRecords(loanPayments);
  const liveEmis = activeRecords(emiPlans);

  let totalBorrowed = 0;
  let totalBorrowedOutstanding = 0;
  let totalLent = 0;
  let totalLentOutstanding = 0;

  const enrichedLoans = liveLoans.map((loan) => {
    const payments = livePayments.filter((p) => p.loanId === loan.id);
    const principalRepaid = payments.reduce((sum, p) => sum + p.principalPortion, 0);
    const interestPaid = payments.reduce((sum, p) => sum + (p.interestPortion || 0), 0);
    const outstanding = Math.max(0, Math.round((loan.principalAmount - principalRepaid) * 100) / 100);
    const isOverdue = outstanding > 0 && loan.dueDate < referenceDate;

    if (loan.direction === 'lent') {
      totalLent += loan.principalAmount;
      totalLentOutstanding += outstanding;
    } else {
      totalBorrowed += loan.principalAmount;
      totalBorrowedOutstanding += outstanding;
    }

    return {
      ...loan,
      principalRepaid,
      interestPaid,
      outstanding,
      isOverdue,
      payments: payments.sort((a, b) => b.date.localeCompare(a.date)),
    };
  });

  let monthlyEmiObligation = 0;
  let totalEmiOutstanding = 0;
  const enrichedEmis = liveEmis.map((plan) => {
    const remainingInstallments = Math.max(0, plan.totalTenureMonths - plan.installmentsPaid);
    const estimatedRemainingPrincipal =
      plan.totalTenureMonths > 0
        ? Math.round((plan.principalAmount * (remainingInstallments / plan.totalTenureMonths)) * 100) / 100
        : 0;
    if (remainingInstallments > 0) {
      monthlyEmiObligation += plan.emiAmount;
      totalEmiOutstanding += estimatedRemainingPrincipal;
    }
    return {
      ...plan,
      remainingInstallments,
      estimatedRemainingPrincipal,
      estimatedFormulaEmi: calculateReducingBalanceEmi(
        plan.principalAmount,
        plan.interestRate,
        plan.totalTenureMonths
      ),
      isOverdue: remainingInstallments > 0 && plan.nextPaymentDate < referenceDate,
    };
  });

  return {
    totalBorrowed: Math.round(totalBorrowed * 100) / 100,
    totalBorrowedOutstanding: Math.round(totalBorrowedOutstanding * 100) / 100,
    totalLent: Math.round(totalLent * 100) / 100,
    totalLentOutstanding: Math.round(totalLentOutstanding * 100) / 100,
    monthlyEmiObligation: Math.round(monthlyEmiObligation * 100) / 100,
    totalEmiOutstanding: Math.round(totalEmiOutstanding * 100) / 100,
    totalOutstandingDebt: Math.round((totalBorrowedOutstanding + totalEmiOutstanding) * 100) / 100,
    enrichedLoans,
    enrichedEmis,
  };
}

export function calculateInsuranceOverview(
  policies: InsurancePolicy[],
  claims: MedicalClaim[]
) {
  const livePolicies = activeRecords(policies);
  const liveClaims = activeRecords(claims);

  const totalCoverage = livePolicies.reduce((sum, p) => sum + p.sumInsured, 0);

  // Only approved, partially_approved, and reimbursement_received consume coverage; pending claims never do
  const coverageConsumed = liveClaims
    .filter((c) =>
      c.status === 'approved' ||
      c.status === 'partially_approved' ||
      c.status === 'reimbursement_received'
    )
    .reduce((sum, c) => sum + (c.amountApproved || 0), 0);

  const remainingCoverage = Math.max(0, totalCoverage - coverageConsumed);
  const totalClaimed = liveClaims
    .filter((c) => c.status !== 'draft')
    .reduce((sum, c) => sum + c.amountClaimed, 0);
  const pendingClaimsCount = liveClaims.filter(
    (c) => c.status === 'submitted' || c.status === 'under_review'
  ).length;
  const totalApproved = liveClaims.reduce((sum, c) => sum + (c.amountApproved || 0), 0);
  const totalReceived = liveClaims.reduce((sum, c) => sum + (c.amountReceived || 0), 0);
  const amountStillReceivable = Math.max(0, totalApproved - totalReceived);

  return {
    totalCoverage,
    coverageConsumed,
    remainingCoverage,
    totalClaimed,
    pendingClaimsCount,
    totalApproved,
    totalReceived,
    amountStillReceivable,
  };
}

export function calculatePortfolioSummary(investments: Investment[], sipPlans: SipPlan[]) {
  const liveInvestments = activeRecords(investments);
  const liveSips = activeRecords(sipPlans);

  let totalInvested = 0;
  let currentValue = 0;

  const holdings = liveInvestments.map((inv) => {
    const curVal = Math.round(inv.units * inv.currentNav * 100) / 100;
    const pnl = Math.round((curVal - inv.investedAmount) * 100) / 100;
    const returnPct =
      inv.investedAmount > 0 ? Math.round((pnl / inv.investedAmount) * 10000) / 100 : 0;
    totalInvested += inv.investedAmount;
    currentValue += curVal;
    return {
      ...inv,
      currentValue: curVal,
      profitLoss: pnl,
      returnPct,
    };
  });

  const profitLoss = Math.round((currentValue - totalInvested) * 100) / 100;
  const absoluteReturnPct =
    totalInvested > 0 ? Math.round((profitLoss / totalInvested) * 10000) / 100 : 0;

  const activeSips = liveSips.filter((s) => s.status === 'active');
  const monthlySipCommitment = activeSips.reduce((sum, s) => sum + s.monthlyAmount, 0);
  const totalSipInvested = liveSips.reduce(
    (sum, s) => sum + s.completedInstallments * s.monthlyAmount,
    0
  );

  return {
    totalInvested: Math.round(totalInvested * 100) / 100,
    currentValue: Math.round(currentValue * 100) / 100,
    profitLoss,
    absoluteReturnPct,
    holdings,
    activeSipsCount: activeSips.length,
    monthlySipCommitment,
    totalSipInvested,
  };
}

export function generateFinancialInsights(data: WorkspaceData, referenceDate = getTodayISO()): string[] {
  const insights: string[] = [];
  const comp = calculateMonthlyComparison(data.transactions, referenceDate);
  if (comp.expenseChangePct !== null && (comp.currentExpenses > 0 || comp.prevMtdExpenses > 0)) {
    const abs = Math.abs(comp.expenseChangePct);
    if (comp.expenseChangePct < 0) {
      insights.push(
        `You spent ${abs}% less month-to-date compared to the first ${comp.dayCutoff} days of last month.`
      );
    } else if (comp.expenseChangePct > 0) {
      insights.push(
        `Your month-to-date spending is ${abs}% higher than the same period last month.`
      );
    }
  }

  const topCatChange = comp.categories.find(
    (c) => c.changePct !== null && Math.abs(c.changePct) >= 5 && c.current > 0
  );
  if (topCatChange && topCatChange.changePct !== null) {
    insights.push(
      `Your ${topCatChange.category} expenses ${topCatChange.changePct > 0 ? 'increased' : 'decreased'} by ${Math.abs(topCatChange.changePct)}% compared to last month.`
    );
  }

  const budget = calculateBudgetSummary(data.budgets, data.transactions, comp.currentMonth);
  if (budget.totalBudgetLimit > 0) {
    insights.push(
      `You have used ${budget.usedPct}% of your monthly budget (${formatCurrency(budget.totalSpent, data.userPreferences.currency, data.userPreferences.numberFormat)} of ${formatCurrency(budget.totalBudgetLimit, data.userPreferences.currency, data.userPreferences.numberFormat)}).`
    );
  }

  const activeGoals = activeRecords(data.savingsGoals);
  if (activeGoals.length > 0) {
    const firstGoal = activeGoals[0];
    const progress = calculateGoalProgress(firstGoal, data.savingsContributions, referenceDate);
    insights.push(
      `Your savings goal "${firstGoal.name}" is ${progress.progressPct.toFixed(1)}% complete.`
    );
  }

  const upcomingEmis = activeRecords(data.emiPlans)
    .filter((e) => e.installmentsPaid < e.totalTenureMonths && e.nextPaymentDate >= referenceDate)
    .sort((a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate));
  if (upcomingEmis.length > 0) {
    const nextEmi = upcomingEmis[0];
    const daysAway = Math.ceil(
      (new Date(`${nextEmi.nextPaymentDate}T00:00:00`).getTime() -
        new Date(`${referenceDate}T00:00:00`).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    insights.push(
      daysAway === 0
        ? `Your "${nextEmi.loanName}" EMI payment is due today.`
        : `Your "${nextEmi.loanName}" EMI payment is due in ${daysAway} day${daysAway === 1 ? '' : 's'}.`
    );
  }

  if (insights.length === 0) {
    insights.push(
      'Add transactions, budgets, or savings goals to unlock personalized insights derived strictly from your records.'
    );
  }

  return insights;
}

export function exportTransactionsToCsv(
  transactions: Transaction[],
  accounts: Account[]
): string {
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const headers = [
    'Date',
    'Time',
    'Type',
    'Description',
    'Category',
    'Account',
    'To Account',
    'Payment Method',
    'Amount',
    'Refund',
    'Notes',
  ];
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const rows = activeRecords(transactions)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((tx) =>
      [
        tx.date,
        tx.time,
        tx.type,
        tx.description,
        tx.category,
        accountMap.get(tx.accountId) || tx.accountId,
        tx.toAccountId ? accountMap.get(tx.toAccountId) || tx.toAccountId : '',
        tx.paymentMethod,
        String(tx.amount),
        tx.isRefund ? 'Yes' : 'No',
        tx.notes || '',
      ]
        .map(escape)
        .join(',')
    );
  return [headers.join(','), ...rows].join('\n');
}
