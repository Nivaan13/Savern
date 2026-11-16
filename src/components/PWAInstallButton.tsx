import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-2 rounded-lg border border-[#24D6A0]/40 bg-[#24D6A0]/10 px-3 py-1.5 text-xs font-medium text-[#24D6A0] transition-colors hover:bg-[#24D6A0]/20 whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        <span>{compact ? 'Install' : 'Install App'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-lg border border-[#273449] bg-[#151F30] px-3 py-1.5 text-xs font-medium text-[#F5F7FA] transition-colors hover:bg-[#1B2940] whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5 text-[#39A0ED]" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-xl border border-[#273449] bg-[#151F30] p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#F5F7FA]">Install SAVERN on iOS</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-lg p-1 text-[#94A3B8] hover:bg-[#1B2940] hover:text-[#F5F7FA]"
                  aria-label="Close installation guide"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
                1. Tap the <strong className="text-[#F5F7FA]">Share</strong> icon in Safari.<br />
                2. Scroll down and select <strong className="text-[#F5F7FA]">Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-[#24D6A0] py-2 text-sm font-semibold text-[#080D16] hover:bg-[#28C997]"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
