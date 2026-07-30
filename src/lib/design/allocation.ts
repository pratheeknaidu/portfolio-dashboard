import type { PortfolioItem } from "@/types";
import { OTHER_COLOR, SECTOR_COLORS, sectorColor } from "@/lib/design/sectors";

export interface AllocationSlice {
  sector: string;
  value: number;
  /** Share of total market value, 0-100. */
  pct: number;
  color: string;
}

const OTHER = "Other";

/**
 * Market value by sector, largest first, with the tail rolled into `Other`.
 *
 * The roll-up exists because the strip is direct-labelled: past six or so
 * sectors the slices are too narrow to carry a label, and an unlabelled sliver
 * is worse than an honest aggregate. Holdings whose sector Yahoo did not return
 * go into the same bucket rather than being dropped, so the percentages still
 * sum to 100.
 */
export function sectorAllocation(items: PortfolioItem[], limit = 6): AllocationSlice[] {
  const totals = new Map<string, number>();

  for (const i of items) {
    const key = i.sector && SECTOR_COLORS[i.sector] ? i.sector : OTHER;
    totals.set(key, (totals.get(key) ?? 0) + i.marketValue);
  }

  const total = [...totals.values()].reduce((s, v) => s + v, 0);
  if (total <= 0) return [];

  const named = [...totals.entries()]
    .filter(([sector]) => sector !== OTHER)
    .sort((a, b) => b[1] - a[1]);

  const kept = named.slice(0, limit);
  const tail = named.slice(limit).reduce((s, [, v]) => s + v, 0) + (totals.get(OTHER) ?? 0);

  const slices: AllocationSlice[] = kept.map(([sector, value]) => ({
    sector,
    value,
    pct: (value / total) * 100,
    color: sectorColor(sector),
  }));

  if (tail > 0) {
    slices.push({ sector: OTHER, value: tail, pct: (tail / total) * 100, color: OTHER_COLOR });
  }

  return slices;
}
