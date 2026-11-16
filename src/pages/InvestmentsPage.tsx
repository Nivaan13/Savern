import React, { useMemo, useState } from 'react';
import { Info, Pause, Play, Plus, RefreshCw, Trash2, TrendingUp } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useSavern } from '../context/SavernContext.tsx';
import { Investment, SipPlan } from '../types/finance.ts';
import {
  activeRecords,
  calculatePortfolioSummary,
  formatCurrency,
  formatDateDisplay,
  getTodayISO,
} from '../lib/financeEngine.ts';
import { Modal } from '../components/ui/Modal.tsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';

const ALLOC_COLORS = ['#24D6A0', '#39A0ED', '#A78BFA', '#F6B94A', '#2DD4BF', '#FB7185'];

export const InvestmentsPage: React.FC = () => {
  const { data, saveEntity, deleteEntity, showToast } = useSavern();
  const prefs = data.userPreferences;
  const today = getTodayISO();

  const investments = useMemo(() => activeRecords(data.investments), [data.investments]);
  const sipPlans = useMemo(() => activeRecords(data.sipPlans), [data.sipPlans]);

  const portfolio = useMemo(
    () => calculatePortfolioSummary(investments, sipPlans),
    [investments, sipPlans]
  );

  // Fund Modal
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [editingFund, setEditingFund] = useState<Investment | null>(null);
  const [fundName, setFundName] = useState('');
  const [amc, setAmc] = useState('');
  const [schemeCategory, setSchemeCategory] = useState('Flexi Cap');
  const [investmentDate, setInvestmentDate] = useState(today);
  const [investedAmount, setInvestedAmount] = useState('');
  const [units, setUnits] = useState('');
  const [purchaseNav, setPurchaseNav] = useState('');
  const [currentNav, setCurrentNav] = useState('');

  // Quick NAV update modal
  const [navTarget, setNavTarget] = useState<Investment | null>(null);
  const [navInput, setNavInput] = useState('');

  // SIP Modal
  const [sipModalOpen, setSipModalOpen] = useState(false);
  const [sipName, setSipName] = useState('');
  const [sipFundId, setSipFundId] = useState('');
  const [sipAmount, setSipAmount] = useState('5000');
  const [sipStartDate, setSipStartDate] = useState(today);
  const [sipNextDate, setSipNextDate] = useState(today);
  const [sipInstallmentDay, setSipInstallmentDay] = useState('10');
  const [sipTotalInstallments, setSipTotalInstallments] = useState('60');

  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'fund' | 'sip';
    id: string;
    label: string;
  } | null>(null);

  const fmt = (v: number) => formatCurrency(v, prefs.currency, prefs.numberFormat, prefs.hideAmounts);

  const allocationData = useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const h of portfolio.holdings) {
      byCat[h.schemeCategory] = (byCat[h.schemeCategory] || 0) + h.currentValue;
    }
    return Object.entries(byCat).map(([name, value]) => ({
      name,
      value: Math.round(value),
    }));
  }, [portfolio.holdings]);

  const openFundForm = (inv?: Investment) => {
    setEditingFund(inv || null);
    setFundName(inv?.fundName || '');
    setAmc(inv?.amc || '');
    setSchemeCategory(inv?.schemeCategory || 'Flexi Cap');
    setInvestmentDate(inv?.investmentDate || today);
    setInvestedAmount(inv ? String(inv.investedAmount) : '');
    setUnits(inv ? String(inv.units) : '');
    setPurchaseNav(inv ? String(inv.purchaseNav) : '');
    setCurrentNav(inv ? String(inv.currentNav) : '');
    setFundModalOpen(true);
  };

  const handleSaveFund = async (e: React.FormEvent) => {
    e.preventDefault();
    const invAmt = Number(investedAmount);
    const pNav = Number(purchaseNav);
    const cNav = Number(currentNav) || pNav;
    const calcUnits = Number(units) || (pNav > 0 ? Math.round((invAmt / pNav) * 10000) / 10000 : 0);

    if (!fundName.trim() || !amc.trim() || invAmt <= 0 || calcUnits <= 0 || cNav <= 0) {
      showToast('Enter valid fund, invested amount, and NAV figures', 'warning');
      return;
    }

    await saveEntity('investments', {
      id: editingFund?.id,
      fundName: fundName.trim(),
      amc: amc.trim(),
      schemeCategory: schemeCategory.trim() || 'Equity',
      investmentDate,
      investedAmount: invAmt,
      units: calcUnits,
      purchaseNav: pNav > 0 ? pNav : invAmt / calcUnits,
      currentNav: cNav,
      notes: null,
    });
    showToast(editingFund ? 'Holding updated' : 'Mutual fund added', 'success');
    setFundModalOpen(false);
  };

  const handleQuickNavUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navTarget) return;
    const nextNav = Number(navInput);
    if (!Number.isFinite(nextNav) || nextNav <= 0) return;
    await saveEntity('investments', {
      ...navTarget,
      currentNav: nextNav,
    });
    showToast(`Updated NAV for ${navTarget.fundName}`, 'success');
    setNavTarget(null);
  };

  const handleSaveSip = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(sipAmount);
    const linked = investments.find((i) => i.id === sipFundId);
    if (!sipName.trim() || amt <= 0) return;

    await saveEntity('sipPlans', {
      sipName: sipName.trim(),
      fundId: linked?.id || '',
      fundName: linked?.fundName || sipName.trim(),
      monthlyAmount: amt,
      startDate: sipStartDate,
      frequency: 'monthly',
      installmentDay: Math.min(28, Math.max(1, Number(sipInstallmentDay) || 10)),
      totalInstallments: Math.max(1, Number(sipTotalInstallments) || 60),
      completedInstallments: 0,
      nextInstallmentDate: sipNextDate,
      status: 'active',
    });
    showToast('SIP plan added', 'success');
    setSipModalOpen(false);
  };

  const handleToggleSipStatus = async (sip: SipPlan) => {
    await saveEntity('sipPlans', {
      ...sip,
      status: sip.status === 'active' ? 'paused' : 'active',
    });
    showToast(`SIP ${sip.status === 'active' ? 'paused' : 'resumed'}`, 'info');
  };

  const handleRecordSipInstallment = async (sip: SipPlan) => {
    const nextDate = new Date(`${sip.nextInstallmentDate}T00:00:00`);
    nextDate.setMonth(nextDate.getMonth() + 1);
    await saveEntity('sipPlans', {
      ...sip,
      completedInstallments: sip.completedInstallments + 1,
      nextInstallmentDate: nextDate.toISOString().slice(0, 10),
    });

    const linked = investments.find((i) => i.id === sip.fundId);
    if (linked && linked.currentNav > 0) {
      const addedUnits = Math.round((sip.monthlyAmount / linked.currentNav) * 10000) / 10000;
      await saveEntity('investments', {
        ...linked,
        investedAmount: linked.investedAmount + sip.monthlyAmount,
        units: Math.round((linked.units + addedUnits) * 10000) / 10000,
      });
    }
    showToast('SIP installment recorded', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Honest Manual NAV Disclosure */}
      <div className="flex items-start gap-3 rounded-xl border border-[#39A0ED]/30 bg-[#39A0ED]/10 px-4 py-3 text-xs text-[#94A3B8]">
        <Info className="h-4 w-4 shrink-0 text-[#39A0ED] mt-0.5" />
        <p>
          <strong className="text-[#F5F7FA]">Manual NAV Tracking:</strong> NAVs, units, and returns
          are manually entered and maintained for personal portfolio tracking. Savern does not connect
          to live brokerage/AMC feeds and does not provide financial or investment advice.
        </p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#273449] bg-[#151F30] p-4">
          <p className="text-xs text-[#94A3B8]">Total Invested</p>
          <p className="mt-1.5 font-display text-xl font-bold text-[#F5F7FA] font-mono-num">
            {fmt(portfolio.totalInvested)}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">{portfolio.holdings.length} mutual funds</p>
        </div>

        <div className="rounded-xl border border-[#273449] bg-[#151F30] p-4">
          <p className="text-xs text-[#94A3B8]">Current Portfolio Value</p>
          <p className="mt-1.5 font-display text-xl font-bold text-[#24D6A0] font-mono-num">
            {fmt(portfolio.currentValue)}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">Based on latest manual NAVs</p>
        </div>

        <div className="rounded-xl border border-[#273449] bg-[#151F30] p-4">
          <p className="text-xs text-[#94A3B8]">Unrealized Profit / Loss</p>
          <p
            className={`mt-1.5 font-display text-xl font-bold font-mono-num ${
              portfolio.profitLoss >= 0 ? 'text-[#28C997]' : 'text-[#F16C78]'
            }`}
          >
            {portfolio.profitLoss >= 0 ? '+' : ''}
            {fmt(portfolio.profitLoss)}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8] font-mono-num">
            Absolute Return: {portfolio.absoluteReturnPct >= 0 ? '+' : ''}
            {portfolio.absoluteReturnPct}%
          </p>
        </div>

        <div className="rounded-xl border border-[#273449] bg-[#151F30] p-4">
          <p className="text-xs text-[#94A3B8]">Monthly SIP Commitment</p>
          <p className="mt-1.5 font-display text-xl font-bold text-[#39A0ED] font-mono-num">
            {fmt(portfolio.monthlySipCommitment)}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            {portfolio.activeSipsCount} active SIP plan{portfolio.activeSipsCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Holdings & Allocation */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-[#F5F7FA]">
              Mutual Fund Holdings
            </h2>
            <button
              type="button"
              onClick={() => openFundForm()}
              className="flex items-center gap-1.5 rounded-lg bg-[#24D6A0] px-3.5 py-2 text-xs font-semibold text-[#080D16] hover:bg-[#28C997]"
            >
              <Plus className="h-4 w-4" />
              <span>Add Mutual Fund</span>
            </button>
          </div>

          {portfolio.holdings.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No mutual fund holdings"
              description="Add your mutual fund investments with purchase and current NAVs to monitor unrealized returns."
              actionLabel="Add Holding"
              onAction={() => openFundForm()}
            />
          ) : (
            <div className="space-y-3">
              {portfolio.holdings.map((h) => (
                <div
                  key={h.id}
                  className="rounded-xl border border-[#273449] bg-[#151F30] p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-[#94A3B8]">
                        {h.amc} · {h.schemeCategory} · {h.units.toFixed(3)} units
                      </p>
                      <h3 className="mt-0.5 text-sm font-semibold text-[#F5F7FA]">{h.fundName}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNavTarget(h);
                          setNavInput(String(h.currentNav));
                        }}
                        className="flex items-center gap-1 rounded-lg border border-[#273449] bg-[#101827] px-2.5 py-1 text-xs text-[#39A0ED] hover:bg-[#1B2940]"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Update NAV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openFundForm(h)}
                        className="rounded px-2 py-1 text-xs text-[#94A3B8] hover:text-[#F5F7FA]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({ kind: 'fund', id: h.id, label: h.fundName })
                        }
                        className="rounded p-1 text-[#94A3B8] hover:text-[#F16C78]"
                        aria-label="Delete holding"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-2.5">
                      <span className="text-[#94A3B8]">Invested</span>
                      <p className="mt-0.5 font-semibold text-[#F5F7FA] font-mono-num">
                        {fmt(h.investedAmount)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-2.5">
                      <span className="text-[#94A3B8]">Current Value</span>
                      <p className="mt-0.5 font-semibold text-[#F5F7FA] font-mono-num">
                        {fmt(h.currentValue)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-2.5">
                      <span className="text-[#94A3B8]">Purchase → Current NAV</span>
                      <p className="mt-0.5 font-semibold text-[#94A3B8] font-mono-num">
                        ₹{h.purchaseNav.toFixed(2)} → ₹{h.currentNav.toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#101827] border border-[#273449] p-2.5">
                      <span className="text-[#94A3B8]">Unrealized P&L</span>
                      <p
                        className={`mt-0.5 font-semibold font-mono-num ${
                          h.profitLoss >= 0 ? 'text-[#28C997]' : 'text-[#F16C78]'
                        }`}
                      >
                        {h.profitLoss >= 0 ? '+' : ''}
                        {fmt(h.profitLoss)} ({h.returnPct >= 0 ? '+' : ''}
                        {h.returnPct}%)
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Allocation Chart */}
        <div className="rounded-xl border border-[#273449] bg-[#151F30] p-5 flex flex-col">
          <h3 className="font-display text-base font-semibold text-[#F5F7FA]">
            Scheme Allocation
          </h3>
          <p className="text-xs text-[#94A3B8]">Current portfolio value by category</p>

          {allocationData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12 text-xs text-[#94A3B8]">
              Add mutual funds to inspect allocation.
            </div>
          ) : (
            <>
              <div className="h-56 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {allocationData.map((entry, idx) => (
                        <Cell
                          key={entry.name}
                          fill={ALLOC_COLORS[idx % ALLOC_COLORS.length]}
                        />
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
                      formatter={(value: unknown) => fmt(Number(value) || 0)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {allocationData.map((entry, idx) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-[#94A3B8]">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: ALLOC_COLORS[idx % ALLOC_COLORS.length] }}
                      />
                      {entry.name}
                    </span>
                    <span className="font-mono-num text-[#F5F7FA]">{fmt(entry.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* SIP Tracker */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-[#F5F7FA]">SIP Plans</h2>
            <p className="text-xs text-[#94A3B8]">
              Track systematic installment schedules and record completed SIPs
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSipFundId(investments[0]?.id || '');
              setSipModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[#273449] bg-[#151F30] px-3.5 py-2 text-xs font-medium text-[#F5F7FA] hover:bg-[#1B2940]"
          >
            <Plus className="h-3.5 w-3.5 text-[#24D6A0]" />
            <span>Add SIP Plan</span>
          </button>
        </div>

        {sipPlans.length === 0 ? (
          <div className="rounded-xl border border-[#273449] bg-[#151F30] p-6 text-center text-xs text-[#94A3B8]">
            No active or paused SIP schedules configured yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sipPlans.map((sip) => (
              <div
                key={sip.id}
                className="rounded-xl border border-[#273449] bg-[#151F30] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-[#94A3B8]">
                      {sip.fundName} · Day {sip.installmentDay} ·{' '}
                      <span
                        className={
                          sip.status === 'active' ? 'text-[#28C997]' : 'text-[#F6B94A]'
                        }
                      >
                        {sip.status === 'active' ? 'Active' : 'Paused'}
                      </span>
                    </p>
                    <h3 className="mt-0.5 text-sm font-semibold text-[#F5F7FA]">{sip.sipName}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleSipStatus(sip)}
                      className="rounded p-1.5 text-[#94A3B8] hover:text-[#F5F7FA]"
                      title={sip.status === 'active' ? 'Pause SIP' : 'Resume SIP'}
                    >
                      {sip.status === 'active' ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({ kind: 'sip', id: sip.id, label: sip.sipName })
                      }
                      className="rounded p-1.5 text-[#94A3B8] hover:text-[#F16C78]"
                      aria-label="Delete SIP"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-[#273449] pt-3">
                  <div>
                    <span className="text-[#94A3B8]">
                      {fmt(sip.monthlyAmount)}/mo · {sip.completedInstallments}/
                      {sip.totalInstallments} done
                    </span>
                    <p className="text-[#94A3B8] mt-0.5">
                      Next: {formatDateDisplay(sip.nextInstallmentDate, prefs.dateFormat)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRecordSipInstallment(sip)}
                    className="rounded-lg bg-[#24D6A0] px-3 py-1.5 text-xs font-semibold text-[#080D16] hover:bg-[#28C997]"
                  >
                    Record SIP
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Mutual Fund Modal */}
      <Modal
        open={fundModalOpen}
        onClose={() => setFundModalOpen(false)}
        title={editingFund ? 'Edit Mutual Fund Holding' : 'Add Mutual Fund Holding'}
      >
        <form onSubmit={handleSaveFund} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Fund Name *</label>
              <input
                type="text"
                value={fundName}
                onChange={(e) => setFundName(e.target.value)}
                placeholder="e.g. Parag Parikh Flexi Cap Direct"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">AMC *</label>
              <input
                type="text"
                value={amc}
                onChange={(e) => setAmc(e.target.value)}
                placeholder="e.g. PPFAS Mutual Fund"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Scheme Category</label>
              <select
                value={schemeCategory}
                onChange={(e) => setSchemeCategory(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              >
                <option value="Flexi Cap">Flexi Cap</option>
                <option value="Large Cap">Large Cap</option>
                <option value="Mid Cap">Mid Cap</option>
                <option value="Small Cap">Small Cap</option>
                <option value="Index Fund">Index Fund</option>
                <option value="ELSS Tax Saver">ELSS Tax Saver</option>
                <option value="Debt / Liquid">Debt / Liquid</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Investment Date</label>
              <input
                type="date"
                value={investmentDate}
                onChange={(e) => setInvestmentDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Invested Amt *</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={investedAmount}
                onChange={(e) => setInvestedAmount(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Units</label>
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="Auto if blank"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Purchase NAV *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={purchaseNav}
                onChange={(e) => setPurchaseNav(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Current NAV *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={currentNav}
                onChange={(e) => setCurrentNav(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFundModalOpen(false)}
              className="rounded-lg border border-[#273449] px-4 py-2 text-sm text-[#94A3B8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#24D6A0] px-5 py-2 text-sm font-semibold text-[#080D16]"
            >
              Save Holding
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Update NAV Modal */}
      <Modal
        open={!!navTarget}
        onClose={() => setNavTarget(null)}
        title="Update Manual NAV"
        subtitle={navTarget?.fundName}
      >
        <form onSubmit={handleQuickNavUpdate} className="space-y-4">
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Latest NAV</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={navInput}
              onChange={(e) => setNavInput(e.target.value)}
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              required
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setNavTarget(null)}
              className="rounded-lg border border-[#273449] px-4 py-2 text-sm text-[#94A3B8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#24D6A0] px-5 py-2 text-sm font-semibold text-[#080D16]"
            >
              Update NAV
            </button>
          </div>
        </form>
      </Modal>

      {/* Add SIP Modal */}
      <Modal open={sipModalOpen} onClose={() => setSipModalOpen(false)} title="Add SIP Plan">
        <form onSubmit={handleSaveSip} className="space-y-4">
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">SIP Name *</label>
            <input
              type="text"
              value={sipName}
              onChange={(e) => setSipName(e.target.value)}
              placeholder="e.g. Monthly Flexi Cap SIP"
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              required
            />
          </div>

          {investments.length > 0 && (
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Linked Mutual Fund</label>
              <select
                value={sipFundId}
                onChange={(e) => setSipFundId(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              >
                {investments.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.fundName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Monthly Amount *</label>
              <input
                type="number"
                min="100"
                value={sipAmount}
                onChange={(e) => setSipAmount(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Day of Month</label>
              <input
                type="number"
                min="1"
                max="28"
                value={sipInstallmentDay}
                onChange={(e) => setSipInstallmentDay(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Next Date</label>
              <input
                type="date"
                value={sipNextDate}
                onChange={(e) => setSipNextDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Start Date</label>
              <input
                type="date"
                value={sipStartDate}
                onChange={(e) => setSipStartDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Total Installments</label>
              <input
                type="number"
                min="1"
                value={sipTotalInstallments}
                onChange={(e) => setSipTotalInstallments(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSipModalOpen(false)}
              className="rounded-lg border border-[#273449] px-4 py-2 text-sm text-[#94A3B8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#24D6A0] px-5 py-2 text-sm font-semibold text-[#080D16]"
            >
              Save SIP Plan
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Investment Record"
        message={`Remove "${deleteTarget?.label}"?`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === 'fund') await deleteEntity('investments', deleteTarget.id);
          else await deleteEntity('sipPlans', deleteTarget.id);
          showToast('Removed', 'info');
        }}
      />
    </div>
  );
};
