import React, { useMemo, useState } from 'react';
import { FileHeart, Lock, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useSavern } from '../context/SavernContext.tsx';
import { ClaimStatus, InsurancePolicy, MedicalClaim } from '../types/finance.ts';
import {
  activeRecords,
  calculateInsuranceOverview,
  formatCurrency,
  formatDateDisplay,
  getTodayISO,
} from '../lib/financeEngine.ts';
import { Modal } from '../components/ui/Modal.tsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';

const CLAIM_STATUS_LABELS: Record<ClaimStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'text-[#94A3B8]' },
  submitted: { label: 'Submitted', color: 'text-[#39A0ED]' },
  under_review: { label: 'Under Review', color: 'text-[#F6B94A]' },
  approved: { label: 'Approved', color: 'text-[#24D6A0]' },
  partially_approved: { label: 'Partially Approved', color: 'text-[#F6B94A]' },
  rejected: { label: 'Rejected', color: 'text-[#F16C78]' },
  reimbursement_received: { label: 'Reimbursement Received', color: 'text-[#28C997]' },
};

function maskPolicyNumber(raw: string): string {
  const clean = raw.trim();
  if (!clean) return 'POL-••••-0000';
  if (clean.includes('•')) return clean;
  const last4 = clean.slice(-4).padStart(4, '0');
  return `POL-••••-${last4}`;
}

export const MedicalClaimsPage: React.FC = () => {
  const { data, saveEntity, deleteEntity, showToast } = useSavern();
  const prefs = data.userPreferences;
  const today = getTodayISO();

  const policies = useMemo(
    () => activeRecords(data.insurancePolicies).sort((a, b) => a.renewalDate.localeCompare(b.renewalDate)),
    [data.insurancePolicies]
  );
  const claims = useMemo(
    () => activeRecords(data.medicalClaims).sort((a, b) => b.treatmentDate.localeCompare(a.treatmentDate)),
    [data.medicalClaims]
  );

  const overview = useMemo(
    () => calculateInsuranceOverview(policies, claims),
    [policies, claims]
  );

  const [tab, setTab] = useState<'claims' | 'policies'>('claims');

  // Policy Modal
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(null);
  const [company, setCompany] = useState('');
  const [policyName, setPolicyName] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [sumInsured, setSumInsured] = useState('500000');
  const [premiumAmount, setPremiumAmount] = useState('15000');
  const [startDate, setStartDate] = useState(today);
  const [expiryDate, setExpiryDate] = useState(today);
  const [renewalDate, setRenewalDate] = useState(today);
  const [policyNotes, setPolicyNotes] = useState('');

  // Claim Modal
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [editingClaim, setEditingClaim] = useState<MedicalClaim | null>(null);
  const [claimPolicyId, setClaimPolicyId] = useState('');
  const [claimTitle, setClaimTitle] = useState('');
  const [hospital, setHospital] = useState('');
  const [treatmentDate, setTreatmentDate] = useState(today);
  const [submissionDate, setSubmissionDate] = useState(today);
  const [medicalExpenseAmount, setMedicalExpenseAmount] = useState('');
  const [amountClaimed, setAmountClaimed] = useState('');
  const [amountApproved, setAmountApproved] = useState('0');
  const [amountReceived, setAmountReceived] = useState('0');
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>('submitted');
  const [claimReference, setClaimReference] = useState('');
  const [claimNotes, setClaimNotes] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'policy' | 'claim';
    id: string;
    label: string;
  } | null>(null);

  const fmt = (v: number) => formatCurrency(v, prefs.currency, prefs.numberFormat, prefs.hideAmounts);
  const policyMap = new Map(policies.map((p) => [p.id, p]));

  const openPolicyForm = (p?: InsurancePolicy) => {
    setEditingPolicy(p || null);
    setCompany(p?.company || '');
    setPolicyName(p?.policyName || '');
    setPolicyNumber(p?.policyNumberMasked || '');
    setSumInsured(p ? String(p.sumInsured) : '500000');
    setPremiumAmount(p ? String(p.premiumAmount) : '15000');
    setStartDate(p?.startDate || today);
    setExpiryDate(p?.expiryDate || today);
    setRenewalDate(p?.renewalDate || today);
    setPolicyNotes(p?.notes || '');
    setPolicyModalOpen(true);
  };

  const openClaimForm = (c?: MedicalClaim) => {
    if (c && c.status === 'reimbursement_received') {
      showToast('Settled claims are locked', 'info', 'Reimbursement has already been received.');
      return;
    }
    setEditingClaim(c || null);
    setClaimPolicyId(c?.policyId || policies[0]?.id || '');
    setClaimTitle(c?.title || '');
    setHospital(c?.hospital || '');
    setTreatmentDate(c?.treatmentDate || today);
    setSubmissionDate(c?.submissionDate || today);
    setMedicalExpenseAmount(c ? String(c.medicalExpenseAmount) : '');
    setAmountClaimed(c ? String(c.amountClaimed) : '');
    setAmountApproved(c ? String(c.amountApproved) : '0');
    setAmountReceived(c ? String(c.amountReceived) : '0');
    setClaimStatus(c?.status || 'submitted');
    setClaimReference(c?.claimReference || '');
    setClaimNotes(c?.notes || '');
    setClaimModalOpen(true);
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    const sum = Number(sumInsured);
    const prem = Number(premiumAmount) || 0;
    if (!company.trim() || !policyName.trim() || !Number.isFinite(sum) || sum <= 0) return;

    await saveEntity('insurancePolicies', {
      id: editingPolicy?.id,
      company: company.trim(),
      policyName: policyName.trim(),
      policyNumberMasked: maskPolicyNumber(policyNumber),
      sumInsured: sum,
      premiumAmount: Math.max(0, prem),
      startDate,
      expiryDate,
      renewalDate,
      notes: policyNotes.trim() || null,
    });
    showToast(editingPolicy ? 'Policy updated' : 'Insurance policy added', 'success');
    setPolicyModalOpen(false);
  };

  const handleSaveClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const exp = Number(medicalExpenseAmount) || 0;
    const claimed = Number(amountClaimed) || 0;
    const approved = Math.max(0, Number(amountApproved) || 0);
    const received = Math.max(0, Number(amountReceived) || 0);

    if (!claimPolicyId || !claimTitle.trim() || !hospital.trim() || claimed <= 0) {
      showToast('Missing required claim fields', 'warning');
      return;
    }

    await saveEntity('medicalClaims', {
      id: editingClaim?.id,
      policyId: claimPolicyId,
      title: claimTitle.trim(),
      hospital: hospital.trim(),
      treatmentDate,
      submissionDate,
      medicalExpenseAmount: Math.max(exp, claimed),
      amountClaimed: claimed,
      amountApproved:
        claimStatus === 'draft' || claimStatus === 'submitted' || claimStatus === 'under_review' || claimStatus === 'rejected'
          ? 0
          : approved,
      amountReceived: claimStatus === 'reimbursement_received' ? received || approved : received,
      status: claimStatus,
      claimReference: claimReference.trim() || null,
      notes: claimNotes.trim() || null,
    });
    showToast(editingClaim ? 'Claim updated' : 'Medical claim recorded', 'success');
    setClaimModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* KPI Strip separating Coverage Consumed vs Approved vs Received vs Receivable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#273449] bg-[#151F30] p-4">
          <p className="text-xs text-[#94A3B8]">Remaining Coverage</p>
          <p className="mt-1.5 font-display text-xl font-bold text-[#24D6A0] font-mono-num">
            {fmt(overview.remainingCoverage)}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Total Sum Insured: {fmt(overview.totalCoverage)}
          </p>
        </div>

        <div className="rounded-xl border border-[#273449] bg-[#151F30] p-4">
          <p className="text-xs text-[#94A3B8]">Coverage Consumed (Approved)</p>
          <p className="mt-1.5 font-display text-xl font-bold text-[#39A0ED] font-mono-num">
            {fmt(overview.coverageConsumed)}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Pending claims ({overview.pendingClaimsCount}) do not reduce cover
          </p>
        </div>

        <div className="rounded-xl border border-[#273449] bg-[#151F30] p-4">
          <p className="text-xs text-[#94A3B8]">Reimbursements Received</p>
          <p className="mt-1.5 font-display text-xl font-bold text-[#28C997] font-mono-num">
            {fmt(overview.totalReceived)}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Total Claimed: {fmt(overview.totalClaimed)}
          </p>
        </div>

        <div className="rounded-xl border border-[#273449] bg-[#151F30] p-4">
          <p className="text-xs text-[#94A3B8]">Approved Still Receivable</p>
          <p className="mt-1.5 font-display text-xl font-bold text-[#F6B94A] font-mono-num">
            {fmt(overview.amountStillReceivable)}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Approved: {fmt(overview.totalApproved)} − Received
          </p>
        </div>
      </div>

      {/* Tabs + Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-lg border border-[#273449] bg-[#101827] p-1">
          <button
            type="button"
            onClick={() => setTab('claims')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'claims' ? 'bg-[#1B2940] text-[#24D6A0]' : 'text-[#94A3B8] hover:text-[#F5F7FA]'
            }`}
          >
            Medical Claims ({claims.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('policies')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'policies'
                ? 'bg-[#1B2940] text-[#24D6A0]'
                : 'text-[#94A3B8] hover:text-[#F5F7FA]'
            }`}
          >
            Insurance Policies ({policies.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openPolicyForm()}
            className="flex items-center gap-1.5 rounded-lg border border-[#273449] bg-[#151F30] px-3.5 py-2 text-xs font-medium text-[#F5F7FA] hover:bg-[#1B2940]"
          >
            <Plus className="h-3.5 w-3.5 text-[#39A0ED]" />
            <span>Add Policy</span>
          </button>
          <button
            type="button"
            onClick={() => openClaimForm()}
            disabled={policies.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[#24D6A0] px-4 py-2 text-xs font-semibold text-[#080D16] hover:bg-[#28C997] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>File Claim</span>
          </button>
        </div>
      </div>

      {tab === 'claims' ? (
        claims.length === 0 ? (
          <EmptyState
            icon={FileHeart}
            title="No medical claims recorded"
            description="Track hospitalization bills, submitted claims, approved limits, and pending reimbursements."
            actionLabel={policies.length > 0 ? 'Record Medical Claim' : 'Add Insurance Policy First'}
            onAction={() => (policies.length > 0 ? openClaimForm() : openPolicyForm())}
          />
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => {
              const policy = policyMap.get(claim.policyId);
              const meta = CLAIM_STATUS_LABELS[claim.status];
              const isLocked = claim.status === 'reimbursement_received';
              const receivable = Math.max(0, (claim.amountApproved || 0) - (claim.amountReceived || 0));

              return (
                <div
                  key={claim.id}
                  className="rounded-xl border border-[#273449] bg-[#151F30] p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-[#94A3B8]">
                        {policy ? `${policy.company} · ${policy.policyName}` : 'Policy'} ·{' '}
                        {formatDateDisplay(claim.treatmentDate, prefs.dateFormat)}
                        {claim.claimReference ? ` · Ref: ${claim.claimReference}` : ''}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-[#F5F7FA]">{claim.title}</h3>
                      <p className="text-xs text-[#94A3B8] mt-0.5">{claim.hospital}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold ${meta.color}`}>
                        {meta.label}
                      </span>
                      {isLocked ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-[#94A3B8]"
                          title="Settled claim locked"
                        >
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openClaimForm(claim)}
                          className="rounded-lg border border-[#273449] px-3 py-1 text-xs text-[#F5F7FA] hover:bg-[#1B2940]"
                        >
                          Update
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({ kind: 'claim', id: claim.id, label: claim.title })
                        }
                        className="rounded p-1.5 text-[#94A3B8] hover:text-[#F16C78]"
                        aria-label="Delete claim"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                      <span className="text-[#94A3B8]">Hospital Bill</span>
                      <p className="mt-1 font-semibold text-[#F5F7FA] font-mono-num">
                        {fmt(claim.medicalExpenseAmount)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                      <span className="text-[#94A3B8]">Amount Claimed</span>
                      <p className="mt-1 font-semibold text-[#39A0ED] font-mono-num">
                        {fmt(claim.amountClaimed)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                      <span className="text-[#94A3B8]">Approved</span>
                      <p className="mt-1 font-semibold text-[#24D6A0] font-mono-num">
                        {fmt(claim.amountApproved)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                      <span className="text-[#94A3B8]">Received / Receivable</span>
                      <p className="mt-1 font-semibold text-[#F5F7FA] font-mono-num">
                        {fmt(claim.amountReceived)}
                        {receivable > 0 && (
                          <span className="text-[#F6B94A]"> ({fmt(receivable)} due)</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : policies.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No health insurance policies"
          description="Add your family or individual policies to track sum insured and renewal dates."
          actionLabel="Add Policy"
          onAction={() => openPolicyForm()}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {policies.map((p) => {
            const daysToRenewal = Math.ceil(
              (new Date(`${p.renewalDate}T00:00:00`).getTime() -
                new Date(`${today}T00:00:00`).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            const policyConsumed = claims
              .filter(
                (c) =>
                  c.policyId === p.id &&
                  (c.status === 'approved' ||
                    c.status === 'partially_approved' ||
                    c.status === 'reimbursement_received')
              )
              .reduce((sum, c) => sum + (c.amountApproved || 0), 0);

            return (
              <div
                key={p.id}
                className="rounded-xl border border-[#273449] bg-[#151F30] p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-[#94A3B8]">
                        {p.company} · {p.policyNumberMasked}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-[#F5F7FA]">
                        {p.policyName}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openPolicyForm(p)}
                        className="rounded px-2 py-1 text-xs text-[#94A3B8] hover:text-[#F5F7FA]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({ kind: 'policy', id: p.id, label: p.policyName })
                        }
                        className="rounded p-1.5 text-[#94A3B8] hover:text-[#F16C78]"
                        aria-label="Delete policy"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                      <span className="text-[#94A3B8]">Sum Insured</span>
                      <p className="mt-1 font-bold text-[#F5F7FA] font-mono-num">
                        {fmt(p.sumInsured)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                      <span className="text-[#94A3B8]">Consumed</span>
                      <p className="mt-1 font-bold text-[#39A0ED] font-mono-num">
                        {fmt(policyConsumed)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                      <span className="text-[#94A3B8]">Annual Premium</span>
                      <p className="mt-1 font-bold text-[#F5F7FA] font-mono-num">
                        {fmt(p.premiumAmount)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#273449] pt-3 flex items-center justify-between text-xs text-[#94A3B8]">
                  <span>
                    Renewal: {formatDateDisplay(p.renewalDate, prefs.dateFormat)}
                  </span>
                  <span className={daysToRenewal <= 30 ? 'text-[#F6B94A] font-medium' : ''}>
                    {daysToRenewal < 0
                      ? `Expired ${Math.abs(daysToRenewal)}d ago`
                      : daysToRenewal === 0
                        ? 'Renews today'
                        : `In ${daysToRenewal} days`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Policy Modal */}
      <Modal
        open={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        title={editingPolicy ? 'Edit Insurance Policy' : 'Add Health Insurance Policy'}
      >
        <form onSubmit={handleSavePolicy} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Insurer / Company *</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. HDFC ERGO"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Policy Name *</label>
              <input
                type="text"
                value={policyName}
                onChange={(e) => setPolicyName(e.target.value)}
                placeholder="e.g. Optima Secure Family Floater"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">
                Policy Number (auto-masked)
              </label>
              <input
                type="text"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                placeholder="Last 4 digits or full"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Sum Insured *</label>
              <input
                type="number"
                min="1"
                value={sumInsured}
                onChange={(e) => setSumInsured(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Annual Premium</label>
              <input
                type="number"
                min="0"
                value={premiumAmount}
                onChange={(e) => setPremiumAmount(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Renewal Date</label>
              <input
                type="date"
                value={renewalDate}
                onChange={(e) => setRenewalDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPolicyModalOpen(false)}
              className="rounded-lg border border-[#273449] px-4 py-2 text-sm text-[#94A3B8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#24D6A0] px-5 py-2 text-sm font-semibold text-[#080D16]"
            >
              Save Policy
            </button>
          </div>
        </form>
      </Modal>

      {/* Claim Modal */}
      <Modal
        open={claimModalOpen}
        onClose={() => setClaimModalOpen(false)}
        title={editingClaim ? 'Update Medical Claim' : 'Record Medical Claim'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveClaim} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Insurance Policy *</label>
              <select
                value={claimPolicyId}
                onChange={(e) => setClaimPolicyId(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              >
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.company} — {p.policyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Claim Status *</label>
              <select
                value={claimStatus}
                onChange={(e) => setClaimStatus(e.target.value as ClaimStatus)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              >
                {Object.entries(CLAIM_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Claim Title *</label>
              <input
                type="text"
                value={claimTitle}
                onChange={(e) => setClaimTitle(e.target.value)}
                placeholder="e.g. Diagnostic & Daycare Procedure"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Hospital / Clinic *</label>
              <input
                type="text"
                value={hospital}
                onChange={(e) => setHospital(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Medical Bill</label>
              <input
                type="number"
                min="0"
                value={medicalExpenseAmount}
                onChange={(e) => setMedicalExpenseAmount(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Claimed *</label>
              <input
                type="number"
                min="1"
                value={amountClaimed}
                onChange={(e) => setAmountClaimed(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Approved</label>
              <input
                type="number"
                min="0"
                value={amountApproved}
                onChange={(e) => setAmountApproved(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Received</label>
              <input
                type="number"
                min="0"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Treatment Date</label>
              <input
                type="date"
                value={treatmentDate}
                onChange={(e) => setTreatmentDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Submission Date</label>
              <input
                type="date"
                value={submissionDate}
                onChange={(e) => setSubmissionDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Claim Reference</label>
              <input
                type="text"
                value={claimReference}
                onChange={(e) => setClaimReference(e.target.value)}
                placeholder="CLM-..."
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setClaimModalOpen(false)}
              className="rounded-lg border border-[#273449] px-4 py-2 text-sm text-[#94A3B8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#24D6A0] px-5 py-2 text-sm font-semibold text-[#080D16]"
            >
              Save Claim
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Insurance Record"
        message={`Remove "${deleteTarget?.label}"?`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === 'policy') {
            await deleteEntity('insurancePolicies', deleteTarget.id);
          } else {
            await deleteEntity('medicalClaims', deleteTarget.id);
          }
          showToast('Removed', 'info');
        }}
      />
    </div>
  );
};
