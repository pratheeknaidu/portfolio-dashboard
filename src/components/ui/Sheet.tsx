"use client";
import { useEffect, useRef, useState, ReactNode } from "react";
import { createPortal } from "react-dom";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** aria-labelledby target id, if the consumer's header has one. */
  labelledBy?: string;
}

export function Sheet({ open, onClose, children, labelledBy }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Defer portal until after mount so SSR + first client render match (both null),
  // then portal once `document` is available.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!open || !mounted) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  // Portal to document.body so the fixed-position overlay escapes any
  // ancestor that creates a new containing block (e.g. `backdrop-filter` on
  // .bento-card would otherwise clip the overlay to the card's bounds).
  return createPortal(
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
    </div>,
    document.body,
  );
}
