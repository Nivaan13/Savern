import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Info } from 'lucide-react';
import { useSavern } from '../context/SavernContext.tsx';
import { SavernLogo } from './SavernLogo.tsx';

const STEPS = [
  'Welcome',
  'Opening Balance',
  'Currency',
  'Monthly Income',
  'Monthly Budget',
  'Timezone',
  'Daily Reminder',
  'Finish',
];

export const OnboardingWizard: React.FC = () => {
  const { user, completeOnboarding } = useSavern();
  const [step, setStep] = useState(0);
  const [accountName, setAccountName] = useState('Primary Bank Account');
  const [openingBalance, setOpeningBalance] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(true);
  const [dailyReminderTime, setDailyReminderTime] = useState('22:00');
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    try {
      await completeOnboarding({
        openingBalance: Math.max(0, Number(openingBalance) || 0),
        accountName: accountName.trim() || 'Primary Bank Account',
        currency,
        monthlyIncome: Math.max(0, Number(monthlyIncome) || 0),
        monthlyBudget: Math.max(0, Number(monthlyBudget) || 0),
        timezone,
        dailyReminderEnabled,
        dailyReminderTime,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080D16] flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-xl border border-[#273449] bg-[#151F30] p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#273449] pb-4">
          <SavernLogo size="md" />
          <span className="text-xs font-medium text-[#94A3B8] font-mono-num">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#101827]">
          <div
            className="h-full bg-[#24D6A0] transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="mt-6 min-h-[220px]">
          {step === 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-2xl font-bold text-[#F5F7FA]">
                Welcome to SAVERN{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}
              </h2>
              <p className="text-sm leading-relaxed text-[#94A3B8]">
                Your Money. Your Goals. Your Control. Let's configure your starting financial
                baseline in under a minute. You can skip any optional step and adjust settings later.
              </p>
              <div className="rounded-lg border border-[#273449] bg-[#101827] p-4 text-xs text-[#94A3B8]">
                Savern stores your personal records locally in IndexedDB for offline access and syncs
                them securely to your private cloud workspace.
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-[#F5F7FA]">
                Enter Opening Balance
              </h2>
              <div className="flex items-start gap-2.5 rounded-lg border border-[#39A0ED]/30 bg-[#39A0ED]/10 p-3 text-xs text-[#94A3B8]">
                <Info className="h-4 w-4 shrink-0 text-[#39A0ED] mt-0.5" />
                <span>
                  Your opening balance is the money already available when you begin tracking—it is{' '}
                  <strong className="text-[#F5F7FA]">not</strong> counted as new monthly income.
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                  Account Name
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                  Current Available Balance
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-[#F5F7FA]">
                Select Preferred Currency
              </h2>
              <p className="text-sm text-[#94A3B8]">
                Default regional formatting uses Indian numbering (₹1,00,000) and April–March FY.
              </p>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2.5 text-sm text-[#F5F7FA]"
              >
                <option value="INR">INR (₹) — Indian Rupee</option>
                <option value="USD">USD ($) — US Dollar</option>
                <option value="EUR">EUR (€) — Euro</option>
                <option value="GBP">GBP (£) — British Pound</option>
                <option value="AED">AED — UAE Dirham</option>
              </select>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-[#F5F7FA]">
                Record Initial Monthly Income (Optional)
              </h2>
              <p className="text-sm text-[#94A3B8]">
                If you want to log this month's salary or primary income right away, enter it below.
              </p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                placeholder="Optional (e.g. 30000)"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2.5 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-[#F5F7FA]">
                Set Monthly Spending Budget
              </h2>
              <p className="text-sm text-[#94A3B8]">
                Savern alerts you at 50%, 75%, 90%, and 100% of your monthly spending limit.
              </p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                placeholder="e.g. 20000"
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2.5 text-sm text-[#F5F7FA] font-mono-num"
              />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-[#F5F7FA]">Select Timezone</h2>
              <p className="text-sm text-[#94A3B8]">
                Used for month boundaries, daily reminders, and financial calendar dates.
              </p>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2.5 text-sm text-[#F5F7FA]"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Asia/Singapore">Asia/Singapore</option>
              </select>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-[#F5F7FA]">
                Daily Expense Reminder
              </h2>
              <p className="text-sm text-[#94A3B8]">
                Default reminder is at 22:00 while Savern is active to keep daily logs accurate.
              </p>
              <label className="flex items-center gap-3 rounded-lg border border-[#273449] bg-[#101827] p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dailyReminderEnabled}
                  onChange={(e) => setDailyReminderEnabled(e.target.checked)}
                  className="rounded border-[#273449] text-[#24D6A0]"
                />
                <span className="text-sm text-[#F5F7FA]">Enable daily expense reminder</span>
              </label>
              {dailyReminderEnabled && (
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    Reminder Time
                  </label>
                  <input
                    type="time"
                    value={dailyReminderTime}
                    onChange={(e) => setDailyReminderTime(e.target.value)}
                    className="rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA]"
                  />
                </div>
              )}
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-7 w-7 text-[#24D6A0]" />
                <h2 className="font-display text-xl font-bold text-[#F5F7FA]">
                  Ready to Launch SAVERN
                </h2>
              </div>
              <div className="rounded-xl border border-[#273449] bg-[#101827] p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Account</span>
                  <span className="font-medium text-[#F5F7FA]">{accountName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Opening Balance</span>
                  <span className="font-mono-num text-[#24D6A0]">
                    {currency} {Number(openingBalance || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Monthly Budget</span>
                  <span className="font-mono-num text-[#F5F7FA]">
                    {monthlyBudget ? `${currency} ${Number(monthlyBudget).toLocaleString()}` : 'Not set yet'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Timezone & Reminder</span>
                  <span className="text-[#F5F7FA]">
                    {timezone} · {dailyReminderEnabled ? dailyReminderTime : 'Off'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-[#273449] pt-4">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="flex items-center gap-1.5 rounded-lg border border-[#273449] bg-[#101827] px-4 py-2 text-sm text-[#94A3B8] hover:text-[#F5F7FA] disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && step < STEPS.length - 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-[#94A3B8] hover:text-[#F5F7FA]"
              >
                Skip
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="flex items-center gap-1.5 rounded-lg bg-[#24D6A0] px-5 py-2 text-sm font-semibold text-[#080D16] hover:bg-[#28C997]"
              >
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={finish}
                className="rounded-lg bg-[#24D6A0] px-6 py-2 text-sm font-semibold text-[#080D16] hover:bg-[#28C997] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Finish Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
