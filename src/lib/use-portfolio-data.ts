"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { useIsDemo } from "@/lib/demo-context";
import { buildDemoItems, DEMO_SNAPSHOTS } from "@/lib/demo-data";
import { isMarketOpen } from "@/lib/market-hours";
import type { Holding, PortfolioItem, Quote, QuoteFailure, Snapshot, TimeRange } from "@/types";

/**
 * `loading` is distinct from `empty` on purpose. The shipped app renders
 * $0.00 and "No holdings yet" while the first fetch is still in flight, so a
 * slow connection flashes a zeroed portfolio — the most trust-destroying frame
 * a money app can show.
 */
export type PortfolioStatus = "loading" | "ready" | "empty" | "error";

export interface PortfolioData {
  items: PortfolioItem[];
  failed: QuoteFailure[];
  status: PortfolioStatus;
  snapshots: Snapshot[];
  /**
   * Cost basis of the holdings that failed to quote. Summed here because a
   * failed ticker is dropped from `items`, so no consumer can recover it — and
   * the dashboard prints it so the totals are not silently understated.
   */
  excludedValue: number;
  refresh: () => Promise<void>;
}

interface QuotesResponse {
  quotes: Record<string, Quote>;
  failed: QuoteFailure[];
}

export function usePortfolioData(range: TimeRange): PortfolioData {
  const { getIdToken } = useAuth();
  const toast = useToast();
  const isDemo = useIsDemo();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [failed, setFailed] = useState<QuoteFailure[]>([]);
  const [status, setStatus] = useState<PortfolioStatus>("loading");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [excludedValue, setExcludedValue] = useState(0);

  const refresh = useCallback(async () => {
    // Demo mode is fully offline: render the static fixture and skip every
    // network call, including the snapshot write.
    if (isDemo) {
      setItems(buildDemoItems(range));
      setFailed([]);
      setExcludedValue(0);
      setSnapshots(DEMO_SNAPSHOTS);
      setStatus("ready");
      return;
    }

    const token = await getIdToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const holdingsRes = await fetch("/api/portfolio", { headers });
      if (!holdingsRes.ok) {
        toast.error(`Couldn't load your holdings (${holdingsRes.status}).`);
        setItems([]);
        // Reset failed alongside items/excludedValue: without the holdings we
        // no longer know what failed, and a stale failure list would render a
        // "$0.00 excluded" strip — the exact silent-understatement this field
        // exists to prevent — beside a zeroed portfolio.
        setFailed([]);
        setExcludedValue(0);
        setStatus("error");
        return;
      }
      const holdings: Holding[] = await holdingsRes.json();
      if (!Array.isArray(holdings) || holdings.length === 0) {
        setItems([]);
        setExcludedValue(0);
        setStatus("empty");
        return;
      }

      const tickers = holdings.map((h) => h.ticker).join(",");
      const quotesUrl =
        range === "ALL"
          ? `/api/quotes?tickers=${tickers}`
          : `/api/quotes?tickers=${tickers}&range=${range}`;
      const quotesRes = await fetch(quotesUrl, { headers });
      if (!quotesRes.ok) {
        toast.error("Quotes service is unavailable. Showing last-known values.");
        setStatus("error");
        return;
      }
      const { quotes, failed: failedTickers }: QuotesResponse = await quotesRes.json();
      setFailed(failedTickers ?? []);

      // Summed from the raw holdings, not from `items` — the failed tickers are
      // filtered out of `items` below, so this is the only place their cost
      // basis survives.
      const failedSet = new Set((failedTickers ?? []).map((f) => f.ticker));
      setExcludedValue(
        holdings
          .filter((h) => failedSet.has(h.ticker))
          .reduce((sum, h) => sum + h.shares * h.avgCost, 0),
      );

      const merged: PortfolioItem[] = holdings
        .filter((h) => quotes[h.ticker])
        .map((h) => {
          const q = quotes[h.ticker];
          const marketValue = h.shares * q.price;
          const costBasis = h.shares * h.avgCost;
          const totalPL = marketValue - costBasis;
          const totalPLPercent = (totalPL / costBasis) * 100;
          // In ALL mode the "change" a tile colours by is lifetime P&L, not
          // the day move, so the treemap and the range pill agree.
          const quote: Quote =
            range === "ALL"
              ? { ...q, change: q.price - h.avgCost, changePercent: totalPLPercent }
              : q;
          return { ...h, quote, marketValue, totalPL, totalPLPercent };
        });

      setItems(merged);
      setStatus(merged.length === 0 ? "empty" : "ready");

      const totalValue = merged.reduce((sum, i) => sum + i.marketValue, 0);
      const holdingsMap = Object.fromEntries(merged.map((i) => [i.ticker, i.marketValue]));
      await fetch("/api/snapshot", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ totalValue, holdings: holdingsMap }),
      });

      // Decoration, not the point of the screen — a failed history read must
      // not fail the portfolio that renders above it. status is already
      // "ready" by this point, so this can't delay first paint either.
      try {
        const historyRes = await fetch("/api/snapshot", { headers });
        setSnapshots(historyRes.ok ? await historyRes.json() : []);
      } catch {
        setSnapshots([]);
      }
    } catch (err) {
      console.error("usePortfolioData refresh failed:", err);
      toast.error("Network error — couldn't refresh portfolio.");
      setStatus("error");
    }
  }, [getIdToken, range, toast, isDemo]);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      if (isMarketOpen()) refresh();
    }, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { items, failed, status, snapshots, excludedValue, refresh };
}
