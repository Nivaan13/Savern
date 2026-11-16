import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal.tsx';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = true,
}) => {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="sm">
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
            danger
              ? 'border-[#F16C78]/30 bg-[#F16C78]/10 text-[#F16C78]'
              : 'border-[#F6B94A]/30 bg-[#F6B94A]/10 text-[#F6B94A]'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
        </div>
        <p className="text-sm leading-relaxed text-[#94A3B8]">{message}</p>
      </div>
      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[#273449] bg-[#101827] px-4 py-2 text-sm font-medium text-[#F5F7FA] hover:bg-[#1B2940] whitespace-nowrap"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={async () => {
            await onConfirm();
            onClose();
          }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap ${
            danger
              ? 'bg-[#F16C78] text-[#080D16] hover:bg-[#f4828c]'
              : 'bg-[#24D6A0] text-[#080D16] hover:bg-[#28C997]'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};
