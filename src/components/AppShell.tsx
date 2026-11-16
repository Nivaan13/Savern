import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Calendar as CalendarIcon,
  CheckCircle2,
  CloudOff,
  CreditCard,
  FileHeart,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PieChart,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Target,
  TrendingUp,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useSavern, QuickAddMode } from '../context/SavernContext.tsx';
import { activeRecords, formatDateDisplay, getTodayISO } from '../lib/financeEngine.ts';
import { SavernLogo } from './SavernLogo.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { Modal } from './ui/Modal.tsx';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/accounts', label: 'Accounts', icon: Landmark },
  { to: '/budgets', label: 'Budgets', icon: PieChart },
  { to: '/goals', label: 'Savings Goals', icon: Target },
  { to: '/loans', label: 'Loans & EMI', icon: CreditCard },
  { to: '/medical', label: 'Medical Claims', icon: FileHeart },
  { to: '/investments', label: 'Investments', icon: TrendingUp },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/calendar', label: 'Calendar', icon: CalendarIcon },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const QUICK_ADD_OPTIONS: Array<{ mode: Exclude<QuickAddMode, null>; label: string }> = [
  { mode: 'expense', label: 'Add Expense' },
  { mode: 'income', label: 'Add Income' },
  { mode: 'transfer', label: 'Transfer Money' },
  { mode: 'loan', label: 'Add Loan' },
  { mode: 'goal', label: 'Add Savings Goal' },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    isDemoMode,
    data,
    isOnline,
    syncStatus,
    pendingSyncCount,
    runSyncNow,
    setQuickAddMode,
    setIsSearchOpen,
    logout,
    signInWithGoogle,
    resetDemoData,
  } = useSavern();

  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const quickRef = useRef<HTMLDivElement>(null);

  const unreadCount = activeRecords(data.notifications).filter((n) => !n.isRead).length;
  const activeRoute = NAV_ITEMS.find((item) =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  );
  const pageTitle = activeRoute?.label || 'SAVERN';

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (quickRef.current && !quickRef.current.contains(e.target as Node)) {
        setQuickOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [setIsSearchOpen]);

  const renderSyncIndicator = () => {
    if (isDemoMode || !user) {
      return (
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#39A0ED]/30 bg-[#39A0ED]/10 px-2.5 py-1 text-xs font-medium text-[#39A0ED] hover:bg-[#39A0ED]/20 whitespace-nowrap shrink-0"
          title="Demo data is local-only and never mixed with cloud accounts"
        >
          <span>Demo Mode</span>
        </button>
      );
    }

    if (!isOnline || syncStatus === 'offline') {
      return (
        <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#F6B94A]/30 bg-[#F6B94A]/10 px-2.5 py-1 text-xs font-medium text-[#F6B94A] whitespace-nowrap shrink-0">
          <CloudOff className="h-3.5 w-3.5" />
          <span>Offline{pendingSyncCount > 0 ? ` · ${pendingSyncCount} pending` : ''}</span>
        </div>
      );
    }

    if (syncStatus === 'syncing') {
      return (
        <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#39A0ED]/30 bg-[#39A0ED]/10 px-2.5 py-1 text-xs font-medium text-[#39A0ED] whitespace-nowrap shrink-0">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>Synchronizing</span>
        </div>
      );
    }

    if (syncStatus === 'error') {
      return (
        <button
          type="button"
          onClick={runSyncNow}
          className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#F16C78]/40 bg-[#F16C78]/10 px-2.5 py-1 text-xs font-medium text-[#F16C78] hover:bg-[#F16C78]/20 whitespace-nowrap shrink-0"
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Sync error · Retry</span>
        </button>
      );
    }

    if (syncStatus === 'pending' && pendingSyncCount > 0) {
      return (
        <button
          type="button"
          onClick={runSyncNow}
          className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#F6B94A]/30 bg-[#F6B94A]/10 px-2.5 py-1 text-xs font-medium text-[#F6B94A] hover:bg-[#F6B94A]/20 whitespace-nowrap shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Pending ({pendingSyncCount})</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={runSyncNow}
        className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#28C997]/30 bg-[#28C997]/10 px-2.5 py-1 text-xs font-medium text-[#28C997] hover:bg-[#28C997]/20 whitespace-nowrap shrink-0"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>Synced</span>
      </button>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#101827] border-r border-[#273449]">
      <div className="flex h-16 items-center justify-between px-5 border-b border-[#273449]">
        <SavernLogo size="md" />
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#1B2940] hover:text-[#F5F7FA]"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main Navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isNotifications = item.to === '/notifications';
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1B2940] text-[#24D6A0] border border-[#273449]'
                    : 'text-[#94A3B8] hover:bg-[#151F30] hover:text-[#F5F7FA] border border-transparent'
                }`
              }
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {isNotifications && unreadCount > 0 && (
                <span className="ml-2 text-xs font-semibold text-[#24D6A0] font-mono-num">
                  {unreadCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-[#273449] p-3 space-y-1">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-[#94A3B8] hover:bg-[#151F30] hover:text-[#F5F7FA]"
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User profile'}
              referrerPolicy="no-referrer"
              className="h-7 w-7 rounded-lg object-cover border border-[#273449]"
            />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#273449] bg-[#151F30] text-[#24D6A0]">
              <UserIcon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[#F5F7FA]">
              {user && !isDemoMode ? user.displayName || 'Savern Member' : 'Demo Explorer'}
            </p>
            <p className="truncate text-[11px] text-[#94A3B8]">
              {user && !isDemoMode ? user.email : 'Local Demo Workspace'}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#94A3B8] hover:bg-[#151F30] hover:text-[#F5F7FA]"
        >
          <HelpCircle className="h-4 w-4 shrink-0" />
          <span>Help & Support</span>
        </button>

        {user && !isDemoMode ? (
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#F16C78] hover:bg-[#F16C78]/10"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Logout</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#24D6A0] hover:bg-[#24D6A0]/10"
          >
            <LogIn className="h-4 w-4 shrink-0" />
            <span>Sign In / Cloud Sync</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#080D16] text-[#F5F7FA]">
      {/* Desktop Fixed Sidebar */}
      <aside className="no-print hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 w-72 max-w-[85vw]">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-[#273449] bg-[#080D16]/90 backdrop-blur-md px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden rounded-lg border border-[#273449] bg-[#101827] p-2 text-[#F5F7FA] hover:bg-[#1B2940]"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-bold tracking-tight text-[#F5F7FA]">
                {pageTitle}
              </h1>
              <p className="hidden sm:block text-xs text-[#94A3B8]">
                {formatDateDisplay(getTodayISO(), data.userPreferences.dateFormat)}
                <span aria-hidden="true"> · </span>
                <span>{data.userPreferences.currency}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-[#273449] bg-[#101827] px-3 py-1.5 text-xs text-[#94A3B8] hover:border-[#39A0ED]/50 hover:text-[#F5F7FA] whitespace-nowrap shrink-0"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Search records</span>
              <span className="hidden xl:inline text-[11px] text-[#94A3B8]/70 font-mono-num">
                Ctrl+K
              </span>
            </button>

            {renderSyncIndicator()}

            <PWAInstallButton compact />

            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="relative rounded-lg border border-[#273449] bg-[#101827] p-2 text-[#94A3B8] hover:bg-[#1B2940] hover:text-[#F5F7FA] shrink-0"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#24D6A0] px-1 text-[10px] font-bold text-[#080D16] font-mono-num">
                  {unreadCount}
                </span>
              )}
            </button>

            <div className="relative" ref={quickRef}>
              <button
                type="button"
                onClick={() => setQuickOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg bg-[#24D6A0] px-3.5 py-2 text-xs font-semibold text-[#080D16] transition-colors hover:bg-[#28C997] whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>Quick Add</span>
              </button>

              {quickOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-[#273449] bg-[#151F30] p-1.5 shadow-2xl z-30">
                  {QUICK_ADD_OPTIONS.map((opt) => (
                    <button
                      key={opt.mode}
                      type="button"
                      onClick={() => {
                        setQuickOpen(false);
                        setQuickAddMode(opt.mode);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[#F5F7FA] hover:bg-[#1B2940]"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5 text-[#24D6A0]" />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {isDemoMode && (
          <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-[#273449] bg-[#101827] px-4 py-2 text-xs text-[#94A3B8] sm:px-6">
            <span>
              Demo Workspace active · Displaying fictional Indian personal finance records isolated from your private cloud account.
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={resetDemoData}
                className="font-medium text-[#39A0ED] hover:underline whitespace-nowrap"
              >
                Reset Demo Data
              </button>
              <button
                type="button"
                onClick={() => {
                  void signInWithGoogle();
                }}
                className="font-semibold text-[#24D6A0] hover:underline whitespace-nowrap"
              >
                Sign in with Google
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>

      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="SAVERN Help & Financial Guide"
        subtitle="Your Money. Your Goals. Your Control."
      >
        <div className="space-y-4 text-sm text-[#94A3B8]">
          <p>
            <strong className="text-[#F5F7FA]">Manual Account Tracking:</strong> All balances reflect
            opening balances plus recorded income, expenses, internal transfers, and explicit
            reconciliation adjustments. Savern never asks for banking passwords or UPI PINs.
          </p>
          <p>
            <strong className="text-[#F5F7FA]">Offline-First Sync:</strong> Changes are saved
            immediately to your device's IndexedDB store. When signed in and online, pending updates
            synchronize to Cloud SQL (PostgreSQL) and Cloud Firestore.
          </p>
          <p>
            <strong className="text-[#F5F7FA]">Insurance & Investments:</strong> Approved medical
            claims are tracked separately from reimbursements received. Mutual fund NAVs are
            manually maintained and are not live brokerage feeds.
          </p>
        </div>
      </Modal>
    </div>
  );
};
