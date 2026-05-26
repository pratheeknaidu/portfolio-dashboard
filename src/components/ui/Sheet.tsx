"use client";
import { useEffect, useRef, ReactNode } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** aria-labelledby target id, if the consumer's header has one. */
  labelledBy?: string;
}

export function Sheet({ open, onClose, children, labelledBy }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60"
      data-testid="sheet-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full md:w-auto md:max-w-lg max-h-[85vh] md:max-h-[90vh] overflow-y-auto bg-surface-card border border-surface-border rounded-t-2xl md:rounded-xl shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}
