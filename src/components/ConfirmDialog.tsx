"use client";
import { useState } from "react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  };

  const confirmClass = destructive
    ? "bg-loss hover:bg-loss/90"
    : "bg-accent hover:bg-accent-dark";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface-card border border-surface-border rounded-xl p-6 w-[400px] shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
        <p className="text-sm text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={pending}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={pending}
            aria-label={confirmLabel}
            className={`px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50 ${confirmClass}`}
          >
            {pending ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
