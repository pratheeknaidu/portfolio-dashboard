"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { useIsDemo } from "@/lib/demo-context";
import { buildDemoItems } from "@/lib/demo-data";
import { isMarketOpen } from "@/lib/market-hours";
import type { Holding, PortfolioItem, Quote, QuoteFailure, TimeRange } from "@/types";

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

  const refresh = useCallback(async () => {
    // Demo mode is fully offline: render the static fixture and skip every
    // network call, including the snapshot write.
    if (isDemo) {
      setItems(buildDemoItems(range));
      setFailed([]);
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
        setStatus("error");
        return;
      }
      const holdings: Holding[] = await holdingsRes.json();
      if (!Array.isArray(holdings) || holdings.length === 0) {
        setItems([]);
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

  return { items, failed, status, refresh };
}
