"use client";
import { useCallback, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import type { PortfolioItem } from "@/types";

export interface PositionActions {
  selected: PortfolioItem | null;
  editing: PortfolioItem | null;
  confirming: PortfolioItem | null;
  select: (item: PortfolioItem) => void;
  dismiss: () => void;
  edit: (item: PortfolioItem) => void;
  closeEdit: () => void;
  remove: (item: PortfolioItem) => void;
  cancelRemove: () => void;
  confirmRemove: () => Promise<void>;
  /**
   * Direct delete by ticker, no confirm. For the failed-tickers strip, whose
   * delisted symbols are never in `items` (so `remove(item)` can't reach them)
   * and where clicking Remove is already the explicit decision to drop them.
   */
  removeTicker: (ticker: string) => Promise<void>;
}

/**
 * One edit/remove flow for both the dashboard and the holdings screen. Edit and
 * Remove hand off to the existing EditHoldingModal / ConfirmDialog; the parent
 * renders those from the returned state, so this hook owns the decisions and
 * the screens stay identical.
 */
export function usePositionActions(refresh: () => void): PositionActions {
  const { getIdToken } = useAuth();
  const toast = useToast();
  const [selected, setSelected] = useState<PortfolioItem | null>(null);
  const [editing, setEditing] = useState<PortfolioItem | null>(null);
  const [confirming, setConfirming] = useState<PortfolioItem | null>(null);

  const select = useCallback((item: PortfolioItem) => setSelected(item), []);
  const dismiss = useCallback(() => setSelected(null), []);

  const edit = useCallback((item: PortfolioItem) => {
    setSelected(null);
    setEditing(item);
  }, []);
  const closeEdit = useCallback(() => setEditing(null), []);

  const remove = useCallback((item: PortfolioItem) => {
    setSelected(null);
    setConfirming(item);
  }, []);
  const cancelRemove = useCallback(() => setConfirming(null), []);

  // The one DELETE. Returns whether it succeeded so callers can decide what to
  // clear; on failure it toasts and leaves the caller's UI (confirm/strip) up.
  const deleteTicker = useCallback(
    async (ticker: string): Promise<boolean> => {
      const token = await getIdToken();
      if (!token) return false;
      try {
        const res = await fetch(`/api/portfolio/${ticker}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          toast.error(`Couldn't remove ${ticker}.`);
          return false;
        }
        return true;
      } catch {
        toast.error(`Couldn't remove ${ticker}.`);
        return false;
      }
    },
    [getIdToken, toast],
  );

  const confirmRemove = useCallback(async () => {
    if (!confirming) return;
    if (await deleteTicker(confirming.ticker)) {
      setConfirming(null);
      refresh();
    }
  }, [confirming, deleteTicker, refresh]);

  const removeTicker = useCallback(
    async (ticker: string) => {
      if (await deleteTicker(ticker)) refresh();
    },
    [deleteTicker, refresh],
  );

  return {
    selected,
    editing,
    confirming,
    select,
    dismiss,
    edit,
    closeEdit,
    remove,
    cancelRemove,
    confirmRemove,
    removeTicker,
  };
}
