import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSavern } from '../context/SavernContext.tsx';
import {
  activeRecords,
  formatCurrency,
  formatDateDisplay,
  getTodayISO,
} from '../lib/financeEngine.ts';
import { Modal } from '../components/ui/Modal.tsx';

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  kind: 'emi' | 'loan' | 'sip' | 'insurance' | 'goal' | 'recurring';
  amount?: number;
  subtitle: string;
  route: string;
}

const KIND_STYLES: Record<CalendarEvent['kind'], { label: string; dot: string; text: string }> = {
  emi: { label: 'EMI Due', dot: 'bg-[#F6B94A]', text: 'text-[#F6B94A]' },
  loan: { label: 'Loan Due', dot: 'bg-[#F16C78]', text: 'text-[#F16C78]' },
  sip: { label: 'SIP Date', dot: 'bg-[#24D6A0]', text: 'text-[#24D6A0]' },
  insurance: { label: 'Insurance', dot: 'bg-[#39A0ED]', text: 'text-[#39A0ED]' },
  goal: { label: 'Goal Target', dot: 'bg-[#A78BFA]', text: 'text-[#A78BFA]' },
  recurring: { label: 'Recurring', dot: 'bg-[#2DD4BF]', text: 'text-[#2DD4BF]' },
};

export const CalendarPage: React.FC = () => {
  const { data } = useSavern();
  const prefs = data.userPreferences;
  const today = getTodayISO();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');
  const [cursorDate, setCursorDate] = useState(() => new Date(`${today}T00:00:00`));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const fmt = (v: number) => formatCurrency(v, prefs.currency, prefs.numberFormat, prefs.hideAmounts);

  const events = useMemo<CalendarEvent[]>(() => {
    const items: CalendarEvent[] = [];

    for (const emi of activeRecords(data.emiPlans)) {
      if (emi.installmentsPaid < emi.totalTenureMonths) {
        items.push({
          id: `emi_${emi.id}`,
          date: emi.nextPaymentDate,
          title: emi.loanName,
          kind: 'emi',
          amount: emi.emiAmount,
          subtitle: `${emi.lender} · Installment ${emi.installmentsPaid + 1}/${emi.totalTenureMonths}`,
          route: '/loans',
        });
      }
    }

    for (const loan of activeRecords(data.loans)) {
      items.push({
        id: `loan_${loan.id}`,
        date: loan.dueDate,
        title: loan.title,
        kind: 'loan',
        amount: loan.principalAmount,
        subtitle: `${loan.direction === 'lent' ? 'Collect from' : 'Repay'} ${loan.counterpartyName}`,
        route: '/loans',
      });
    }

    for (const sip of activeRecords(data.sipPlans)) {
      if (sip.status === 'active') {
        items.push({
          id: `sip_${sip.id}`,
          date: sip.nextInstallmentDate,
          title: sip.sipName,
          kind: 'sip',
          amount: sip.monthlyAmount,
          subtitle: sip.fundName,
          route: '/investments',
        });
      }
    }

    for (const pol of activeRecords(data.insurancePolicies)) {
      items.push({
        id: `ins_${pol.id}`,
        date: pol.renewalDate,
        title: `${pol.policyName} Renewal`,
        kind: 'insurance',
        amount: pol.premiumAmount,
        subtitle: `${pol.company} · ${pol.policyNumberMasked}`,
        route: '/medical',
      });
    }

    for (const goal of activeRecords(data.savingsGoals)) {
      items.push({
        id: `goal_${goal.id}`,
        date: goal.targetDate,
        title: `${goal.name} Target`,
        kind: 'goal',
        amount: goal.targetAmount,
        subtitle: `Savings goal milestone`,
        route: '/goals',
      });
    }

    for (const rec of activeRecords(data.recurringTransactions)) {
      if (rec.isActive) {
        items.push({
          id: `rec_${rec.id}`,
          date: rec.nextDate,
          title: rec.description,
          kind: 'recurring',
          amount: rec.amount,
          subtitle: `${rec.frequency} ${rec.type} · ${rec.category}`,
          route: '/transactions',
        });
      }
    }

    return items.sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date) || [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [events]);

  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth();
  const monthLabel = cursorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const monthCells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ iso: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ iso: null, dayNum: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ iso, dayNum: d });
    }
    return cells;
  }, [year, month]);

  const weekDays = useMemo(() => {
    const start = new Date(cursorDate);
    start.setDate(cursorDate.getDate() - cursorDate.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      return {
        iso,
        label: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }),
      };
    });
  }, [cursorDate]);

  const stepCursor = (delta: number) => {
    const next = new Date(cursorDate);
    if (viewMode === 'week') next.setDate(next.getDate() + delta * 7);
    else next.setMonth(next.getMonth() + delta);
    setCursorDate(next);
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => stepCursor(-1)}
            className="rounded-lg border border-[#273449] bg-[#151F30] p-2 text-[#94A3B8] hover:text-[#F5F7FA]"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="min-w-[160px] text-center font-display text-base font-semibold text-[#F5F7FA]">
            {monthLabel}
          </h2>
          <button
            type="button"
            onClick={() => stepCursor(1)}
            className="rounded-lg border border-[#273449] bg-[#151F30] p-2 text-[#94A3B8] hover:text-[#F5F7FA]"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursorDate(new Date(`${today}T00:00:00`))}
            className="rounded-lg border border-[#273449] bg-[#101827] px-3 py-1.5 text-xs text-[#94A3B8] hover:text-[#F5F7FA]"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-[#273449] bg-[#101827] p-1">
          {(['month', 'week', 'agenda'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setViewMode(m)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
                viewMode === m ? 'bg-[#1B2940] text-[#24D6A0]' : 'text-[#94A3B8] hover:text-[#F5F7FA]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-[#94A3B8]">
        {Object.entries(KIND_STYLES).map(([k, style]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${style.dot}`} />
            {style.label}
          </span>
        ))}
      </div>

      {viewMode === 'month' && (
        <div className="rounded-xl border border-[#273449] bg-[#151F30] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[#273449] bg-[#101827] text-center text-xs font-medium text-[#94A3B8]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2.5">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((cell, idx) => {
              const dayEvents = cell.iso ? eventsByDate.get(cell.iso) || [] : [];
              const isToday = cell.iso === today;
              return (
                <div
                  key={idx}
                  className={`min-h-[96px] border-b border-r border-[#273449] p-2 ${
                    cell.iso ? 'bg-[#151F30]' : 'bg-[#080D16]/40'
                  }`}
                >
                  {cell.dayNum && (
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-mono-num ${
                          isToday
                            ? 'rounded bg-[#24D6A0] px-1.5 py-0.5 font-bold text-[#080D16]'
                            : 'text-[#94A3B8]'
                        }`}
                      >
                        {cell.dayNum}
                      </span>
                    </div>
                  )}
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => setSelectedEvent(ev)}
                        className="flex w-full items-center gap-1.5 rounded bg-[#101827] px-1.5 py-1 text-left text-[11px] hover:bg-[#1B2940]"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND_STYLES[ev.kind].dot}`} />
                        <span className="truncate text-[#F5F7FA]">{ev.title}</span>
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[10px] text-[#94A3B8] pl-1">
                        +{dayEvents.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((wd) => {
            const dayEvents = eventsByDate.get(wd.iso) || [];
            return (
              <div
                key={wd.iso}
                className={`rounded-xl border p-3 space-y-2 ${
                  wd.iso === today
                    ? 'border-[#24D6A0]/60 bg-[#1B2940]'
                    : 'border-[#273449] bg-[#151F30]'
                }`}
              >
                <p className="text-xs font-semibold text-[#F5F7FA]">{wd.label}</p>
                {dayEvents.length === 0 ? (
                  <p className="text-xs text-[#94A3B8]/60 py-4">No due items</p>
                ) : (
                  dayEvents.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => setSelectedEvent(ev)}
                      className="w-full rounded-lg border border-[#273449] bg-[#101827] p-2 text-left text-xs hover:border-[#39A0ED]/50"
                    >
                      <span className={`font-medium ${KIND_STYLES[ev.kind].text}`}>
                        {KIND_STYLES[ev.kind].label}
                      </span>
                      <p className="mt-0.5 text-[#F5F7FA] font-medium truncate">{ev.title}</p>
                      {ev.amount !== undefined && (
                        <p className="mt-0.5 font-mono-num text-[#94A3B8]">{fmt(ev.amount)}</p>
                      )}
                    </button>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'agenda' && (
        <div className="rounded-xl border border-[#273449] bg-[#151F30] divide-y divide-[#273449]">
          {events.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#94A3B8]">
              No upcoming EMIs, loans, SIPs, renewals, or goal milestones scheduled.
            </div>
          ) : (
            events.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => setSelectedEvent(ev)}
                className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left hover:bg-[#1B2940]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${KIND_STYLES[ev.kind].dot}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#F5F7FA]">{ev.title}</p>
                    <p className="truncate text-xs text-[#94A3B8]">
                      {formatDateDisplay(ev.date, prefs.dateFormat)} · {KIND_STYLES[ev.kind].label} ·{' '}
                      {ev.subtitle}
                    </p>
                  </div>
                </div>
                {ev.amount !== undefined && (
                  <span className="font-mono-num text-sm font-semibold text-[#F5F7FA] shrink-0">
                    {fmt(ev.amount)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      <Modal
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.title || ''}
        subtitle={
          selectedEvent
            ? `${KIND_STYLES[selectedEvent.kind].label} · ${formatDateDisplay(
                selectedEvent.date,
                prefs.dateFormat
              )}`
            : ''
        }
      >
        {selectedEvent && (
          <div className="space-y-4 text-sm">
            <p className="text-[#94A3B8]">{selectedEvent.subtitle}</p>
            {selectedEvent.amount !== undefined && (
              <div className="rounded-lg border border-[#273449] bg-[#101827] p-3 flex justify-between">
                <span className="text-[#94A3B8]">Scheduled Amount</span>
                <span className="font-bold font-mono-num text-[#F5F7FA]">
                  {fmt(selectedEvent.amount)}
                </span>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg border border-[#273449] px-4 py-2 text-xs text-[#94A3B8]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const dest = selectedEvent.route;
                  setSelectedEvent(null);
                  navigate(dest);
                }}
                className="rounded-lg bg-[#24D6A0] px-4 py-2 text-xs font-semibold text-[#080D16]"
              >
                Open Module
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
