/**
 * Sector identity palette. Deliberately contains no green and no red: those
 * hues are reserved for P&L direction, and a green sector wedge sitting beside
 * a green gain figure drains the signal from both.
 *
 * Replaces the analogous gold-to-teal sweep in the old chart-palette.ts, which
 * ran straight through the gain hue.
 */
export const SECTOR_COLORS: Record<string, string> = {
  Technology: "#5b8dd6",
  "Financial Services": "#8b6fd6",
  Healthcare: "#3fa9a0",
  "Consumer Defensive": "#c9a44c",
  "Consumer Cyclical": "#a86f9c",
  "Real Estate": "#6f8bb0",
  Energy: "#9c7a5c",
  "Communication Services": "#6cc3d6",
  Utilities: "#7f8f9e",
  Industrials: "#b08a72",
};

/** Aggregate / unknown bucket. Recedes behind the named sectors. */
export const OTHER_COLOR = "#3a434e";

export function sectorColor(sector: string | undefined | null): string {
  if (!sector) return OTHER_COLOR;
  return SECTOR_COLORS[sector] ?? OTHER_COLOR;
}
