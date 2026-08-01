"use client";

import { useToast, type ToastKind } from "@/lib/toast-context";

const STYLES: Record<ToastKind, string> = {
  error: "bg-rd-loss/15 border-rd-loss/60 text-rd-loss",
  info: "bg-rd-control border-rd-border-strong text-rd-body",
  success: "bg-rd-gain/15 border-rd-gain/60 text-rd-gain",
};

export function ToastStack() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`flex items-start gap-3 px-4 py-3 border rounded-lg shadow-lg text-sm ${STYLES[t.kind]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="opacity-60 hover:opacity-100 transition"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
