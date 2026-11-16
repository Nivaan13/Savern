import React, { useMemo, useState } from 'react';
import { Edit2, Plus, Target, Trash2 } from 'lucide-react';
import { useSavern } from '../context/SavernContext.tsx';
import { SavingsContribution, SavingsGoal } from '../types/finance.ts';
import {
  activeRecords,
  calculateGoalProgress,
  formatCurrency,
  formatDateDisplay,
  getTodayISO,
} from '../lib/financeEngine.ts';
import { Modal } from '../components/ui/Modal.tsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';

const GOAL_CATEGORIES = [
  'Laptop',
  'Smartphone',
  'Bicycle',
  'Vehicle',
  'Education',
  'Vacation',
  'Emergency fund',
  'Custom',
];

export const GoalsPage: React.FC = () => {
  const { data, saveEntity, deleteEntity, showToast } = useSavern();
  const prefs = data.userPreferences;
  const today = getTodayISO();
  const accounts = activeRecords(data.accounts);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const goalsWithProgress = useMemo(() => {
    return activeRecords(data.savingsGoals).map((goal) => ({
      goal,
      progress: calculateGoalProgress(goal, data.savingsContributions, today),
    }));
  }, [data.savingsGoals, data.savingsContributions, today]);

  const totalRemaining = goalsWithProgress.reduce((s, g) => s + g.progress.remainingAmount, 0);
  const totalSaved = goalsWithProgress.reduce((s, g) => s + g.progress.savedAmount, 0);

  // Goal Create/Edit Modal
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [initialSaved, setInitialSaved] = useState('0');
  const [targetDate, setTargetDate] = useState(today);
  const [category, setCategory] = useState('Laptop');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [linkedAccountId, setLinkedAccountId] = useState('');
  const [description, setDescription] = useState('');

  // Contribution Create/Edit Modal
  const [contribGoal, setContribGoal] = useState<SavingsGoal | null>(null);
  const [editingContrib, setEditingContrib] = useState<SavingsContribution | null>(null);
  const [contribAmount, setContribAmount] = useState('');
  const [contribDate, setContribDate] = useState(today);
  const [contribAccountId, setContribAccountId] = useState('');
  const [contribNotes, setContribNotes] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'goal' | 'contrib'; id: string; label: string } | null>(null);

  const openNewGoal = () => {
    setEditingGoal(null);
    setName('');
    setTargetAmount('');
    setInitialSaved('0');
    setTargetDate(today);
    setCategory('Laptop');
    setPriority('medium');
    setLinkedAccountId(accounts[0]?.id || '');
    setDescription('');
    setGoalModalOpen(true);
  };

  const openEditGoal = (g: SavingsGoal) => {
    setEditingGoal(g);
    setName(g.name);
    setTargetAmount(String(g.targetAmount));
    setInitialSaved(String(g.initialSavedAmount));
    setTargetDate(g.targetDate);
    setCategory(g.category);
    setPriority(g.priority);
    setLinkedAccountId(g.linkedAccountId || '');
    setDescription(g.description || '');
    setGoalModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(targetAmount);
    if (!name.trim() || !Number.isFinite(target) || target <= 0) return;

    await saveEntity('savingsGoals', {
      id: editingGoal?.id,
      name: name.trim(),
      targetAmount: target,
      initialSavedAmount: Math.max(0, Number(initialSaved) || 0),
      targetDate,
      category,
      priority,
      linkedAccountId: linkedAccountId || null,
      description: description.trim() || null,
    });
    showToast(editingGoal ? 'Savings goal updated' : 'Savings goal created', 'success');
    setGoalModalOpen(false);
  };

  const openContribModal = (goal: SavingsGoal, contrib?: SavingsContribution) => {
    setContribGoal(goal);
    setEditingContrib(contrib || null);
    setContribAmount(contrib ? String(contrib.amount) : '');
    setContribDate(contrib ? contrib.date : today);
    setContribAccountId(contrib?.accountId || goal.linkedAccountId || '');
    setContribNotes(contrib?.notes || '');
  };

  const handleSaveContrib = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribGoal) return;
    const num = Number(contribAmount);
    if (!Number.isFinite(num) || num <= 0) return;

    await saveEntity('savingsContributions', {
      id: editingContrib?.id,
      goalId: contribGoal.id,
      amount: num,
      date: contribDate,
      accountId: contribAccountId || null,
      notes: contribNotes.trim() || null,
    });
    showToast(editingContrib ? 'Contribution updated' : 'Contribution recorded', 'success');
    setContribGoal(null);
  };

  const fmt = (v: number) => formatCurrency(v, prefs.currency, prefs.numberFormat, prefs.hideAmounts);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-[#94A3B8]">Total Allocated to Goals</p>
            <p className="font-display text-2xl font-bold text-[#24D6A0] font-mono-num">
              {fmt(totalSaved)}
            </p>
          </div>
          <div className="border-l border-[#273449] pl-6">
            <p className="text-xs text-[#94A3B8]">Total Remaining Requirement</p>
            <p className="font-display text-2xl font-bold text-[#F5F7FA] font-mono-num">
              {fmt(totalRemaining)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openNewGoal}
          className="flex items-center gap-1.5 rounded-lg bg-[#24D6A0] px-4 py-2 text-xs font-semibold text-[#080D16] hover:bg-[#28C997]"
        >
          <Plus className="h-4 w-4" />
          <span>Create Savings Goal</span>
        </button>
      </div>

      <div className="rounded-lg border border-[#273449] bg-[#101827] px-4 py-2.5 text-xs text-[#94A3B8]">
        Goal contributions earmark funds toward targets without double-counting your total cash or
        bank account balances.
      </div>

      {goalsWithProgress.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No savings goals yet"
          description="Every big achievement starts with a goal. Create your first savings goal for a laptop, emergency fund, or dream trip."
          actionLabel="Create First Goal"
          onAction={openNewGoal}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {goalsWithProgress.map(({ goal, progress }) => (
            <div
              key={goal.id}
              className="rounded-xl border border-[#273449] bg-[#151F30] p-5 flex flex-col justify-between gap-5"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-[#94A3B8]">
                      {goal.category} · Priority: {goal.priority}
                      {goal.linkedAccountId
                        ? ` · Linked: ${accountMap.get(goal.linkedAccountId) || 'Account'}`
                        : ''}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-[#F5F7FA]">{goal.name}</h3>
                    {goal.description && (
                      <p className="mt-1 text-xs text-[#94A3B8]">{goal.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditGoal(goal)}
                      className="rounded p-1.5 text-[#94A3B8] hover:bg-[#1B2940] hover:text-[#F5F7FA]"
                      aria-label="Edit goal"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({ kind: 'goal', id: goal.id, label: goal.name })
                      }
                      className="rounded p-1.5 text-[#94A3B8] hover:bg-[#F16C78]/10 hover:text-[#F16C78]"
                      aria-label="Delete goal"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                    <span className="text-[#94A3B8]">Saved</span>
                    <p className="mt-1 text-sm font-bold text-[#24D6A0] font-mono-num">
                      {fmt(progress.savedAmount)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                    <span className="text-[#94A3B8]">Target</span>
                    <p className="mt-1 text-sm font-bold text-[#F5F7FA] font-mono-num">
                      {fmt(goal.targetAmount)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#101827] border border-[#273449] p-3">
                    <span className="text-[#94A3B8]">Remaining</span>
                    <p className="mt-1 text-sm font-bold text-[#F6B94A] font-mono-num">
                      {fmt(progress.remainingAmount)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#94A3B8]">
                      Target date: {formatDateDisplay(goal.targetDate, prefs.dateFormat)}
                    </span>
                    <span className="font-semibold text-[#24D6A0] font-mono-num">
                      {progress.progressPct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#101827]">
                    <div
                      className="h-full bg-[#24D6A0] transition-all"
                      style={{ width: `${Math.min(100, progress.progressPct)}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#94A3B8]">
                    {progress.isCompleted
                      ? progress.exceededAmount > 0
                        ? `Goal achieved and exceeded by ${fmt(progress.exceededAmount)}.`
                        : 'Goal target completed.'
                      : progress.targetPassed
                        ? 'Target date has passed — consider adjusting your target date or adding a contribution.'
                        : `Recommended monthly savings: ${fmt(progress.requiredMonthlySavings)} / mo (${progress.monthsRemaining} mo left)`}
                  </p>
                </div>

                {/* Contribution History */}
                <div className="mt-4 border-t border-[#273449] pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[#94A3B8]">
                      Contribution History ({progress.contributions.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => openContribModal(goal)}
                      className="text-xs font-semibold text-[#24D6A0] hover:underline"
                    >
                      + Add Contribution
                    </button>
                  </div>
                  {progress.contributions.length === 0 ? (
                    <p className="text-xs text-[#94A3B8]">
                      Initial saved: {fmt(goal.initialSavedAmount)}. No additional contributions yet.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {progress.contributions.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[#101827]"
                        >
                          <span className="text-[#94A3B8]">
                            {formatDateDisplay(c.date, prefs.dateFormat)}
                            {c.notes ? ` · ${c.notes}` : ''}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono-num text-[#28C997] font-medium">
                              +{fmt(c.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => openContribModal(goal, c)}
                              className="text-[#39A0ED] hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  kind: 'contrib',
                                  id: c.id,
                                  label: `contribution of ${fmt(c.amount)}`,
                                })
                              }
                              className="text-[#F16C78] hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Goal Modal */}
      <Modal
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        title={editingGoal ? 'Edit Savings Goal' : 'Create Savings Goal'}
      >
        <form onSubmit={handleSaveGoal} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Goal Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Buy a Laptop"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              >
                {GOAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Target Amount *</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Initial Saved</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={initialSaved}
                onChange={(e) => setInitialSaved(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Target Date *</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">
                Associated Account (Optional)
              </label>
              <select
                value={linkedAccountId}
                onChange={(e) => setLinkedAccountId(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
              >
                <option value="">None</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setGoalModalOpen(false)}
              className="rounded-lg border border-[#273449] px-4 py-2 text-sm text-[#94A3B8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#24D6A0] px-5 py-2 text-sm font-semibold text-[#080D16]"
            >
              Save Goal
            </button>
          </div>
        </form>
      </Modal>

      {/* Contribution Modal */}
      <Modal
        open={!!contribGoal}
        onClose={() => setContribGoal(null)}
        title={
          editingContrib
            ? `Edit Contribution · ${contribGoal?.name}`
            : `Add Contribution · ${contribGoal?.name}`
        }
      >
        <form onSubmit={handleSaveContrib} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Amount *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={contribAmount}
                onChange={(e) => setContribAmount(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Date *</label>
              <input
                type="date"
                value={contribDate}
                onChange={(e) => setContribDate(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Source Account (Optional)</label>
            <select
              value={contribAccountId}
              onChange={(e) => setContribAccountId(e.target.value)}
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
            >
              <option value="">Not specified</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Notes</label>
            <input
              type="text"
              value={contribNotes}
              onChange={(e) => setContribNotes(e.target.value)}
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setContribGoal(null)}
              className="rounded-lg border border-[#273449] px-4 py-2 text-sm text-[#94A3B8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#24D6A0] px-5 py-2 text-sm font-semibold text-[#080D16]"
            >
              Save Contribution
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Removal"
        message={`Remove ${deleteTarget?.label}? Every change is logged cleanly.`}
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === 'goal') await deleteEntity('savingsGoals', deleteTarget.id);
          else await deleteEntity('savingsContributions', deleteTarget.id);
          showToast('Removed', 'info');
        }}
      />
    </div>
  );
};
