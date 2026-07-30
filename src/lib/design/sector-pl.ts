import type { PortfolioItem } from "@/types";
import { OTHER_COLOR, SECTOR_COLORS, sectorColor } from "@/lib/design/sectors";

export interface SectorPLRow {
  sector: string;
  pl: number;
  /** P&L as a percent of the sector's cost basis. */
  plPercent: number;
  color: string;
}

const OTHER = "Other";

/**
 * P&L aggregated by sector — the one fact neither the heat map (which shows
 * position magnitude) nor the table (which shows per-position P&L) surfaces:
 * where the money was actually made or lost. Ordered by absolute P&L so the
 * biggest swing, up or down, is first. Unknown sectors bucket into `Other`
 * rather than vanishing, so the totals still reconcile with the portfolio.
 */
export function sectorPL(items: PortfolioItem[]): SectorPLRow[] {
  const pl = new Map<string, number>();
  const cost = new Map<string, number>();

  for (const i of items) {
    const key = i.sector && SECTOR_COLORS[i.sector] ? i.sector : OTHER;
    pl.set(key, (pl.get(key) ?? 0) + i.totalPL);
    cost.set(key, (cost.get(key) ?? 0) + i.shares * i.avgCost);
  }

  if (pl.size === 0) return [];

  return [...pl.entries()]
    .map(([sector, plValue]) => {
      const basis = cost.get(sector) ?? 0;
      return {
        sector,
        pl: plValue,
        plPercent: basis > 0 ? (plValue / basis) * 100 : 0,
        color: sector === OTHER ? OTHER_COLOR : sectorColor(sector),
      };
    })
    .sort((a, b) => Math.abs(b.pl) - Math.abs(a.pl));
}
