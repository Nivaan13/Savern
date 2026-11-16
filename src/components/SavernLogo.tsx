import React from 'react';

export const SavernLogo: React.FC<{ size?: 'sm' | 'md' | 'lg'; showTagline?: boolean }> = ({
  size = 'md',
  showTagline = false,
}) => {
  const iconSize = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg
        viewBox="0 0 40 40"
        fill="none"
        className={`${iconSize} shrink-0`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="savernLogoGrad" x1="6" y1="32" x2="34" y2="8" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#24D6A0" />
            <stop offset="100%" stopColor="#39A0ED" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="10" fill="#101827" stroke="#273449" strokeWidth="1.5" />
        <path
          d="M10 25.5L16.8 18.7L21.5 23.4L30 13.5"
          stroke="url(#savernLogoGrad)"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M24.5 13.5H30V19"
          stroke="#24D6A0"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M10 29.5H30" stroke="#273449" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <div className="flex flex-col leading-none">
        <span className={`font-display font-bold tracking-tight text-[#F5F7FA] whitespace-nowrap ${textSize}`}>
          SAVERN
        </span>
        {showTagline && (
          <span className="mt-1 text-[11px] text-[#94A3B8] whitespace-nowrap">
            Your Money. Your Goals. Your Control.
          </span>
        )}
      </div>
    </div>
  );
};
