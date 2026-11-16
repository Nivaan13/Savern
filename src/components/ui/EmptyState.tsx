import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#273449] bg-[#101827]/60 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#273449] bg-[#151F30] text-[#24D6A0]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-[#F5F7FA]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-[#94A3B8]">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-lg bg-[#24D6A0] px-4 py-2 text-sm font-semibold text-[#080D16] transition-colors hover:bg-[#28C997] whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
