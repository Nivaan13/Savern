export type AccountType = 'cash' | 'savings' | 'current' | 'other';
export type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment';
export type PaymentMethod =
  | 'Cash'
  | 'UPI'
  | 'Debit card'
  | 'Credit card'
  | 'Bank transfer'
  | 'Other';

export type ExpenseCategory =
  | 'Food'
  | 'Groceries'
  | 'Transport'
  | 'Shopping'
  | 'Education'
  | 'Entertainment'
  | 'Medical'
  | 'Bills'
  | 'Rent'
  | 'Travel'
  | 'Personal care'
  | 'Salary'
  | 'Freelance'
  | 'Investment Return'
  | 'Reimbursement'
  | 'Other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Groceries',
  'Transport',
  'Shopping',
  'Education',
  'Entertainment',
  'Medical',
  'Bills',
  'Rent',
  'Travel',
  'Personal care',
  'Other',
];

export const INCOME_CATEGORIES: ExpenseCategory[] = [
  'Salary',
  'Freelance',
  'Investment Return',
  'Reimbursement',
  'Other',
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  'UPI',
  'Cash',
  'Debit card',
  'Credit card',
  'Bank transfer',
  'Other',
];

export interface BaseEntity {
  id: string;
  userId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface UserPreferences extends BaseEntity {
  currency: string;
  timezone: string;
  dateFormat: 'DD MMM YYYY' | 'YYYY-MM-DD' | 'DD/MM/YYYY';
  numberFormat: 'en-IN' | 'en-US';
  financialYearStartMonth: number;
  layoutDensity: 'comfortable' | 'compact';
  hideAmounts: boolean;
  onboardingCompleted: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  dailyReminderDays: number[]; // 0 = Sun ... 6 = Sat
  emiRemindersEnabled: boolean;
  loanRemindersEnabled: boolean;
  sipRemindersEnabled: boolean;
  budgetAlertsEnabled: boolean;
  appLockPinHash?: string | null;
}

export interface Account extends BaseEntity {
  name: string;
  type: AccountType;
  openingBalance: number;
  currency: string;
  description?: string | null;
  institution?: string | null;
}

export interface Transaction extends BaseEntity {
  type: TransactionType;
  amount: number; // positive for income/expense/transfer, signed for adjustment
  description: string;
  category: string;
  accountId: string;
  toAccountId?: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  paymentMethod: PaymentMethod | string;
  notes?: string | null;
  tags: string[];
  isRefund?: boolean;
  reconciliationReason?: string | null;
  recurringId?: string | null;
}

export interface Budget extends BaseEntity {
  monthKey: string; // YYYY-MM
  category: string; // 'TOTAL' or category name
  limitAmount: number;
  alertThresholds: number[];
  triggeredThresholds: number[];
}

export interface SavingsGoal extends BaseEntity {
  name: string;
  targetAmount: number;
  initialSavedAmount: number;
  targetDate: string;
  category: string;
  description?: string | null;
  priority: 'low' | 'medium' | 'high';
  linkedAccountId?: string | null;
}

export interface SavingsContribution extends BaseEntity {
  goalId: string;
  amount: number;
  date: string;
  accountId?: string | null;
  notes?: string | null;
}

export interface Loan extends BaseEntity {
  direction: 'borrowed' | 'lent' | 'formal';
  counterpartyName: string;
  title: string;
  principalAmount: number;
  interestRate: number;
  startDate: string;
  dueDate: string;
  repaymentFrequency: string;
  notes?: string | null;
}

export interface LoanPayment extends BaseEntity {
  loanId: string;
  amount: number;
  principalPortion: number;
  interestPortion: number;
  date: string;
  accountId?: string | null;
  isAdvance?: boolean;
  notes?: string | null;
}

export interface EmiPlan extends BaseEntity {
  loanName: string;
  lender: string;
  principalAmount: number;
  interestRate: number;
  emiAmount: number;
  startDate: string;
  totalTenureMonths: number;
  frequency: string;
  dueDay: number;
  nextPaymentDate: string;
  installmentsPaid: number;
  reminderDaysBefore: number[];
  accountId?: string | null;
  notes?: string | null;
}

export interface EmiPayment extends BaseEntity {
  emiPlanId: string;
  date: string;
  amount: number;
  status: 'upcoming' | 'paid' | 'overdue' | 'skipped';
  accountId?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface InsurancePolicy extends BaseEntity {
  company: string;
  policyName: string;
  policyNumberMasked: string;
  sumInsured: number;
  startDate: string;
  expiryDate: string;
  premiumAmount: number;
  renewalDate: string;
  notes?: string | null;
}

export type ClaimStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'partially_approved'
  | 'rejected'
  | 'reimbursement_received';

export interface MedicalClaim extends BaseEntity {
  policyId: string;
  title: string;
  hospital: string;
  treatmentDate: string;
  submissionDate: string;
  medicalExpenseAmount: number;
  amountClaimed: number;
  amountApproved: number;
  amountReceived: number;
  status: ClaimStatus;
  claimReference?: string | null;
  notes?: string | null;
}

export interface Investment extends BaseEntity {
  fundName: string;
  amc: string;
  schemeCategory: string;
  investmentDate: string;
  investedAmount: number;
  units: number;
  purchaseNav: number;
  currentNav: number;
  notes?: string | null;
}

export interface SipPlan extends BaseEntity {
  sipName: string;
  fundId: string;
  fundName: string;
  monthlyAmount: number;
  startDate: string;
  frequency: string;
  installmentDay: number;
  totalInstallments: number;
  completedInstallments: number;
  nextInstallmentDate: string;
  status: 'active' | 'paused';
}

export interface RecurringTransaction extends BaseEntity {
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: string;
  accountId: string;
  paymentMethod: PaymentMethod | string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  customIntervalDays?: number | null;
  nextDate: string;
  lastGeneratedDate?: string | null;
  isActive: boolean;
}

export interface NotificationItem extends BaseEntity {
  kind: 'daily' | 'emi' | 'loan' | 'sip' | 'budget' | 'savings' | 'insurance' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  dueDate?: string | null;
  dedupeKey?: string | null;
}

export type EntityCollectionKey =
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

export interface SyncOperation {
  opId: string;
  workspaceKey: string;
  userId: string;
  entityType: EntityCollectionKey;
  entityId: string;
  opType: 'upsert' | 'delete';
  timestamp: string;
  status: 'pending' | 'syncing' | 'error' | 'conflict';
  version: number;
  errorMessage?: string;
  data: Record<string, unknown>;
}

export type SyncStateStatus = 'offline' | 'pending' | 'syncing' | 'synced' | 'error' | 'demo';

export interface WorkspaceData {
  userPreferences: UserPreferences;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  savingsContributions: SavingsContribution[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  emiPlans: EmiPlan[];
  emiPayments: EmiPayment[];
  insurancePolicies: InsurancePolicy[];
  medicalClaims: MedicalClaim[];
  investments: Investment[];
  sipPlans: SipPlan[];
  recurringTransactions: RecurringTransaction[];
  notifications: NotificationItem[];
}
