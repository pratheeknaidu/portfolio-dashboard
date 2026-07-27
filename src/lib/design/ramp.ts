/** An RGB triple in 0–255 sRGB space. */
export type Rgb = readonly [number, number, number];

/** A ramp stop: a position in [-1, 1] and the colour at that position. */
export type Stop = readonly [number, Rgb];

/**
 * Diverging ramps whose LIGHTNESS rises monotonically from largest loss to
 * largest gain. Magnitude therefore survives greyscale printing and every form
 * of colour vision deficiency — hue alone is never load-bearing.
 *
 * Flat is an explicit neutral grey, deliberately NOT a pale green: a
 * break-even position must not read as a small gain.
 */
export const RAMP_NORMAL: Stop[] = [
  [-1.0, [70, 14, 26]],
  [-0.6, [116, 32, 48]],
  [-0.3, [140, 54, 70]],
  [-0.1, [104, 80, 86]],
  [0.0, [92, 98, 106]],
  [0.1, [78, 110, 94]],
  [0.3, [56, 146, 106]],
  [0.6, [86, 196, 140]],
  [1.0, [168, 240, 198]],
];

/**
 * Blue = gain, orange = loss.
 *
 * The loss-side stops are rescaled in LINEAR light to match RAMP_NORMAL's
 * luminance at the same positions — scaling linear channels by one factor
 * preserves chromaticity exactly, so this is the published orange, only
 * darker. The handoff's original values put the -0.3 stop brighter than both
 * the -0.1 stop and the neutral, a 5.5 L* inversion: the ramp meant to carry
 * magnitude for colour-vision-deficient users was the one that lost it.
 */
export const RAMP_CVD: Stop[] = [
  [-1.0, [55, 29, 5]],
  [-0.6, [97, 51, 9]],
  [-0.3, [116, 69, 23]],
  [-0.1, [107, 85, 71]],
  [0.0, [92, 98, 106]],
  [0.1, [76, 106, 124]],
  [0.3, [50, 124, 176]],
  [0.6, [86, 170, 214]],
  [1.0, [162, 214, 242]],
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Colour for a normalised change `t = change / domain`, clamped to [-1, 1].
 * Clamping rather than extrapolating is what keeps an outlier from inventing
 * colours outside the ramp — the legend would then be lying.
 */
export function rampColor(t: number, stops: Stop[]): Rgb {
  const x = Math.max(-1, Math.min(1, Number.isFinite(t) ? t : 0));
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i];
    const [p1, c1] = stops[i + 1];
    if (x >= p0 && x <= p1) {
      const f = p1 === p0 ? 0 : (x - p0) / (p1 - p0);
      return [
        Math.round(lerp(c0[0], c1[0], f)),
        Math.round(lerp(c0[1], c1[1], f)),
        Math.round(lerp(c0[2], c1[2], f)),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

export function rgbString(c: Rgb): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/**
 * The ladder of round domain values. A quiet day lands on ±1%; an all-time
 * view lands on ±80%. Always print the chosen value in the legend and caption:
 * without it, a strong day and a flat one look identical.
 */
export const NICE_DOMAINS = [
  0.5, 1, 2, 3, 5, 8, 12, 20, 30, 50, 80, 120, 200,
] as const;

/**
 * Smallest nice domain covering the largest absolute change in the data.
 *
 * Non-finite values are filtered FIRST and deliberately. A single failed quote
 * yielding NaN would otherwise poison Math.max, make every `max <= n`
 * comparison false, and saturate the domain to 200 — collapsing the entire map
 * to neutral grey with no visible error.
 */
export function niceDomain(values: number[]): number {
  const finite = values.filter((v) => Number.isFinite(v)).map(Math.abs);
  if (finite.length === 0) return NICE_DOMAINS[0];
  const max = Math.max(...finite);
  return NICE_DOMAINS.find((n) => max <= n) ?? 200;
}
