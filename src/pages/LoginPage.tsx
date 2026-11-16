import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Cloud, Lock, ShieldCheck, Smartphone } from 'lucide-react';
import { useSavern } from '../context/SavernContext.tsx';
import { SavernLogo } from '../components/SavernLogo.tsx';

export const LoginPage: React.FC = () => {
  const { signInWithGoogle, enterDemoMode, user } = useSavern();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Google Sign-In could not complete. Verify popups are allowed for this window.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080D16] text-[#F5F7FA] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 rounded-2xl border border-[#273449] bg-[#101827] overflow-hidden shadow-2xl">
        <div className="p-8 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#273449] bg-[#151F30]">
          <div>
            <SavernLogo size="lg" showTagline />
            <h1 className="mt-8 font-display text-2xl sm:text-3xl font-bold leading-tight text-[#F5F7FA]">
              Command every rupee with offline-first clarity.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
              Track multi-account balances, monthly spending comparisons, dream savings goals, loans,
              EMIs, medical insurance claims, and mutual fund SIPs in one unified ledger.
            </p>
          </div>

          <div className="mt-8 space-y-3 text-xs text-[#94A3B8]">
            <div className="flex items-center gap-2.5">
              <Cloud className="h-4 w-4 text-[#24D6A0] shrink-0" />
              <span>Synchronized across Cloud SQL (PostgreSQL) & Cloud Firestore</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Smartphone className="h-4 w-4 text-[#39A0ED] shrink-0" />
              <span>IndexedDB offline ledger with conflict-safe sync queue</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-[#28C997] shrink-0" />
              <span>Zero bank passwords or UPI PINs requested—manual control</span>
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <h2 className="font-display text-xl font-bold text-[#F5F7FA]">
            Sign in to your workspace
          </h2>
          <p className="mt-1.5 text-sm text-[#94A3B8]">
            Use verified Google authentication to access your isolated cloud ledger.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-[#F16C78]/40 bg-[#F16C78]/10 px-3.5 py-2.5 text-xs text-[#F16C78]">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-3">
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#24D6A0] px-4 py-3 text-sm font-semibold text-[#080D16] transition-colors hover:bg-[#28C997] disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              <span>{loading ? 'Connecting...' : 'Continue with Google Sign-In'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                enterDemoMode();
                navigate('/');
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#273449] bg-[#151F30] px-4 py-3 text-sm font-medium text-[#F5F7FA] transition-colors hover:bg-[#1B2940]"
            >
              <span>Explore Demo Workspace</span>
              <ArrowRight className="h-4 w-4 text-[#39A0ED]" />
            </button>

            {user && (
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#28C997]/30 bg-[#28C997]/10 px-4 py-2.5 text-xs font-medium text-[#28C997]"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Already signed in as {user.email} — Return to Dashboard</span>
              </button>
            )}
          </div>

          <p className="mt-6 text-xs leading-relaxed text-[#94A3B8]">
            Demo Mode uses fictional sample data stored solely on your device and is never mixed
            with authenticated cloud records.
          </p>
        </div>
      </div>
    </div>
  );
};
