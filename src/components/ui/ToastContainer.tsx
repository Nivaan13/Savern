import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useSavern } from '../../context/SavernContext.tsx';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useSavern();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
      {toasts.map((toast) => {
        const Icon =
          toast.variant === 'success'
            ? CheckCircle2
            : toast.variant === 'error' || toast.variant === 'warning'
              ? AlertCircle
              : Info;
        const accentColor =
          toast.variant === 'success'
            ? 'text-[#28C997]'
            : toast.variant === 'error'
              ? 'text-[#F16C78]'
              : toast.variant === 'warning'
                ? 'text-[#F6B94A]'
                : 'text-[#39A0ED]';

        return (
          <div
            key={toast.id}
            role="status"
            className="flex items-start gap-3 rounded-xl border border-[#273449] bg-[#1B2940] px-4 py-3 shadow-xl"
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${accentColor}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#F5F7FA]">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs text-[#94A3B8]">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="rounded p-1 text-[#94A3B8] hover:text-[#F5F7FA]"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
