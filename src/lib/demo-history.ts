import type { Holding, Snapshot } from "@/types";

export interface TickerCloses {
  [ticker: string]: { date: string; close: number }[];
}

/**
 * Portfolio value per day = Σ shares × close, over the dates for which EVERY
 * holding has a close (so a total is never partial). This reconstructs, from
 * real historical prices, exactly the series a real account holding these fixed
 * positions would have accumulated day by day.
 */
export function portfolioHistory(holdings: Holding[], closes: TickerCloses): Snapshot[] {
  if (holdings.length === 0) return [];

  const byTicker = new Map<string, Map<string, number>>();
  for (const h of holdings) {
    const m = new Map<string, number>();
    for (const c of closes[h.ticker] ?? []) m.set(c.date, c.close);
    byTicker.set(h.ticker, m);
  }

  const spine = byTicker.get(holdings[0].ticker);
  if (!spine || spine.size === 0) return [];

  const dates = [...spine.keys()]
    .filter((date) => holdings.every((h) => byTicker.get(h.ticker)!.has(date)))
    .sort();

  return dates.map((date) => ({
    date,
    totalValue: Math.round(
      holdings.reduce((sum, h) => sum + h.shares * byTicker.get(h.ticker)!.get(date)!, 0),
    ),
    holdings: {},
  }));
}
