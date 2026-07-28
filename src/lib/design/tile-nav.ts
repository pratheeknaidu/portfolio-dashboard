export interface NavRect {
  ticker: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const AXIS: Record<string, { axis: "x" | "y"; dir: 1 | -1 }> = {
  ArrowRight: { axis: "x", dir: 1 },
  ArrowLeft: { axis: "x", dir: -1 },
  ArrowDown: { axis: "y", dir: 1 },
  ArrowUp: { axis: "y", dir: -1 },
};

function centre(r: NavRect) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/**
 * Ticker to move focus to, or null if the key is not a navigation key.
 * Returns the current ticker unchanged at an edge — wrapping in a spatial
 * layout disorients more than it helps.
 *
 * Candidates are filtered to those genuinely in the pressed direction, then
 * ranked by distance along that axis first and perpendicular offset second, so
 * a ragged treemap still moves somewhere predictable.
 */
export function nextTile(
  rects: NavRect[],
  currentTicker: string,
  key: string,
): string | null {
  const move = AXIS[key];
  if (!move) return null;

  const current = rects.find((r) => r.ticker === currentTicker);
  if (!current) return null;

  const from = centre(current);
  const cross = move.axis === "x" ? "y" : "x";

  const candidates = rects
    .filter((r) => r.ticker !== currentTicker)
    .map((r) => ({ r, c: centre(r) }))
    .filter(({ c }) => (c[move.axis] - from[move.axis]) * move.dir > 0)
    .map(({ r, c }) => ({
      ticker: r.ticker,
      along: Math.abs(c[move.axis] - from[move.axis]),
      off: Math.abs(c[cross] - from[cross]),
    }))
    .sort((a, b) => a.along - b.along || a.off - b.off);

  return candidates[0]?.ticker ?? currentTicker;
}
