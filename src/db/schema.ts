import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const userPreferences = pgTable('user_preferences', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  currency: text('currency').notNull().default('INR'),
  timezone: text('timezone').notNull().default('Asia/Kolkata'),
  dateFormat: text('date_format').notNull().default('DD MMM YYYY'),
  numberFormat: text('number_format').notNull().default('en-IN'),
  financialYearStartMonth: integer('financial_year_start_month').notNull().default(4),
  layoutDensity: text('layout_density').notNull().default('comfortable'),
  hideAmounts: boolean('hide_amounts').notNull().default(false),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  dailyReminderEnabled: boolean('daily_reminder_enabled').notNull().default(true),
  dailyReminderTime: text('daily_reminder_time').notNull().default('22:00'),
  dailyReminderDays: jsonb('daily_reminder_days').$type<number[]>().notNull(),
  emiRemindersEnabled: boolean('emi_reminders_enabled').notNull().default(true),
  loanRemindersEnabled: boolean('loan_reminders_enabled').notNull().default(true),
  sipRemindersEnabled: boolean('sip_reminders_enabled').notNull().default(true),
  budgetAlertsEnabled: boolean('budget_alerts_enabled').notNull().default(true),
  appLockPinHash: text('app_lock_pin_hash'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(), // cash | savings | current | other
  openingBalance: doublePrecision('opening_balance').notNull().default(0),
  currency: text('currency').notNull().default('INR'),
  description: text('description'),
  institution: text('institution'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  type: text('type').notNull(), // income | expense | transfer | adjustment
  amount: doublePrecision('amount').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  accountId: text('account_id').notNull(),
  toAccountId: text('to_account_id'),
  date: text('date').notNull(), // YYYY-MM-DD
  time: text('time').notNull().default('12:00'),
  paymentMethod: text('payment_method').notNull().default('UPI'),
  notes: text('notes'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  isRefund: boolean('is_refund').notNull().default(false),
  reconciliationReason: text('reconciliation_reason'),
  recurringId: text('recurring_id'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const budgets = pgTable('budgets', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  monthKey: text('month_key').notNull(), // YYYY-MM
  category: text('category').notNull(), // 'TOTAL' or category name
  limitAmount: doublePrecision('limit_amount').notNull(),
  alertThresholds: jsonb('alert_thresholds').$type<number[]>().notNull().default([50, 75, 90, 100]),
  triggeredThresholds: jsonb('triggered_thresholds').$type<number[]>().notNull().default([]),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const savingsGoals = pgTable('savings_goals', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  targetAmount: doublePrecision('target_amount').notNull(),
  initialSavedAmount: doublePrecision('initial_saved_amount').notNull().default(0),
  targetDate: text('target_date').notNull(),
  category: text('category').notNull(),
  description: text('description'),
  priority: text('priority').notNull().default('medium'), // low | medium | high
  linkedAccountId: text('linked_account_id'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const savingsContributions = pgTable('savings_contributions', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  goalId: text('goal_id').notNull(),
  amount: doublePrecision('amount').notNull(),
  date: text('date').notNull(),
  accountId: text('account_id'),
  notes: text('notes'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const loans = pgTable('loans', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  direction: text('direction').notNull(), // borrowed | lent | formal
  counterpartyName: text('counterparty_name').notNull(),
  title: text('title').notNull(),
  principalAmount: doublePrecision('principal_amount').notNull(),
  interestRate: doublePrecision('interest_rate').notNull().default(0),
  startDate: text('start_date').notNull(),
  dueDate: text('due_date').notNull(),
  repaymentFrequency: text('repayment_frequency').notNull().default('monthly'),
  notes: text('notes'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const loanPayments = pgTable('loan_payments', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  loanId: text('loan_id').notNull(),
  amount: doublePrecision('amount').notNull(),
  principalPortion: doublePrecision('principal_portion').notNull(),
  interestPortion: doublePrecision('interest_portion').notNull().default(0),
  date: text('date').notNull(),
  accountId: text('account_id'),
  isAdvance: boolean('is_advance').notNull().default(false),
  notes: text('notes'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const emiPlans = pgTable('emi_plans', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  loanName: text('loan_name').notNull(),
  lender: text('lender').notNull(),
  principalAmount: doublePrecision('principal_amount').notNull(),
  interestRate: doublePrecision('interest_rate').notNull(),
  emiAmount: doublePrecision('emi_amount').notNull(),
  startDate: text('start_date').notNull(),
  totalTenureMonths: integer('total_tenure_months').notNull(),
  frequency: text('frequency').notNull().default('monthly'),
  dueDay: integer('due_day').notNull(),
  nextPaymentDate: text('next_payment_date').notNull(),
  installmentsPaid: integer('installments_paid').notNull().default(0),
  reminderDaysBefore: jsonb('reminder_days_before').$type<number[]>().notNull().default([7, 3, 1, 0]),
  accountId: text('account_id'),
  notes: text('notes'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const emiPayments = pgTable('emi_payments', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  emiPlanId: text('emi_plan_id').notNull(),
  date: text('date').notNull(),
  amount: doublePrecision('amount').notNull(),
  status: text('status').notNull(), // upcoming | paid | overdue | skipped
  accountId: text('account_id'),
  reference: text('reference'),
  notes: text('notes'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const insurancePolicies = pgTable('insurance_policies', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  company: text('company').notNull(),
  policyName: text('policy_name').notNull(),
  policyNumberMasked: text('policy_number_masked').notNull(),
  sumInsured: doublePrecision('sum_insured').notNull(),
  startDate: text('start_date').notNull(),
  expiryDate: text('expiry_date').notNull(),
  premiumAmount: doublePrecision('premium_amount').notNull(),
  renewalDate: text('renewal_date').notNull(),
  notes: text('notes'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const medicalClaims = pgTable('medical_claims', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  policyId: text('policy_id').notNull(),
  title: text('title').notNull(),
  hospital: text('hospital').notNull(),
  treatmentDate: text('treatment_date').notNull(),
  submissionDate: text('submission_date').notNull(),
  medicalExpenseAmount: doublePrecision('medical_expense_amount').notNull(),
  amountClaimed: doublePrecision('amount_claimed').notNull(),
  amountApproved: doublePrecision('amount_approved').notNull().default(0),
  amountReceived: doublePrecision('amount_received').notNull().default(0),
  status: text('status').notNull(), // draft | submitted | under_review | approved | partially_approved | rejected | reimbursement_received
  claimReference: text('claim_reference'),
  notes: text('notes'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const investments = pgTable('investments', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  fundName: text('fund_name').notNull(),
  amc: text('amc').notNull(),
  schemeCategory: text('scheme_category').notNull(),
  investmentDate: text('investment_date').notNull(),
  investedAmount: doublePrecision('invested_amount').notNull(),
  units: doublePrecision('units').notNull(),
  purchaseNav: doublePrecision('purchase_nav').notNull(),
  currentNav: doublePrecision('current_nav').notNull(),
  notes: text('notes'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const sipPlans = pgTable('sip_plans', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  sipName: text('sip_name').notNull(),
  fundId: text('fund_id').notNull(),
  fundName: text('fund_name').notNull(),
  monthlyAmount: doublePrecision('monthly_amount').notNull(),
  startDate: text('start_date').notNull(),
  frequency: text('frequency').notNull().default('monthly'),
  installmentDay: integer('installment_day').notNull(),
  totalInstallments: integer('total_installments').notNull(),
  completedInstallments: integer('completed_installments').notNull().default(0),
  nextInstallmentDate: text('next_installment_date').notNull(),
  status: text('status').notNull().default('active'), // active | paused
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const recurringTransactions = pgTable('recurring_transactions', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  type: text('type').notNull(), // income | expense
  amount: doublePrecision('amount').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  accountId: text('account_id').notNull(),
  paymentMethod: text('payment_method').notNull().default('UPI'),
  frequency: text('frequency').notNull(), // daily | weekly | monthly | yearly | custom
  customIntervalDays: integer('custom_interval_days'),
  nextDate: text('next_date').notNull(),
  lastGeneratedDate: text('last_generated_date'),
  isActive: boolean('is_active').notNull().default(true),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  kind: text('kind').notNull(), // daily | emi | loan | sip | budget | savings | insurance | system
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  dueDate: text('due_date'),
  dedupeKey: text('dedupe_key'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});
