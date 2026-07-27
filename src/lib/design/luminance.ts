import type { Rgb } from "./ramp";

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(c: Rgb): number {
  const [r, g, b] = [channel(c[0]), channel(c[1]), channel(c[2])];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function toRgb(c: Rgb | string): Rgb {
  if (typeof c !== "string") return c;
  const hex = c.replace("#", "").slice(0, 6);
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/** WCAG contrast ratio between two colours, 1:1 to 21:1. */
export function contrastRatio(a: Rgb | string, b: Rgb | string): number {
  const la = relativeLuminance(toRgb(a));
  const lb = relativeLuminance(toRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Foreground ink for a tile background.
 *
 * A fixed white label is 2.9:1 on the shipped loss tile and 3.1:1 on the gain
 * tile — both fail AA at every size. Flipping on luminance clears 4.5:1 across
 * the whole ramp. `fg2` is the same ink at ~0.77 alpha for secondary lines.
 *
 * Both constants below are load-bearing and were derived, not chosen. White
 * clears 4.5:1 only up to L = 1.05/4.5 - 0.05 = 0.1833, so that is where the
 * flip has to happen; the handoff's 0.30 left a band of mid-greens and mid-
 * blues on white ink at ratios as low as 3.0:1. The dark ink is pure black
 * because it clears from L = 0.175, which overlaps white's ceiling. The
 * handoff's #06120c only clears from L = 0.1974, leaving 0.1833–0.1974 as a
 * dead band that no threshold value can rescue.
 */
export function foregroundFor(c: Rgb): { fg: string; fg2: string } {
  const fg = relativeLuminance(c) > 0.1833 ? "#000000" : "#ffffff";
  return { fg, fg2: `${fg}c4` };
}
