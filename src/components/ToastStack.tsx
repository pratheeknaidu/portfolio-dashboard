"use client";

import { useToast, type ToastKind } from "@/lib/toast-context";

const STYLES: Record<ToastKind, string> = {
  error: "bg-loss/15 border-loss/60 text-loss",
  info: "bg-accent/15 border-accent/60 text-accent",
  success: "bg-gain/15 border-gain/60 text-gain",
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
