import type { PortfolioItem } from "@/types";

export interface Mover {
  item: PortfolioItem;
  /** Signed dollars this position added to or removed from today's change. */
  contribution: number;
}

/**
 * Positions ranked by what they did to the headline number, in dollars.
 *
 * Ranking by percent — which this card did before — puts a $200 position that
 * moved 9% above a $40,000 position that moved 1.2%, so the card sitting
 * directly beside the day change actively contradicts it.
 *
 * Non-finite changes are dropped rather than sorted: NaN comparisons are all
 * false, so a single bad quote lands wherever the sort happens to leave it,
 * which can be the top slot.
 */
export function topMovers(items: PortfolioItem[], limit = 5): Mover[] {
  return items
    .filter((i) => Number.isFinite(i.quote.change) && i.quote.change !== 0)
    .map((item) => ({ item, contribution: item.shares * item.quote.change }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, limit);
}
