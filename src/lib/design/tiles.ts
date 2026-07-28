export type LabelTier = "none" | "ticker" | "percent" | "full";

/**
 * Minimum tile size that can carry a readable ticker. Mobile is lower because
 * packed maps at 375px produce many small tiles; below this a tile is excluded
 * from the map entirely and rolled into the aggregate strip. A tile you cannot
 * read or reliably tap is worse than an omitted one.
 */
export const MIN_TILE = {
  desktop: { w: 34, h: 24 },
  mobile: { w: 30, h: 22 },
} as const;

const PERCENT_MIN = { w: 62, h: 44 };
const SUB_MIN = { w: 92, h: 78 };

/** How much a tile of this size can legibly carry. */
export function labelTier(w: number, h: number, isMobile: boolean): LabelTier {
  const min = isMobile ? MIN_TILE.mobile : MIN_TILE.desktop;
  if (w < min.w || h < min.h) return "none";
  if (w >= SUB_MIN.w && h >= SUB_MIN.h) return "full";
  if (w >= PERCENT_MIN.w && h >= PERCENT_MIN.h) return "percent";
  return "ticker";
}

/** Ticker size for a tile: scales with the tighter dimension, 11–22px. */
export function tileFontSize(w: number, h: number): number {
  return Math.round(Math.max(11, Math.min(Math.min(w / 4.6, h / 4.2), 22)));
}
