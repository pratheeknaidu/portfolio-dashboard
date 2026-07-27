export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TooltipPlacement {
  placement: "above" | "below";
  /** Horizontal centre as a percentage of the card, clamped to 9–91%. */
  centerPct: number;
  /** Vertical anchor as a percentage of the card. */
  anchorPct: number;
}

/**
 * Where to put the tooltip so it stays inside the card. The shipped tooltip
 * clips at the container edge, which hides exactly the numbers a user hovered
 * to read.
 */
export function tooltipPosition(tile: Rect, card: Rect): TooltipPlacement {
  const h = card.height || 1;
  const w = card.width || 1;

  const tileTopPct = ((tile.top - card.top) / h) * 100;
  const below = tileTopPct < 45;

  const rawCentre = ((tile.left - card.left + tile.width / 2) / w) * 100;
  const centerPct = Math.max(9, Math.min(91, rawCentre));

  const anchorPct = below ? ((tile.top - card.top + tile.height) / h) * 100 : tileTopPct;

  return { placement: below ? "below" : "above", centerPct, anchorPct };
}
