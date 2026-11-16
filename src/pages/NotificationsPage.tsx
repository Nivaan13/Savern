import React, { useMemo, useState } from 'react';
import { Bell, CheckCheck, Clock, Info, Trash2 } from 'lucide-react';
import { useSavern } from '../context/SavernContext.tsx';
import { activeRecords, formatDateDisplay, getTodayISO } from '../lib/financeEngine.ts';
import { EmptyState } from '../components/ui/EmptyState.tsx';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const NotificationsPage: React.FC = () => {
  const {
    data,
    workspaceKey,
    updatePreferences,
    markNotificationRead,
    markAllNotificationsRead,
    deleteEntity,
    showToast,
  } = useSavern();

  const prefs = data.userPreferences;
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [permStatus, setPermStatus] = useState<string>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const notifications = useMemo(() => {
    const list = activeRecords(data.notifications).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    return filter === 'unread' ? list.filter((n) => !n.isRead) : list;
  }, [data.notifications, filter]);

  const unreadCount = activeRecords(data.notifications).filter((n) => !n.isRead).length;

  const toggleDay = async (dayIdx: number) => {
    const exists = prefs.dailyReminderDays.includes(dayIdx);
    const nextDays = exists
      ? prefs.dailyReminderDays.filter((d) => d !== dayIdx)
      : [...prefs.dailyReminderDays, dayIdx].sort();
    await updatePreferences({ dailyReminderDays: nextDays });
  };

  const handleRequestBrowserNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setPermStatus('unsupported');
      showToast('Browser notifications are not supported in this browser', 'warning');
      return;
    }
    const result = await Notification.requestPermission();
    setPermStatus(result);
    if (result === 'granted') {
      showToast('Browser notifications enabled', 'success');
    } else {
      showToast('Browser notification permission not granted', 'info');
    }
  };

  const handleTestNotification = () => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      showToast('Enable browser notification permission first', 'warning');
      return;
    }
    new Notification('SAVERN Reminder Test', {
      body: "Time to update your expenses! Record today's spending to keep your Savern reports accurate.",
      icon: '/pwa-192x192.png',
    });
  };

  const handleSnoozeToday = () => {
    const todayKey = `savern_daily_reminded_${workspaceKey}_${getTodayISO()}`;
    localStorage.setItem(todayKey, 'snoozed');
    showToast("Daily reminder paused for the rest of today", 'info');
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Left 2 Cols: Notification Feed */}
      <div className="xl:col-span-2 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-[#273449] bg-[#101827] p-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                filter === 'all' ? 'bg-[#1B2940] text-[#24D6A0]' : 'text-[#94A3B8]'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                filter === 'unread' ? 'bg-[#1B2940] text-[#24D6A0]' : 'text-[#94A3B8]'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="flex items-center gap-1.5 rounded-lg border border-[#273449] bg-[#151F30] px-3 py-1.5 text-xs font-medium text-[#24D6A0] hover:bg-[#1B2940]"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications"
            description="Budget threshold alerts, EMI lead reminders, and daily expense prompts appear here."
          />
        ) : (
          <div className="rounded-xl border border-[#273449] bg-[#151F30] divide-y divide-[#273449]">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start justify-between gap-4 p-4 ${
                  !n.isRead ? 'bg-[#1B2940]/40' : ''
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-[#24D6A0]" />}
                    <span className="text-xs uppercase tracking-wider text-[#39A0ED]">
                      {n.kind}
                    </span>
                    {n.dueDate && (
                      <span className="text-xs text-[#94A3B8]">
                        · {formatDateDisplay(n.dueDate, prefs.dateFormat)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-[#F5F7FA]">{n.title}</h3>
                  <p className="text-xs text-[#94A3B8]">{n.message}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={() => markNotificationRead(n.id)}
                      className="rounded-lg border border-[#273449] px-2.5 py-1 text-xs text-[#24D6A0] hover:bg-[#1B2940]"
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteEntity('notifications', n.id)}
                    className="rounded p-1.5 text-[#94A3B8] hover:text-[#F16C78]"
                    aria-label="Delete notification"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: 22:00 Daily Reminder & Browser Permission */}
      <div className="space-y-4">
        <div className="rounded-xl border border-[#273449] bg-[#151F30] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#24D6A0]" />
              <h2 className="font-display text-sm font-semibold text-[#F5F7FA]">
                Daily Expense Reminder
              </h2>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={prefs.dailyReminderEnabled}
                onChange={(e) => updatePreferences({ dailyReminderEnabled: e.target.checked })}
              />
              <span className="text-[#F5F7FA]">
                {prefs.dailyReminderEnabled ? 'Active' : 'Off'}
              </span>
            </label>
          </div>

          <p className="text-xs text-[#94A3B8]">
            Default 10:00 PM prompt to record daily spending and keep reports accurate.
          </p>

          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Reminder Time</label>
            <input
              type="time"
              value={prefs.dailyReminderTime}
              onChange={(e) => updatePreferences({ dailyReminderTime: e.target.value })}
              className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-sm text-[#F5F7FA] font-mono-num"
            />
          </div>

          <div>
            <p className="text-xs text-[#94A3B8] mb-1.5">Active Days</p>
            <div className="grid grid-cols-7 gap-1">
              {DAY_LABELS.map((label, idx) => {
                const active = prefs.dailyReminderDays.includes(idx);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`rounded-md py-1.5 text-[11px] font-medium ${
                      active
                        ? 'bg-[#24D6A0] text-[#080D16]'
                        : 'border border-[#273449] bg-[#101827] text-[#94A3B8]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSnoozeToday}
            className="w-full rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-xs text-[#94A3B8] hover:text-[#F5F7FA]"
          >
            Dismiss / Snooze Reminder for Today
          </button>
        </div>

        <div className="rounded-xl border border-[#273449] bg-[#151F30] p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold text-[#F5F7FA]">
            Browser Desktop Notifications
          </h3>
          <p className="text-xs text-[#94A3B8]">
            Grant browser permission if you want native desktop alerts when Savern is open.
          </p>
          <div className="rounded-lg border border-[#273449] bg-[#101827] p-3 text-xs flex items-center justify-between">
            <span className="text-[#94A3B8]">Permission Status</span>
            <span className="font-semibold capitalize text-[#F5F7FA]">{permStatus}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {permStatus !== 'granted' && permStatus !== 'unsupported' && (
              <button
                type="button"
                onClick={handleRequestBrowserNotifications}
                className="flex-1 rounded-lg bg-[#24D6A0] px-3 py-2 text-xs font-semibold text-[#080D16] hover:bg-[#28C997]"
              >
                Enable Browser Alerts
              </button>
            )}
            {permStatus === 'granted' && (
              <button
                type="button"
                onClick={handleTestNotification}
                className="flex-1 rounded-lg border border-[#273449] bg-[#101827] px-3 py-2 text-xs font-medium text-[#24D6A0] hover:bg-[#1B2940]"
              >
                Send Test Alert
              </button>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-[#101827] p-3 text-[11px] text-[#94A3B8]">
            <Info className="h-3.5 w-3.5 shrink-0 text-[#39A0ED] mt-0.5" />
            <span>
              Scheduled timers fire reliably while Savern is open in a browser tab or installed PWA
              window. Fully closed-browser delivery requires a server Web Push VAPID subscription.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
