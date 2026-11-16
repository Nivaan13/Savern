import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Lock, WifiOff } from 'lucide-react';
import { SavernProvider, useSavern } from './context/SavernContext.tsx';
import { AppShell } from './components/AppShell.tsx';
import { OnboardingWizard } from './components/OnboardingWizard.tsx';
import { QuickAddModal } from './components/QuickAddModal.tsx';
import { GlobalSearchModal } from './components/GlobalSearchModal.tsx';
import { ToastContainer } from './components/ui/ToastContainer.tsx';
import { SavernLogo } from './components/SavernLogo.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { OverviewPage } from './pages/OverviewPage.tsx';
import { TransactionsPage } from './pages/TransactionsPage.tsx';
import { AccountsPage } from './pages/AccountsPage.tsx';
import { BudgetsPage } from './pages/BudgetsPage.tsx';
import { GoalsPage } from './pages/GoalsPage.tsx';
import { LoansEmiPage } from './pages/LoansEmiPage.tsx';
import { MedicalClaimsPage } from './pages/MedicalClaimsPage.tsx';
import { InvestmentsPage } from './pages/InvestmentsPage.tsx';
import { ReportsPage } from './pages/ReportsPage.tsx';
import { CalendarPage } from './pages/CalendarPage.tsx';
import { NotificationsPage } from './pages/NotificationsPage.tsx';
import { SettingsPage, hashPinSha256 } from './pages/SettingsPage.tsx';

const AppLockGate: React.FC<{ onUnlocked: () => void }> = ({ onUnlocked }) => {
  const { data, logout, user, isDemoMode } = useSavern();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hashed = await hashPinSha256(pin);
    if (hashed === data.userPreferences.appLockPinHash) {
      setError('');
      onUnlocked();
    } else {
      setError('Incorrect PIN. Please try again.');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen bg-[#080D16] text-[#F5F7FA] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#273449] bg-[#151F30] p-6 space-y-5 text-center shadow-2xl">
        <div className="flex justify-center">
          <SavernLogo size="md" />
        </div>
        <div>
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-[#273449] bg-[#101827] text-[#24D6A0]">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="font-display text-lg font-bold text-[#F5F7FA]">Savern App Lock</h1>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Enter your 4-digit local security PIN to unlock this workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            className="w-full rounded-xl border border-[#273449] bg-[#101827] px-4 py-3 text-center text-xl tracking-[0.6em] text-[#F5F7FA] font-mono-num"
            autoFocus
          />
          {error && <p className="text-xs text-[#F16C78]">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-[#24D6A0] py-2.5 text-sm font-semibold text-[#080D16] hover:bg-[#28C997]"
          >
            Unlock
          </button>
        </form>

        {user && !isDemoMode && (
          <button
            type="button"
            onClick={logout}
            className="text-xs text-[#94A3B8] hover:text-[#F5F7FA]"
          >
            Sign out of Google account
          </button>
        )}
      </div>
    </div>
  );
};

const SavernAppRoutes: React.FC = () => {
  const { authReady, isLoadingData, user, isDemoMode, data, isOnline } = useSavern();
  const [pinUnlocked, setPinUnlocked] = useState(false);

  const hasPin = Boolean(data.userPreferences.appLockPinHash);

  useEffect(() => {
    if (!hasPin) setPinUnlocked(false);
  }, [hasPin]);

  if (!authReady || isLoadingData) {
    return (
      <div className="min-h-screen bg-[#080D16] text-[#F5F7FA] flex flex-col items-center justify-center gap-4 p-4">
        <SavernLogo size="lg" showTagline />
        <p className="text-xs text-[#94A3B8]">Loading local financial ledger...</p>
      </div>
    );
  }

  if (hasPin && !pinUnlocked) {
    return <AppLockGate onUnlocked={() => setPinUnlocked(true)} />;
  }

  const needsOnboarding = Boolean(
    user && !isDemoMode && !data.userPreferences.onboardingCompleted
  );

  if (needsOnboarding) {
    return (
      <>
        <OnboardingWizard />
        <ToastContainer />
      </>
    );
  }

  return (
    <>
      {!isOnline && (
        <div className="no-print flex items-center justify-center gap-2 border-b border-[#F6B94A]/30 bg-[#F6B94A]/10 px-4 py-1.5 text-xs font-medium text-[#F6B94A]">
          <WifiOff className="h-3.5 w-3.5" />
          <span>
            Offline mode active — Changes are saved safely to IndexedDB and will sync when
            reconnected.
          </span>
        </div>
      )}

      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <AppShell>
              <OverviewPage />
            </AppShell>
          }
        />
        <Route
          path="/transactions"
          element={
            <AppShell>
              <TransactionsPage />
            </AppShell>
          }
        />
        <Route
          path="/accounts"
          element={
            <AppShell>
              <AccountsPage />
            </AppShell>
          }
        />
        <Route
          path="/budgets"
          element={
            <AppShell>
              <BudgetsPage />
            </AppShell>
          }
        />
        <Route
          path="/goals"
          element={
            <AppShell>
              <GoalsPage />
            </AppShell>
          }
        />
        <Route
          path="/loans"
          element={
            <AppShell>
              <LoansEmiPage />
            </AppShell>
          }
        />
        <Route
          path="/medical"
          element={
            <AppShell>
              <MedicalClaimsPage />
            </AppShell>
          }
        />
        <Route
          path="/investments"
          element={
            <AppShell>
              <InvestmentsPage />
            </AppShell>
          }
        />
        <Route
          path="/reports"
          element={
            <AppShell>
              <ReportsPage />
            </AppShell>
          }
        />
        <Route
          path="/calendar"
          element={
            <AppShell>
              <CalendarPage />
            </AppShell>
          }
        />
        <Route
          path="/notifications"
          element={
            <AppShell>
              <NotificationsPage />
            </AppShell>
          }
        />
        <Route
          path="/settings"
          element={
            <AppShell>
              <SettingsPage />
            </AppShell>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <QuickAddModal />
      <GlobalSearchModal />
      <ToastContainer />
    </>
  );
};

export default function App() {
  return (
    <SavernProvider>
      <BrowserRouter>
        <SavernAppRoutes />
      </BrowserRouter>
    </SavernProvider>
  );
}
