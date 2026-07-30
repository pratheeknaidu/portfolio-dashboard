import type { PortfolioItem } from "@/types";

export interface PortfolioTotals {
  totalValue: number;
  costBasis: number;
  totalPL: number;
  totalPLPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

const EMPTY: PortfolioTotals = {
  totalValue: 0,
  costBasis: 0,
  totalPL: 0,
  totalPLPercent: 0,
  dayChange: 0,
  dayChangePercent: 0,
};

/**
 * Every dashboard number in one place, derived and never stored.
 *
 * `dayChangePercent` divides by YESTERDAY's value, not today's. Dividing by
 * today's understates every move, and the understatement grows with the move —
 * exactly when the number matters most.
 */
export function portfolioTotals(items: PortfolioItem[]): PortfolioTotals {
  if (items.length === 0) return EMPTY;

  let totalValue = 0;
  let costBasis = 0;
  let dayChange = 0;

  for (const i of items) {
    totalValue += i.marketValue;
    costBasis += i.shares * i.avgCost;
    // A single non-finite quote.change would otherwise poison the whole sum,
    // producing dayChange: NaN alongside a guarded dayChangePercent: 0 — a
    // contradictory pair that renders as "$NaN" in the summary card.
    dayChange += Number.isFinite(i.quote.change) ? i.shares * i.quote.change : 0;
  }

  const previousValue = totalValue - dayChange;
  const totalPL = totalValue - costBasis;

  return {
    totalValue,
    costBasis,
    totalPL,
    totalPLPercent: costBasis > 0 ? (totalPL / costBasis) * 100 : 0,
    dayChange,
    dayChangePercent: previousValue > 0 ? (dayChange / previousValue) * 100 : 0,
  };
}
