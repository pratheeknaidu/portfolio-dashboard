"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { useIsDemo } from "@/lib/demo-context";
import { buildDemoItems, DEMO_HOLDINGS, DEMO_SNAPSHOTS } from "@/lib/demo-data";
import { mergeHoldingsWithQuotes } from "@/lib/design/merge-quotes";
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
    // Demo mode shows real market data through the public, unauthenticated demo
    // endpoints — no user token, no snapshot write. The endpoints already fall
    // back to the fixture server-side; the catch here is a second net for a
    // network error reaching our own API, so the demo always renders.
    if (isDemo) {
      try {
        const [qRes, hRes] = await Promise.all([
          fetch(`/api/demo/quotes?range=${range}`),
          fetch(`/api/demo/history`),
        ]);
        const { quotes } = await qRes.json();
        const merged = mergeHoldingsWithQuotes(DEMO_HOLDINGS, quotes, range);
        setItems(merged);
        setSnapshots(hRes.ok ? await hRes.json() : []);
        setFailed([]);
        setExcludedValue(0);
        setStatus(merged.length === 0 ? "empty" : "ready");
      } catch {
        setItems(buildDemoItems(range));
        setSnapshots(DEMO_SNAPSHOTS);
        setFailed([]);
        setExcludedValue(0);
        setStatus("ready");
      }
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

      const merged = mergeHoldingsWithQuotes(holdings, quotes, range);

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
