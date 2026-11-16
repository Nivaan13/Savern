import React, { useMemo, useState } from 'react';
import { CreditCard, Plus, Trash2 } from 'lucide-react';
import { useSavern } from '../context/SavernContext.tsx';
import { EmiPlan, Loan } from '../types/finance.ts';
import {
  activeRecords,
  calculateLoanSummary,
  calculateReducingBalanceEmi,
  formatCurrency,
  formatDateDisplay,
  getTodayISO,
} from '../lib/financeEngine.ts';
import { Modal } from '../components/ui/Modal.tsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';

export const LoansEmiPage: React.FC = () => {
  const { data, saveEntity, deleteEntity, showToast } = useSavern();
  const prefs = data.userPreferences;
  const today = getTodayISO();
  const accounts = activeRecords(data.accounts);

  const summary = useMemo(
    () => calculateLoanSummary(data.loans, data.loanPayments, data.emiPlans, today),
    [data.loans, data.loanPayments, data.emiPlans, today]
  );

  const [tab, setTab] = useState<'emi' | 'borrowed' | 'lent' | 'formal'>('emi');

  // Add Loan Modal
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [direction, setDirection] = useState<Loan['direction']>('borrowed');
  const [counterparty, setCounterparty] = useState('');
  const [loanTitle, setLoanTitle] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('0');
  const [startDate, setStartDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [notes, setNotes] = useState('');

  // Loan Payment Modal
  const [payLoan, setPayLoan] = useState<(typeof summary.enrichedLoans)[number] | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payInterest, setPayInterest] = useState('0');
  const [payDate, setPayDate] = useState(today);
  const [payAccount, setPayAccount] = useState('');
  const [allowAdvance, setAllowAdvance] = useState(false);
  const [payError, setPayError] = useState('');

  // Add EMI Modal
  const [emiModalOpen, setEmiModalOpen] = useState(false);
  const [emiName, setEmiName] = useState('');
  const [emiLender, setEmiLender] = useState('');
  const [emiPrincipal, setEmiPrincipal] = useState('');
  const [emiRate, setEmiRate] = useState('12');
  const [emiAmount, setEmiAmount] = useState('');
  const [emiTenure, setEmiTenure] = useState('12');
  const [emiPaidCount, setEmiPaidCount] = useState('0');
  const [emiStartDate, setEmiStartDate] = useState(today);
  const [emiNextDate, setEmiNextDate] = useState(today);
  const [emiReminders, setEmiReminders] = useState<number[]>([7, 3, 1, 0]);

  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'loan' | 'emi'; id: string; label: string } | null>(null);

  const estimatedFormula = calculateReducingBalanceEmi(
    Number(emiPrincipal) || 0,
    Number(emiRate) || 0,
    Number(emiTenure) || 0
  );

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(principal);
    if (!counterparty.trim() || !loanTitle.trim() || !Number.isFinite(num) || num <= 0) return;

    await saveEntity('loans', {
      direction,
      counterpartyName: counterparty.trim(),
      title: loanTitle.trim(),
      principalAmount: num,
      interestRate: Math.max(0, Number(interestRate) || 0),
      startDate,
      dueDate,
      repaymentFrequency: 'monthly',
      notes: notes.trim() || null,
    });
    showToast('Loan record created', 'success');
    setLoanModalOpen(false);
  };

  const handleSaveLoanPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payLoan) return;
    setPayError('');
    const total = Number(payAmount);
    const interest = Math.max(0, Number(payInterest) || 0);
    if (!Number.isFinite(total) || total <= 0) {
      setPayError('Payment amount must be positive.');
      return;
    }
    const principalPortion = Math.max(0, total - interest);
    if (principalPortion > payLoan.outstanding && !allowAdvance) {
      setPayError(
        `Principal portion exceeds outstanding balance (${formatCurrency(
          payLoan.outstanding,
          prefs.currency,
          prefs.numberFormat
        )}). Check "Record as advance/overpayment" to proceed.`
      );
      return;
    }

    await saveEntity('loanPayments', {
      loanId: payLoan.id,
      amount: total,
      principalPortion,
      interestPortion: interest,
      date: payDate,
      accountId: payAccount || null,
      isAdvance: principalPortion > payLoan.outstanding && allowAdvance,
      notes: allowAdvance ? 'Includes advance/overpayment' : null,
    });
    showToast('Loan payment recorded', 'success');
    setPayLoan(null);
  };

  const handleSaveEmi = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = Number(emiPrincipal);
    const emi = Number(emiAmount) || estimatedFormula;
    const tenure = Math.max(1, Number(emiTenure) || 12);
    if (!emiName.trim() || !emiLender.trim() || p <= 0 || emi <= 0) return;

    await saveEntity('emiPlans', {
      loanName: emiName.trim(),
      lender: emiLender.trim(),
      principalAmount: p,
      interestRate: Math.max(0, Number(emiRate) || 0),
      emiAmount: emi,
      startDate: emiStartDate,
      totalTenureMonths: tenure,
      frequency: 'monthly',
      dueDay: Number(emiNextDate.slice(8, 10)) || 5,
      nextPaymentDate: emiNextDate,
      installmentsPaid: Math.min(tenure, Math.max(0, Number(emiPaidCount) || 0)),
      reminderDaysBefore: emiReminders,
      accountId: accounts[0]?.id || null,
      notes: null,
    });
    showToast('EMI plan added', 'success');
    setEmiModalOpen(false);
  };

  const handleMarkEmiInstallment = async (
    plan: EmiPlan,
    status: 'paid' | 'skipped'
  ) => {
    await saveEntity('emiPayments', {
      emiPlanId: plan.id,
      date: plan.nextPaymentDate,
      amount: plan.emiAmount,
      status,
      accountId: plan.accountId || null,
      reference: `EMI-${plan.installmentsPaid + 1}`,
      notes: status === 'paid' ? 'Installment paid' : 'Installment skipped',
    });

    const nextDt = new Date(`${plan.nextPaymentDate}T00:00:00`);
    nextDt.setMonth(nextDt.getMonth() + 1);
    await saveEntity('emiPlans', {
      ...plan,
      installmentsPaid: status === 'paid' ? plan.installmentsPaid + 1 : plan.installmentsPaid,
      nextPaymentDate: nextDt.toISOString().slice(0, 10),
    });
    showToast(`EMI installment marked ${status}`, 'success');
  };

  const fmt = (v: number) => formatCurrency(v, prefs.currency, prefs.numberFormat, prefs.hideAmounts);
  const filteredLoans = summary.enrichedLoans.filter((l) => l.direction === tab);
  const liveEmiPayments = activeRecords(data.emiPayments);

  return (
    <div className="space-y-6">
      {/* Top KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#273449] bg-[#151F30] p-4">
          <p className="text-xs text-[#94A3B8]">Total Borrowed / Debt</p>
          <p className="mt-1.5 font-display text-xl font-bold text-[#F16C78] font-mono-num">
            {fmt(summary.totalBorrowedOutstanding)}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">Original: {fmt(summary.totalBorrowed)}</p>
        </div>
        <div className="rounded-xl border border-[#273449] bg-[#151F30] p-4">
          <p className="text-xs text-[#94A3B8]">Money Owed to You (Lent)</p>
          <p className="mt-1.5 font-display text-xl font-bold text-[#28C997] font-mono-num">
            {fmt(summary.totalLentOutstanding)}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">Original: {fmt(summary.totalLent)}</p>
        </div>
        <div className="rounded-xl border border-[#273449] bg-[#151F30] p-4">
          <p className="text-xs text-[#94A3B8]">Monthly EMI Obligation</p>
          <p className="mt-1.5 font-display text-xl font-bold text-[#F6B94A] font-mono-num">
            {fmt(summary.monthlyEmiObligation)}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            {summary.enrichedEmis.filter((e) => e.remainingInstallments > 0).length} active EMIs
          </p>
        </div>
        <div className="rounded-xl border border-[#273449] bg-[#151F30] p-4">
          <p className="text-xs text-[#94A3B8]">Est. EMI Principal Remaining</p>
          <p className="mt-1.5 font-display text-xl font-bold text-[#39A0ED] font-mono-num">
            {fmt(summary.totalEmiOutstanding)}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">Estimated from remaining tenure</p>
        </div>
      </div>

      {/* Tabs + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#273449] bg-[#101827] p-1">
          {(
            [
              ['emi', 'EMI Plans'],
              ['borrowed', 'Borrowed Money'],
              ['lent', 'Money Lent'],
              ['formal', 'Formal Loans'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                tab === key ? 'bg-[#1B2940] text-[#24D6A0]' : 'text-[#94A3B8] hover:text-[#F5F7FA]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDirection(tab === 'lent' ? 'lent' : tab === 'formal' ? 'formal' : 'borrowed');
              setLoanModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[#273449] bg-[#151F30] px-3.5 py-2 text-xs font-medium text-[#F5F7FA] hover:bg-[#1B2940]"
          >
            <Plus className="h-3.5 w-3.5 text-[#39A0ED]" />
            <span>Add Loan</span>
          </button>
          <button
            type="button"
            onClick={() => setEmiModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#24D6A0] px-4 py-2 text-xs font-semibold text-[#080D16] hover:bg-[#28C997]"
          >
            <Plus className="h-4 w-4" />
            <span>Add EMI Plan</span>
          </button>
        </div>
      </div>

      {tab === 'emi' ? (
        summary.enrichedEmis.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No EMI plans added"
            description="Track monthly loan installments, reducing-balance estimates, and payment reminders."
            actionLabel="Add EMI Plan"
            onAction={() => setEmiModalOpen(true)}
          />
        ) : (
          <div className="space-y-4">
            {summary.enrichedEmis.map((plan) => {
              const planHistory = liveEmiPayments.filter((p) => p.emiPlanId === plan.id);
              return (
                <div
                  key={plan.id}
                  className="rounded-xl border border-[#273449] bg-[#151F30] p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-[#94A3B8]">
                        {plan.lender} · {plan.interestRate}% p.a. · Reminders:{' '}
                        {plan.reminderDaysBefore.map((d) => (d === 0 ? 'Due day' : `${d}d`)).join(', ')}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-[#F5F7FA]">{plan.loanName}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-[#94A3B8]">Monthly EMI</p>
                        <p className="text-lg font-bold text-[#F6B94A] font-mono-num">
                          {fmt(plan.emiAmount)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({ kind: 'emi', id: plan.id, label: plan.loanName })
                        }
                        className="rounded p-1.5 text-[#94A3B8] hover:text-[#F16C78]"
                        aria-label="Delete EMI plan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                      <span className="text-[#94A3B8]">Paid / Total</span>
                      <p className="mt-1 font-semibold text-[#F5F7FA] font-mono-num">
                        {plan.installmentsPaid} / {plan.totalTenureMonths}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                      <span className="text-[#94A3B8]">Next Due Date</span>
                      <p
                        className={`mt-1 font-semibold font-mono-num ${
                          plan.isOverdue ? 'text-[#F16C78]' : 'text-[#F5F7FA]'
                        }`}
                      >
                        {formatDateDisplay(plan.nextPaymentDate, prefs.dateFormat)}
                        {plan.isOverdue ? ' (Overdue)' : ''}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                      <span className="text-[#94A3B8]">Est. Formula EMI</span>
                      <p className="mt-1 font-semibold text-[#39A0ED] font-mono-num">
                        {fmt(plan.estimatedFormulaEmi)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                      <span className="text-[#94A3B8]">Est. Principal Left</span>
                      <p className="mt-1 font-semibold text-[#F5F7FA] font-mono-num">
                        {fmt(plan.estimatedRemainingPrincipal)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#273449] pt-3">
                    <span className="text-[11px] text-[#94A3B8]">
                      Reducing-balance estimate shown for reference; verify final figures with lender statements.
                    </span>
                    {plan.remainingInstallments > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleMarkEmiInstallment(plan, 'skipped')}
                          className="rounded-lg border border-[#273449] px-3 py-1.5 text-xs text-[#94A3B8] hover:text-[#F5F7FA]"
                        >
                          Skip Month
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkEmiInstallment(plan, 'paid')}
                          className="rounded-lg bg-[#24D6A0] px-3.5 py-1.5 text-xs font-semibold text-[#080D16] hover:bg-[#28C997]"
                        >
                          Mark Installment Paid
                        </button>
                      </div>
                    )}
                  </div>

                  {planHistory.length > 0 && (
                    <div className="border-t border-[#273449] pt-3 space-y-1.5">
                      <p className="text-xs font-medium text-[#94A3B8]">Payment History</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {planHistory.slice(0, 6).map((hp) => (
                          <div
                            key={hp.id}
                            className="flex items-center justify-between rounded bg-[#101827] px-3 py-1.5 text-xs"
                          >
                            <span className="text-[#94A3B8]">
                              {formatDateDisplay(hp.date, prefs.dateFormat)}
                            </span>
                            <span className="font-mono-num text-[#F5F7FA]">
                              {fmt(hp.amount)} · {hp.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : filteredLoans.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="You're all caught up"
          description="No loan records have been added in this category."
          actionLabel="Add Loan Record"
          onAction={() => {
            setDirection(tab);
            setLoanModalOpen(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredLoans.map((loan) => {
            const isLent = loan.direction === 'lent';
            return (
              <div
                key={loan.id}
                className="rounded-xl border border-[#273449] bg-[#151F30] p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-[#94A3B8]">
                        {isLent ? 'Borrower' : 'Lender'}: {loan.counterpartyName}
                        {loan.interestRate > 0 ? ` · ${loan.interestRate}% interest` : ''}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-[#F5F7FA]">{loan.title}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({ kind: 'loan', id: loan.id, label: loan.title })
                      }
                      className="rounded p-1.5 text-[#94A3B8] hover:text-[#F16C78]"
                      aria-label="Delete loan"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                      <span className="text-[#94A3B8]">Principal</span>
                      <p className="mt-1 font-bold text-[#F5F7FA] font-mono-num">
                        {fmt(loan.principalAmount)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                      <span className="text-[#94A3B8]">Repaid</span>
                      <p className="mt-1 font-bold text-[#28C997] font-mono-num">
                        {fmt(loan.principalRepaid)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                      <span className="text-[#94A3B8]">Outstanding</span>
                      <p
                        className={`mt-1 font-bold font-mono-num ${
                          isLent ? 'text-[#28C997]' : 'text-[#F16C78]'
                        }`}
                      >
                        {fmt(loan.outstanding)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-[#94A3B8]">
                    Due: {formatDateDisplay(loan.dueDate, prefs.dateFormat)}
                    {loan.isOverdue && (
                      <span className="ml-2 font-semibold text-[#F16C78]">Overdue</span>
                    )}
                  </p>
                </div>

                <div className="border-t border-[#273449] pt-3 flex items-center justify-between">
                  <span className="text-xs text-[#94A3B8]">
                    {loan.payments.length} repayment record{loan.payments.length === 1 ? '' : 's'}
                  </span>
                  {loan.outstanding > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPayLoan(loan);
                        setPayAmount(String(loan.outstanding));
                        setPayInterest('0');
                        setPayDate(today);
                        setPayAccount(accounts[0]?.id || '');
                        setAllowAdvance(false);
                        setPayError('');
                      }}
                      className="rounded-lg bg-[#24D6A0] px-3.5 py-1.5 text-xs font-semibold text-[#080D16] hover:bg-[#28C997]"
                    >
                      Record Payment
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Loan Modal */}
      <Modal open={loanModalOpen} onClose={() => setLoanModalOpen(false)} title="Add Loan Record">
        <form onSubmit={handleSaveLoan} className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-[#273449] bg-[#101827] p-1">
            {(['borrowed', 'lent', 'formal'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={`rounded-md py-1.5 text-xs font-semibold capitalize ${
                  direction === d ? 'bg-[#1B2940] text-[#24D6A0]' : 'text-[#94A3B8]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Loan Title *</label>
              <input
                type="text"
                value={loanTitle}
                onChange={(e) => setLoanTitle(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">
                {direction === 'lent' ? 'Borrower Name *' : 'Lender Name *'}
              </label>
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-[#94A3B8] mb-1">Principal Amount *</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Interest %</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setLoanModalOpen(false)}
              className="rounded-lg border border-[#273449] px-4 py-2 text-sm text-[#94A3B8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#24D6A0] px-5 py-2 text-sm font-semibold text-[#080D16]"
            >
              Save Loan
            </button>
          </div>
        </form>
      </Modal>

      {/* Loan Payment Modal */}
      <Modal
        open={!!payLoan}
        onClose={() => setPayLoan(null)}
        title={`Record Repayment · ${payLoan?.title || ''}`}
      >
        {payLoan && (
          <form onSubmit={handleSaveLoanPayment} className="space-y-4">
            {payError && (
              <div className="rounded-lg border border-[#F16C78]/40 bg-[#F16C78]/10 px-3 py-2 text-xs text-[#F16C78]">
                {payError}
              </div>
            )}
            <div className="rounded-lg border border-[#273449] bg-[#101827] p-3 flex justify-between text-xs">
              <span className="text-[#94A3B8]">Outstanding Principal</span>
              <span className="font-bold text-[#F5F7FA] font-mono-num">
                {fmt(payLoan.outstanding)}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Payment Amount *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Interest Portion</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payInterest}
                  onChange={(e) => setPayInterest(e.target.value)}
                  className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Payment Date</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-[#94A3B8] cursor-pointer">
              <input
                type="checkbox"
                checked={allowAdvance}
                onChange={(e) => setAllowAdvance(e.target.checked)}
              />
              <span>Record excess as advance / overpayment</span>
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPayLoan(null)}
                className="rounded-lg border border-[#273449] px-4 py-2 text-sm text-[#94A3B8]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#24D6A0] px-5 py-2 text-sm font-semibold text-[#080D16]"
              >
                Save Payment
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add EMI Modal */}
      <Modal open={emiModalOpen} onClose={() => setEmiModalOpen(false)} title="Add EMI Plan">
        <form onSubmit={handleSaveEmi} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Loan Name *</label>
              <input
                type="text"
                value={emiName}
                onChange={(e) => setEmiName(e.target.value)}
                placeholder="e.g. Home Loan / Laptop EMI"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Lender / Institution *</label>
              <input
                type="text"
                value={emiLender}
                onChange={(e) => setEmiLender(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Principal *</label>
              <input
                type="number"
                min="1"
                value={emiPrincipal}
                onChange={(e) => setEmiPrincipal(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Rate % p.a.</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={emiRate}
                onChange={(e) => setEmiRate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Tenure (mo)</label>
              <input
                type="number"
                min="1"
                value={emiTenure}
                onChange={(e) => setEmiTenure(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Actual EMI *</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={emiAmount}
                onChange={(e) => setEmiAmount(e.target.value)}
                placeholder={estimatedFormula > 0 ? String(estimatedFormula) : ''}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
          </div>

          {estimatedFormula > 0 && (
            <p className="text-xs text-[#39A0ED]">
              Estimated reducing-balance EMI: {fmt(estimatedFormula)} / month
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Start Date</label>
              <input
                type="date"
                value={emiStartDate}
                onChange={(e) => setEmiStartDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Next Payment Date</label>
              <input
                type="date"
                value={emiNextDate}
                onChange={(e) => setEmiNextDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Paid Installments</label>
              <input
                type="number"
                min="0"
                value={emiPaidCount}
                onChange={(e) => setEmiPaidCount(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-[#94A3B8] mb-1.5">Reminder Lead Days</p>
            <div className="flex flex-wrap gap-2">
              {[7, 3, 1, 0].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setEmiReminders((prev) =>
                      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                    )
                  }
                  className={`rounded-lg border px-3 py-1 text-xs ${
                    emiReminders.includes(d)
                      ? 'border-[#24D6A0] bg-[#24D6A0]/15 text-[#24D6A0]'
                      : 'border-[#273449] bg-[#101827] text-[#94A3B8]'
                  }`}
                >
                  {d === 0 ? 'On Due Date' : `${d}d before`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEmiModalOpen(false)}
              className="rounded-lg border border-[#273449] px-4 py-2 text-sm text-[#94A3B8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#24D6A0] px-5 py-2 text-sm font-semibold text-[#080D16]"
            >
              Save EMI Plan
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Record"
        message={`Remove "${deleteTarget?.label}"?`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === 'loan') await deleteEntity('loans', deleteTarget.id);
          else await deleteEntity('emiPlans', deleteTarget.id);
          showToast('Removed', 'info');
        }}
      />
    </div>
  );
};
