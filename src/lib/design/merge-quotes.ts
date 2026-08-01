import type { Holding, PortfolioItem, Quote, TimeRange } from "@/types";

/**
 * Merge holdings with their quotes into the PortfolioItem shape the UI renders.
 * The single copy of this logic: the authenticated fetch, the offline demo
 * fixture, and the live demo fetch all go through here so they cannot drift.
 *
 * In the "ALL" range the tile's `change` is the lifetime move off cost basis,
 * not the day move, so the treemap and the range pill agree.
 */
export function mergeHoldingsWithQuotes(
  holdings: Holding[],
  quotes: Record<string, Quote>,
  range: TimeRange,
): PortfolioItem[] {
  return holdings
    .filter((h) => quotes[h.ticker])
    .map((h) => {
      const q = quotes[h.ticker];
      const marketValue = h.shares * q.price;
      const costBasis = h.shares * h.avgCost;
      const totalPL = marketValue - costBasis;
      const totalPLPercent = (totalPL / costBasis) * 100;
      const quote: Quote =
        range === "ALL"
          ? { ...q, change: q.price - h.avgCost, changePercent: totalPLPercent }
          : q;
      return { ...h, quote, marketValue, totalPL, totalPLPercent };
    });
}
