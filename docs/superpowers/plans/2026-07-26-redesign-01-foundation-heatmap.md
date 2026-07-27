# Redesign Plan 1: Foundation + Heat Map

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four pure rules from the design handoff as tested functions, add the new design tokens additively, and rewire the treemap onto them so the heat map encodes magnitude, passes AA contrast, and is keyboard-reachable.

**Architecture:** A new `src/lib/design/` directory holds pure, React-free modules that are unit-tested before any UI consumes them. New CSS custom properties are added to `globals.css` alongside the existing oklch palette rather than replacing it, so the two later plans can migrate screen-by-screen without leaving the app visibly broken. `@nivo/treemap` is kept for layout; only the tile renderer is swapped.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, `@nivo/treemap`, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-26-design-handoff-redesign-design.md`

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `src/lib/design/ramp.ts` | Diverging colour ramps + interpolation + domain selection |
| `src/lib/design/luminance.ts` | WCAG relative luminance, foreground flip |
| `src/lib/design/format.ts` | The one number formatter for the whole app |
| `src/lib/design/sectors.ts` | Sector colour palette (no green, no red) |
| `src/lib/design/tiles.ts` | Treemap label tier + font-size thresholds |
| `src/lib/preferences-context.tsx` | Colourblind ramp preference, `localStorage`-backed |
| `src/components/TreemapLegend.tsx` | Gradient strip + printed domain |
| `src/components/HeatMapCard.tsx` | Card shell, caption, labelled SIZE/COLOUR groups |

**Modify:** `src/app/globals.css`, `src/app/layout.tsx`, `tailwind.config.ts`, `src/components/Treemap.tsx`, `src/components/TreemapTooltip.tsx`, `src/app/page.tsx`.

**Delete at the end of this plan:** `src/components/SizingToggle.tsx`, `src/components/TimeRangeToggle.tsx` (absorbed into `HeatMapCard`).

---

## Task 1: Colour ramp interpolation

**Files:**
- Create: `src/lib/design/ramp.ts`
- Test: `src/__tests__/lib/design/ramp.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { RAMP_NORMAL, RAMP_CVD, rampColor, rgbString } from "@/lib/design/ramp";
import { relativeLuminance } from "@/lib/design/luminance";

describe("rampColor", () => {
  it("returns the exact stop colour at a stop position", () => {
    expect(rampColor(0, RAMP_NORMAL)).toEqual([92, 98, 106]);
    expect(rampColor(-1, RAMP_NORMAL)).toEqual([70, 14, 26]);
    expect(rampColor(1, RAMP_NORMAL)).toEqual([168, 240, 198]);
  });

  it("interpolates linearly between two stops", () => {
    // Midway between t=0 [92,98,106] and t=0.10 [78,110,94]
    expect(rampColor(0.05, RAMP_NORMAL)).toEqual([85, 104, 100]);
  });

  it("clamps beyond the domain instead of extrapolating", () => {
    expect(rampColor(4, RAMP_NORMAL)).toEqual(rampColor(1, RAMP_NORMAL));
    expect(rampColor(-9, RAMP_NORMAL)).toEqual(rampColor(-1, RAMP_NORMAL));
  });

  it("treats flat as neutral grey, never a pale green", () => {
    const [r, g, b] = rampColor(0, RAMP_NORMAL);
    expect(g).toBeLessThan(b); // grey-blue, not green-leaning
    expect(Math.abs(r - g)).toBeLessThan(10);
  });

  it("formats as a CSS rgb string", () => {
    expect(rgbString([1, 2, 3])).toBe("rgb(1,2,3)");
  });
});

describe.each([
  ["RAMP_NORMAL", RAMP_NORMAL],
  ["RAMP_CVD", RAMP_CVD],
])("%s luminance monotonicity", (_name, ramp) => {
  it("rises monotonically from loss to gain so magnitude survives greyscale", () => {
    const samples = Array.from({ length: 41 }, (_, i) => -1 + i * 0.05);
    const lums = samples.map((t) => relativeLuminance(rampColor(t, ramp)));
    for (let i = 1; i < lums.length; i++) {
      expect(lums[i]).toBeGreaterThan(lums[i - 1]);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/lib/design/ramp.test.ts`
Expected: FAIL — `Cannot find module '@/lib/design/ramp'`.

- [ ] **Step 3: Write the implementation**

```ts
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

/** Blue = gain, orange = loss. Same luminance profile as RAMP_NORMAL. */
export const RAMP_CVD: Stop[] = [
  [-1.0, [74, 40, 8]],
  [-0.6, [122, 66, 14]],
  [-0.3, [146, 88, 32]],
  [-0.1, [106, 84, 70]],
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/lib/design/ramp.test.ts`
Expected: PASS — but the two `luminance monotonicity` cases will still fail with `Cannot find module '@/lib/design/luminance'`. That module arrives in Task 3; leave those two failing for now and confirm the other five pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/ramp.ts src/__tests__/lib/design/ramp.test.ts
git commit -m "feat(design): luminance-monotonic diverging colour ramps

Replaces the two unrelated ramps in the shipped treemap with one
diverging scale whose lightness rises continuously from loss to gain, so
magnitude survives greyscale and colour vision deficiency. Flat is an
explicit neutral grey rather than a pale green."
```

---

## Task 2: Nice domain selection

**Files:**
- Modify: `src/lib/design/ramp.ts`
- Test: `src/__tests__/lib/design/ramp.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/lib/design/ramp.test.ts`, and add `niceDomain` and `NICE_DOMAINS` to the existing import from `@/lib/design/ramp`:

```ts
describe("niceDomain", () => {
  it.each([
    [[0.2, -0.4, 0.31], 0.5],
    [[0.9, -0.2], 1],
    [[-1.4, 0.8], 2],
    [[2.6, -1.1], 3],
    [[4.9], 5],
    [[7.2, -3], 8],
    [[68, -12], 80],
    [[241, -30], 200], // beyond the largest nice value: saturate, don't crash
  ])("picks the first nice value that covers %p", (values, expected) => {
    expect(niceDomain(values)).toBe(expected);
  });

  it("uses absolute magnitude, so a big loss widens the domain", () => {
    expect(niceDomain([-11.2, 0.3])).toBe(12);
  });

  it("ignores non-finite values so one bad quote can't collapse the map", () => {
    // Without the isFinite guard Math.max returns NaN, every comparison is
    // false, and the domain saturates to 200 — flattening every tile to grey.
    expect(niceDomain([0.4, NaN, -0.2])).toBe(0.5);
    expect(niceDomain([1.5, Infinity])).toBe(2);
  });

  it("falls back to the smallest domain when there is no usable data", () => {
    expect(niceDomain([])).toBe(0.5);
    expect(niceDomain([NaN, NaN])).toBe(0.5);
  });

  it("exposes the nice ladder for the legend to label", () => {
    expect(NICE_DOMAINS[0]).toBe(0.5);
    expect(NICE_DOMAINS[NICE_DOMAINS.length - 1]).toBe(200);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/lib/design/ramp.test.ts -t "niceDomain"`
Expected: FAIL — `niceDomain is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/design/ramp.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/lib/design/ramp.test.ts -t "niceDomain"`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/ramp.ts src/__tests__/lib/design/ramp.test.ts
git commit -m "feat(design): derive the colour domain from the data

The shipped treemap hardcodes a ±3% domain, so on a quiet day every tile
lands on the same swatch. niceDomain picks the smallest round value that
covers the data, and filters non-finite values first so one failed quote
cannot collapse the map to grey."
```

---

## Task 3: Luminance and the foreground flip

**Files:**
- Create: `src/lib/design/luminance.ts`
- Test: `src/__tests__/lib/design/luminance.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { relativeLuminance, contrastRatio, foregroundFor } from "@/lib/design/luminance";
import { RAMP_NORMAL, RAMP_CVD, rampColor } from "@/lib/design/ramp";

describe("relativeLuminance", () => {
  it("returns 0 for black and 1 for white", () => {
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 5);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
  });

  it("weights green most heavily, per WCAG", () => {
    expect(relativeLuminance([0, 255, 0])).toBeGreaterThan(relativeLuminance([255, 0, 0]));
    expect(relativeLuminance([255, 0, 0])).toBeGreaterThan(relativeLuminance([0, 0, 255]));
  });
});

describe("foregroundFor", () => {
  it("picks dark ink on light tiles and white on dark tiles", () => {
    expect(foregroundFor([168, 240, 198]).fg).toBe("#06120c");
    expect(foregroundFor([70, 14, 26]).fg).toBe("#ffffff");
  });

  it("derives the secondary colour from the primary at ~0.77 alpha", () => {
    expect(foregroundFor([168, 240, 198]).fg2).toBe("#06120cc4");
    expect(foregroundFor([70, 14, 26]).fg2).toBe("#ffffffc4");
  });
});

describe.each([
  ["RAMP_NORMAL", RAMP_NORMAL],
  ["RAMP_CVD", RAMP_CVD],
])("%s tile contrast", (_name, ramp) => {
  it("clears WCAG AA 4.5:1 at every point on the ramp", () => {
    for (let i = 0; i <= 40; i++) {
      const t = -1 + i * 0.05;
      const bg = rampColor(t, ramp);
      const { fg } = foregroundFor(bg);
      expect(contrastRatio(bg, fg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("beats a fixed white foreground, which fails on light tiles", () => {
    const lightGain = rampColor(1, ramp);
    const white: [number, number, number] = [255, 255, 255];
    expect(contrastRatio(lightGain, white)).toBeLessThan(4.5);
    expect(contrastRatio(lightGain, foregroundFor(lightGain).fg)).toBeGreaterThanOrEqual(4.5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/lib/design/luminance.test.ts`
Expected: FAIL — `Cannot find module '@/lib/design/luminance'`.

- [ ] **Step 3: Write the implementation**

```ts
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
 */
export function foregroundFor(c: Rgb): { fg: string; fg2: string } {
  const fg = relativeLuminance(c) > 0.3 ? "#06120c" : "#ffffff";
  return { fg, fg2: `${fg}c4` };
}
```

- [ ] **Step 4: Run both test files to verify they pass**

Run: `npm test -- src/__tests__/lib/design/`
Expected: PASS — including the two `luminance monotonicity` cases from Task 1 that were left failing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/luminance.ts src/__tests__/lib/design/luminance.test.ts
git commit -m "feat(design): flip tile foreground on luminance

White-on-tile is 2.9:1 on the shipped loss colour and fails AA at every
size. Choosing ink by WCAG relative luminance clears 4.5:1 across both
ramps; the test asserts that at 41 points along each."
```

---

## Task 4: Number formatting

**Files:**
- Create: `src/lib/design/format.ts`
- Test: `src/__tests__/lib/design/format.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { MINUS, money, signedMoney, signedPct, axisMoney } from "@/lib/design/format";

describe("money", () => {
  it("always shows two decimals with thousands separators", () => {
    expect(money(155876.26)).toBe("$155,876.26");
    expect(money(8)).toBe("$8.00");
  });

  it("puts a true minus sign before the dollar sign", () => {
    expect(money(-60.97)).toBe("−$60.97");
    expect(money(-60.97).startsWith(MINUS)).toBe(true);
  });

  it("never uses a hyphen, which does not align in tabular figures", () => {
    expect(money(-60.97)).not.toContain("-");
  });

  it("accepts a decimal-place override for axis-adjacent use", () => {
    expect(money(1234.5, 0)).toBe("$1,235");
  });
});

describe("signedMoney", () => {
  it("shows an explicit plus on gains", () => {
    expect(signedMoney(80.92)).toBe("+$80.92");
    expect(signedMoney(-60.97)).toBe("−$60.97");
  });

  it("treats zero as positive rather than emitting a bare value", () => {
    expect(signedMoney(0)).toBe("+$0.00");
  });
});

describe("signedPct", () => {
  it("always shows two decimals and a sign", () => {
    expect(signedPct(0.06)).toBe("+0.06%");
    expect(signedPct(-1.2)).toBe("−1.20%");
    expect(signedPct(0)).toBe("+0.00%");
  });
});

describe("axisMoney", () => {
  it("abbreviates thousands and millions — the only place abbreviation is allowed", () => {
    expect(axisMoney(165000)).toBe("$165k");
    expect(axisMoney(1250000)).toBe("$1.3m");
    expect(axisMoney(940)).toBe("$940");
  });

  it("keeps the true minus sign", () => {
    expect(axisMoney(-165000)).toBe("−$165k");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/lib/design/format.test.ts`
Expected: FAIL — `Cannot find module '@/lib/design/format'`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * U+2212 MINUS SIGN, not U+002D HYPHEN-MINUS.
 *
 * In a tabular-figures font the minus sign shares an advance width with the
 * digits; a hyphen does not. Using a hyphen knocks every negative number half a
 * pixel out of column in a right-aligned table.
 */
export const MINUS = "−";

function group(v: number, dp: number): string {
  return Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

/** `$155,876.26` / `−$60.97`. Two decimals unless overridden. */
export function money(v: number, dp = 2): string {
  return `${v < 0 ? `${MINUS}$` : "$"}${group(v, dp)}`;
}

/** `+$80.92` / `−$60.97`. Zero reads as a gain. */
export function signedMoney(v: number, dp = 2): string {
  return `${v < 0 ? `${MINUS}$` : "+$"}${group(v, dp)}`;
}

/** `+0.06%` / `−1.20%`. Always two decimals. */
export function signedPct(v: number): string {
  return `${v < 0 ? MINUS : "+"}${Math.abs(v).toFixed(2)}%`;
}

/**
 * `$165k`. The ONLY place in the product where a number may be abbreviated —
 * chart axis labels, where the precise value is available on hover anyway.
 */
export function axisMoney(v: number): string {
  const sign = v < 0 ? MINUS : "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/lib/design/format.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/format.ts src/__tests__/lib/design/format.test.ts
git commit -m "feat(design): one number formatter for the whole app

Five number conventions currently coexist on one screen. This is the
single rule: two decimals, thousands separated, explicit sign on deltas,
abbreviation only on chart axes, and U+2212 rather than a hyphen so
negatives stay column-aligned in tabular figures."
```

---

## Task 5: Sector palette

**Files:**
- Create: `src/lib/design/sectors.ts`
- Test: `src/__tests__/lib/design/sectors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { SECTOR_COLORS, OTHER_COLOR, sectorColor } from "@/lib/design/sectors";

describe("sectorColor", () => {
  it("returns the palette entry for a known sector", () => {
    expect(sectorColor("Technology")).toBe("#5b8dd6");
    expect(sectorColor("Healthcare")).toBe("#3fa9a0");
  });

  it("falls back to the Other colour for unknown or missing sectors", () => {
    expect(sectorColor("Widgets")).toBe(OTHER_COLOR);
    expect(sectorColor(undefined)).toBe(OTHER_COLOR);
    expect(sectorColor("")).toBe(OTHER_COLOR);
  });
});

describe("SECTOR_COLORS", () => {
  it("covers the ten sectors Yahoo returns", () => {
    expect(Object.keys(SECTOR_COLORS)).toHaveLength(10);
  });

  // The palette must never collide with P&L semantics: a green sector wedge
  // beside a green gain figure makes both meaningless.
  it("contains no green and no red hue", () => {
    for (const hex of Object.values(SECTOR_COLORS)) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const isGreen = g > r + 30 && g > b + 30;
      const isRed = r > g + 40 && r > b + 40;
      expect({ hex, isGreen, isRed }).toEqual({ hex, isGreen: false, isRed: false });
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/lib/design/sectors.test.ts`
Expected: FAIL — `Cannot find module '@/lib/design/sectors'`.

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/lib/design/sectors.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/sectors.ts src/__tests__/lib/design/sectors.test.ts
git commit -m "feat(design): sector palette with no green and no red

Sector identity must not borrow the hues that carry P&L direction. The
test asserts the constraint rather than trusting the hex values."
```

---

## Task 6: Tile label thresholds

**Files:**
- Create: `src/lib/design/tiles.ts`
- Test: `src/__tests__/lib/design/tiles.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { labelTier, tileFontSize, MIN_TILE } from "@/lib/design/tiles";

describe("labelTier", () => {
  it.each([
    [200, 160, "full"],
    [92, 78, "full"],
    [91, 78, "percent"],
    [92, 77, "percent"],
    [62, 44, "percent"],
    [61, 44, "ticker"],
    [34, 24, "ticker"],
    [33, 24, "none"],
    [34, 23, "none"],
    [10, 10, "none"],
  ])("desktop %ix%i is %s", (w, h, expected) => {
    expect(labelTier(w, h, false)).toBe(expected);
  });

  it("uses a lower ticker threshold on mobile, where maps are denser", () => {
    expect(labelTier(30, 22, true)).toBe("ticker");
    expect(labelTier(30, 22, false)).toBe("none");
    expect(labelTier(29, 22, true)).toBe("none");
  });

  it("exposes the mobile ticker minimum for the aggregate-strip cutoff", () => {
    expect(MIN_TILE.mobile).toEqual({ w: 30, h: 22 });
    expect(MIN_TILE.desktop).toEqual({ w: 34, h: 24 });
  });
});

describe("tileFontSize", () => {
  it("scales with the tile's tighter dimension", () => {
    expect(tileFontSize(92, 84)).toBe(20);
  });

  it("never drops below the 11px legibility floor", () => {
    expect(tileFontSize(34, 24)).toBe(11);
    expect(tileFontSize(1, 1)).toBe(11);
  });

  it("caps at 22px so a dominant position does not shout", () => {
    expect(tileFontSize(600, 400)).toBe(22);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/lib/design/tiles.test.ts`
Expected: FAIL — `Cannot find module '@/lib/design/tiles'`.

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/lib/design/tiles.test.ts`
Expected: PASS, 6 tests (the first is a 10-case table).

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/tiles.ts src/__tests__/lib/design/tiles.test.ts
git commit -m "feat(design): tile label thresholds

Boundary-exact tests for what a tile of a given size can carry. The
shipped treemap hides both labels below 50x30, which leaves a band of
tiles that look interactive but say nothing."
```

---

## Task 7: Design tokens, additively

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `tailwind.config.ts`

No test — this is declarative styling with no logic. It is verified visually in Task 15.

- [ ] **Step 1: Add the token block to `src/app/globals.css`**

Insert inside the existing `@layer base`, immediately after the closing `}` of the current `:root` block. Do NOT remove or edit the existing oklch variables — both palettes coexist until Plan 4 deletes the old one.

```css
  /* ---------------------------------------------------------------
     Redesign tokens (design handoff, 2026-07-26).
     Added alongside the legacy oklch palette above, NOT replacing it:
     globals.css is global, so a destructive swap would break every
     screen the moment the first one migrates. Screens opt in as they
     are rewritten; the legacy block is deleted in redesign plan 4.
     --------------------------------------------------------------- */
  :root {
    --rd-page: #07090b;
    --rd-chrome: #0b0e12;
    --rd-card: #0f1318;
    --rd-inset: #0a0d11;
    --rd-control: #12161c;
    --rd-row-header: #0c1014;
    --rd-row-hover: #12181e;

    --rd-border-hairline: #151b21;
    --rd-border: #1c222a;
    --rd-border-control: #1e242c;
    --rd-border-strong: #242b34;
    --rd-border-stronger: #2a323c;
    --rd-gridline: #141d18;

    --rd-text: #e9edf1;
    --rd-text-secondary: #d3dbe3;
    --rd-text-body: #b7c1cb;
    --rd-text-muted: #97a4b1;
    --rd-text-label: #7b8895;
    --rd-text-dim: #6b7885;
    --rd-text-faint: #55616e;
    --rd-text-disabled: #3a434e;

    --rd-gain: #4ade9b;
    --rd-loss: #e2707f;
    --rd-flat: #8fa0ae;
    --rd-flat-tile: #5c626a;
    --rd-flat-aggregate: #2e343c;
    --rd-warning: #d9a441;
    --rd-error: #e0913e;

    --rd-focus: #4ade9b;
  }

  /* The colourblind preference re-points the two semantic colours at the
     document root, so every P&L figure in the app flips with no React
     re-render and no prop drilling. Only the treemap needs the preference
     in JS, because interpolating a ramp is not something CSS can do. */
  :root[data-cvd="true"] {
    --rd-gain: #5eb2e0;
    --rd-loss: #e0913e;
  }
```

- [ ] **Step 2: Add the focus-ring utility to `src/app/globals.css`**

Append inside the existing `@layer components` block:

```css
  /* There is currently no visible focus anywhere in the product. */
  .rd-focusable:focus-visible {
    outline: 2px solid var(--rd-focus);
    outline-offset: 2px;
  }
```

- [ ] **Step 3: Expose the tokens to Tailwind**

In `tailwind.config.ts`, add an `rd` group inside `theme.extend.colors`, leaving every existing key untouched:

```ts
        rd: {
          page: "var(--rd-page)",
          chrome: "var(--rd-chrome)",
          card: "var(--rd-card)",
          inset: "var(--rd-inset)",
          control: "var(--rd-control)",
          "row-header": "var(--rd-row-header)",
          "row-hover": "var(--rd-row-hover)",
          border: "var(--rd-border)",
          "border-hairline": "var(--rd-border-hairline)",
          "border-control": "var(--rd-border-control)",
          "border-strong": "var(--rd-border-strong)",
          "border-stronger": "var(--rd-border-stronger)",
          gridline: "var(--rd-gridline)",
          text: "var(--rd-text)",
          secondary: "var(--rd-text-secondary)",
          body: "var(--rd-text-body)",
          muted: "var(--rd-text-muted)",
          label: "var(--rd-text-label)",
          dim: "var(--rd-text-dim)",
          faint: "var(--rd-text-faint)",
          disabled: "var(--rd-text-disabled)",
          gain: "var(--rd-gain)",
          loss: "var(--rd-loss)",
          flat: "var(--rd-flat)",
          warning: "var(--rd-warning)",
          error: "var(--rd-error)",
        },
```

- [ ] **Step 4: Swap the sans fonts in `src/app/layout.tsx`**

Replace the `Space_Grotesk, DM_Sans, JetBrains_Mono` import and the two sans font constants:

```ts
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";

// One proportional sans for prose, one tabular mono for every number. That
// pairing rule is the spec; the specific families are replaceable.
const bodyFont = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});
```

`--font-display` still has consumers on the not-yet-migrated screens, so point it at the same family rather than deleting it:

```ts
const displayFont = bodyFont;
```

Leave the `<html className={...}>` line as it is — it already interpolates all three variables.

- [ ] **Step 5: Verify the app still builds and every existing test passes**

Run: `npm run build && npm test`
Expected: build succeeds; all pre-existing tests pass. Nothing looks different yet — no component consumes an `--rd-*` token until Task 10.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx tailwind.config.ts
git commit -m "feat(design): add redesign tokens alongside the legacy palette

globals.css is global, so swapping the palette destructively would break
every screen the moment the first one migrates. The rd-* tokens coexist
with the oklch ones; screens opt in as they are rewritten and the legacy
block is deleted in the final redesign plan.

Sans switches to Instrument Sans; JetBrains Mono gains weight 700."
```

---

## Task 8: Colourblind ramp preference

**Files:**
- Create: `src/lib/preferences-context.tsx`
- Modify: `src/app/layout.tsx`
- Test: `src/__tests__/lib/preferences-context.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreferencesProvider, usePreferences } from "@/lib/preferences-context";

function Probe() {
  const { cvd, setCvd } = usePreferences();
  return (
    <button onClick={() => setCvd(!cvd)}>{cvd ? "cvd-on" : "cvd-off"}</button>
  );
}

const renderProbe = () =>
  render(
    <PreferencesProvider>
      <Probe />
    </PreferencesProvider>,
  );

describe("usePreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-cvd");
  });

  it("defaults to the normal ramp", () => {
    renderProbe();
    expect(screen.getByText("cvd-off")).toBeInTheDocument();
  });

  it("persists the preference to localStorage", async () => {
    renderProbe();
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText("cvd-on")).toBeInTheDocument();
    expect(window.localStorage.getItem("pref:cvd")).toBe("true");
  });

  it("rehydrates a stored preference on mount", () => {
    window.localStorage.setItem("pref:cvd", "true");
    renderProbe();
    expect(screen.getByText("cvd-on")).toBeInTheDocument();
  });

  // This attribute is what lets every P&L text colour in the app flip via CSS
  // alone, with no re-render and no prop drilling.
  it("mirrors the preference onto the document root", async () => {
    renderProbe();
    expect(document.documentElement.getAttribute("data-cvd")).toBe("false");
    await userEvent.click(screen.getByRole("button"));
    expect(document.documentElement.getAttribute("data-cvd")).toBe("true");
  });

  it("survives localStorage being unavailable", () => {
    const spy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => renderProbe()).not.toThrow();
    expect(screen.getByText("cvd-off")).toBeInTheDocument();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/lib/preferences-context.test.tsx`
Expected: FAIL — `Cannot find module '@/lib/preferences-context'`.

- [ ] **Step 3: Write the implementation**

```tsx
"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const CVD_KEY = "pref:cvd";

interface Preferences {
  /** Colourblind ramp: blue = gain, orange = loss. */
  cvd: boolean;
  setCvd: (v: boolean) => void;
}

const PreferencesContext = createContext<Preferences>({
  cvd: false,
  setCvd: () => {},
});

/**
 * Device-level display preferences, backed by localStorage rather than
 * Firestore — they must not cost a network round trip on first paint, and they
 * are properly per-device rather than per-account.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  // Starts false on both server and first client render so hydration matches;
  // the stored value is applied in the effect below.
  const [cvd, setCvdState] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(CVD_KEY) === "true") setCvdState(true);
    } catch {
      // Private browsing or a blocked-storage policy. The default is fine.
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-cvd", String(cvd));
  }, [cvd]);

  const setCvd = useCallback((v: boolean) => {
    setCvdState(v);
    try {
      window.localStorage.setItem(CVD_KEY, String(v));
    } catch {
      // Preference still applies for this session.
    }
  }, []);

  return (
    <PreferencesContext.Provider value={{ cvd, setCvd }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): Preferences {
  return useContext(PreferencesContext);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/lib/preferences-context.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Mount the provider in `src/app/layout.tsx`**

Add the import and wrap the existing tree, inside `AuthProvider` and outside `ToastProvider`:

```tsx
import { PreferencesProvider } from "@/lib/preferences-context";
```

```tsx
        <AuthProvider>
          <PreferencesProvider>
            <ToastProvider>
              {children}
              <ToastStack />
            </ToastProvider>
          </PreferencesProvider>
        </AuthProvider>
```

- [ ] **Step 6: Verify the build**

Run: `npm run build && npm test`
Expected: build succeeds, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/preferences-context.tsx src/app/layout.tsx src/__tests__/lib/preferences-context.test.tsx
git commit -m "feat: persist the colourblind ramp as a user preference

Ships the alternate ramp as a real preference rather than a debug
toggle. Mirroring it onto a data-cvd attribute on the document root lets
every P&L text colour flip through CSS alone; only the treemap needs the
value in JS, since CSS cannot interpolate a ramp."
```

---

## Task 9: Extract the shared portfolio data hook

**Files:**
- Create: `src/lib/use-portfolio-data.ts`
- Modify: `src/app/page.tsx`

This is a behaviour-preserving extraction. `src/app/analytics/page.tsx` is NOT migrated here — it moves in redesign plan 4, when Analytics is rewritten.

- [ ] **Step 1: Write the hook**

Move the fetch/merge/derive logic out of `src/app/page.tsx:123-195` verbatim, adding only the explicit `status` value the loading state needs.

```ts
"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { useIsDemo } from "@/lib/demo-context";
import { buildDemoItems } from "@/lib/demo-data";
import { isMarketOpen } from "@/lib/market-hours";
import type { Holding, PortfolioItem, Quote, TimeRange } from "@/types";

/**
 * `loading` is distinct from `empty` on purpose. The shipped app renders
 * $0.00 and "No holdings yet" while the first fetch is still in flight, so a
 * slow connection flashes a zeroed portfolio — the most trust-destroying frame
 * a money app can show.
 */
export type PortfolioStatus = "loading" | "ready" | "empty" | "error";

export interface PortfolioData {
  items: PortfolioItem[];
  failed: string[];
  status: PortfolioStatus;
  refresh: () => Promise<void>;
}

interface QuotesResponse {
  quotes: Record<string, Quote>;
  failed: string[];
}

export function usePortfolioData(range: TimeRange): PortfolioData {
  const { getIdToken } = useAuth();
  const toast = useToast();
  const isDemo = useIsDemo();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [status, setStatus] = useState<PortfolioStatus>("loading");

  const refresh = useCallback(async () => {
    if (isDemo) {
      setItems(buildDemoItems(range));
      setFailed([]);
      setStatus("ready");
      return;
    }

    const token = await getIdToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const holdingsRes = await fetch("/api/portfolio", { headers });
      if (!holdingsRes.ok) {
        toast.error(`Couldn't load your holdings (${holdingsRes.status}).`);
        setItems([]);
        setStatus("error");
        return;
      }
      const holdings: Holding[] = await holdingsRes.json();
      if (!Array.isArray(holdings) || holdings.length === 0) {
        setItems([]);
        setStatus("empty");
        return;
      }

      const tickers = holdings.map((h) => h.ticker).join(",");
      const quotesUrl =
        range === "ALL"
          ? `/api/quotes?tickers=${tickers}`
          : `/api/quotes?tickers=${tickers}&range=${range}`;
      const quotesRes = await fetch(quotesUrl, { headers });
      if (!quotesRes.ok) {
        toast.error("Quotes service is unavailable. Showing last-known values.");
        setStatus("error");
        return;
      }
      const { quotes, failed: failedTickers }: QuotesResponse = await quotesRes.json();
      setFailed(failedTickers ?? []);

      const merged: PortfolioItem[] = holdings
        .filter((h) => quotes[h.ticker])
        .map((h) => {
          const q = quotes[h.ticker];
          const marketValue = h.shares * q.price;
          const costBasis = h.shares * h.avgCost;
          const totalPL = marketValue - costBasis;
          const totalPLPercent = (totalPL / costBasis) * 100;
          // In ALL mode the "change" a tile colours by is lifetime P&L, not
          // the day move, so the treemap and the range pill agree.
          const quote: Quote =
            range === "ALL"
              ? { ...q, change: q.price - h.avgCost, changePercent: totalPLPercent }
              : q;
          return { ...h, quote, marketValue, totalPL, totalPLPercent };
        });

      setItems(merged);
      setStatus(merged.length === 0 ? "empty" : "ready");

      const totalValue = merged.reduce((sum, i) => sum + i.marketValue, 0);
      const holdingsMap = Object.fromEntries(merged.map((i) => [i.ticker, i.marketValue]));
      await fetch("/api/snapshot", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ totalValue, holdings: holdingsMap }),
      });
    } catch (err) {
      console.error("usePortfolioData refresh failed:", err);
      toast.error("Network error — couldn't refresh portfolio.");
      setStatus("error");
    }
  }, [getIdToken, range, toast, isDemo]);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      if (isMarketOpen()) refresh();
    }, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { items, failed, status, refresh };
}
```

- [ ] **Step 2: Consume it from `src/app/page.tsx`**

Delete the `items` / `failedTickers` / `hasFetched` state, the `fetchPortfolio` callback and its `useEffect` (lines 47–55, 123–218 of the current file), and replace with:

```tsx
const { items, failed: failedTickers, status, refresh: fetchPortfolio } = usePortfolioData(range);
```

Add the import, remove the now-unused imports (`Holding`, `Quote`, `buildDemoItems`, `isMarketOpen`, and the local `QuotesResponse` interface), and replace the empty-state condition `hasFetched && items.length === 0` with `status === "empty"`.

- [ ] **Step 3: Verify nothing changed behaviourally**

Run: `npm run lint && npm run build && npm test`
Expected: no lint errors, build succeeds, all tests pass.

- [ ] **Step 4: Verify the demo dashboard still renders**

Start the preview at `/demo` and confirm the treemap, hero and movers all render as before. Nothing should look different — this is a pure extraction.

- [ ] **Step 5: Commit**

```bash
git add src/lib/use-portfolio-data.ts src/app/page.tsx
git commit -m "refactor: extract usePortfolioData from the dashboard page

The dashboard and analytics pages already duplicate this fetch-merge-
derive block; the redesign adds a third screen, which would make three
copies. Also splits loading from empty explicitly, which the new loading
state needs — the current code cannot tell them apart."
```

---

## Task 10: Treemap tile

**Files:**
- Modify: `src/components/Treemap.tsx`
- Test: `src/__tests__/components/TreemapTile.test.tsx`

- [ ] **Step 1: Write the failing test**

Replace the contents of `src/__tests__/components/TreemapTile.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TreemapTile } from "@/components/Treemap";
import type { PortfolioItem } from "@/types";

const item: PortfolioItem = {
  ticker: "AAPL",
  companyName: "Apple Inc.",
  sector: "Technology",
  shares: 80,
  avgCost: 142.8,
  addedAt: "2026-01-02T00:00:00.000Z",
  quote: { price: 168.75, change: 1.09, changePercent: 0.65, previousClose: 167.66 },
  marketValue: 13500,
  totalPL: 2076,
  totalPLPercent: 18.16,
};

const base = {
  item,
  changePercent: 0.65,
  domain: 1,
  cvd: false,
  isMobile: false,
  x: 0,
  y: 0,
  onSelect: jest.fn(),
};

describe("TreemapTile labels", () => {
  it("renders ticker, percent and sub-label on a large tile", () => {
    render(<TreemapTile {...base} width={200} height={160} />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByTestId("tile-percent")).toHaveTextContent("▲0.65%");
    expect(screen.getByTestId("tile-sub")).toHaveTextContent("$13,500.00");
  });

  it("drops the sub-label but keeps the percent at medium size", () => {
    render(<TreemapTile {...base} width={70} height={50} />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByTestId("tile-percent")).toBeInTheDocument();
    expect(screen.queryByTestId("tile-sub")).not.toBeInTheDocument();
  });

  it("shows the ticker alone on a small tile", () => {
    render(<TreemapTile {...base} width={40} height={30} />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.queryByTestId("tile-percent")).not.toBeInTheDocument();
  });

  it("renders nothing legible below the ticker threshold", () => {
    render(<TreemapTile {...base} width={20} height={14} />);
    expect(screen.queryByText("AAPL")).not.toBeInTheDocument();
  });
});

describe("TreemapTile sign encoding", () => {
  // Sign must never depend on colour alone.
  it.each([
    [0.65, "▲"],
    [-0.42, "▼"],
    [0, "◆"],
  ])("prefixes %p with %s", (pct, glyph) => {
    render(<TreemapTile {...base} changePercent={pct} width={200} height={160} />);
    expect(screen.getByTestId("tile-percent").textContent).toContain(glyph);
  });
});

describe("TreemapTile accessibility", () => {
  it("is a real button carrying the full position in its label", () => {
    render(<TreemapTile {...base} width={200} height={160} />);
    const tile = screen.getByRole("button");
    expect(tile).toHaveAccessibleName("AAPL, Apple Inc., $13,500.00, up 0.65% today");
  });

  it("says 'down' for a loss", () => {
    render(<TreemapTile {...base} changePercent={-0.42} width={200} height={160} />);
    expect(screen.getByRole("button")).toHaveAccessibleName(/down 0\.42% today/);
  });

  it("selects on click and on Enter", async () => {
    const onSelect = jest.fn();
    render(<TreemapTile {...base} onSelect={onSelect} width={200} height={160} />);
    const tile = screen.getByRole("button");
    await userEvent.click(tile);
    expect(onSelect).toHaveBeenCalledWith(item, expect.any(Object));
    tile.focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("carries a data-ticker hook for arrow-key navigation", () => {
    render(<TreemapTile {...base} width={200} height={160} />);
    expect(screen.getByRole("button")).toHaveAttribute("data-ticker", "AAPL");
  });
});

describe("TreemapTile contrast", () => {
  it("uses dark ink on a light gain tile and white on a dark loss tile", () => {
    const { rerender } = render(
      <TreemapTile {...base} changePercent={5} domain={5} width={200} height={160} />,
    );
    expect(screen.getByText("AAPL")).toHaveStyle({ color: "#06120c" });

    rerender(<TreemapTile {...base} changePercent={-5} domain={5} width={200} height={160} />);
    expect(screen.getByText("AAPL")).toHaveStyle({ color: "#ffffff" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/components/TreemapTile.test.tsx`
Expected: FAIL — the current tile takes a `color` prop, has no `domain`/`cvd`/`isMobile`, and renders no `tile-sub`.

- [ ] **Step 3: Replace `TreemapTile` in `src/components/Treemap.tsx`**

```tsx
"use client";
import { rampColor, rgbString, RAMP_NORMAL, RAMP_CVD } from "@/lib/design/ramp";
import { foregroundFor } from "@/lib/design/luminance";
import { labelTier, tileFontSize } from "@/lib/design/tiles";
import { money, signedMoney } from "@/lib/design/format";
import type { PortfolioItem } from "@/types";
import type { TileRect } from "./TreemapTooltip";

export interface TreemapTileProps {
  item: PortfolioItem;
  changePercent: number;
  /** The clamp domain in percent, from niceDomain(). */
  domain: number;
  cvd: boolean;
  isMobile: boolean;
  width: number;
  height: number;
  x: number;
  y: number;
  /** When set, the sub-label shows signed P&L instead of market value. */
  showPL?: boolean;
  onSelect: (item: PortfolioItem, rect: TileRect) => void;
}

export function TreemapTile({
  item,
  changePercent,
  domain,
  cvd,
  isMobile,
  width,
  height,
  x,
  y,
  showPL = false,
  onSelect,
}: TreemapTileProps) {
  const raw = Number.isFinite(changePercent) ? changePercent : 0;
  const bg = rampColor(raw / domain, cvd ? RAMP_CVD : RAMP_NORMAL);
  const { fg, fg2 } = foregroundFor(bg);
  const tier = labelTier(width, height, isMobile);
  const size = tileFontSize(width, height);

  // Sign is carried by a glyph as well as by colour, so it survives greyscale
  // and every form of colour vision deficiency.
  const glyph = raw > 0 ? "▲" : raw < 0 ? "▼" : "◆";
  const direction = raw > 0 ? "up" : raw < 0 ? "down" : "flat";
  const sub = showPL ? signedMoney(item.totalPL) : money(item.marketValue);

  const select = (target: HTMLElement) => {
    const r = target.getBoundingClientRect();
    onSelect(item, { top: r.top, left: r.left, width: r.width, height: r.height });
  };

  return (
    <button
      type="button"
      data-ticker={item.ticker}
      aria-label={`${item.ticker}, ${item.companyName}, ${money(item.marketValue)}, ${direction} ${Math.abs(raw).toFixed(2)}% today`}
      className="rd-focusable"
      style={{
        position: "absolute",
        top: y,
        left: x,
        width,
        height,
        background: rgbString(bg),
        border: "none",
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        borderRadius: 6,
        // The only transition in the design. This is a glanceable data view;
        // animation is a liability.
        transition: "filter .12s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.08)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = "brightness(1)"; }}
      onClick={(e) => { e.stopPropagation(); select(e.currentTarget); }}
    >
      {tier !== "none" && (
        <span
          style={{
            color: fg,
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontWeight: 700,
            fontSize: size,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
          }}
        >
          {item.ticker}
        </span>
      )}
      {(tier === "percent" || tier === "full") && (
        <span
          data-testid="tile-percent"
          style={{
            color: fg,
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: Math.max(11, size * 0.62),
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.2,
            marginTop: 2,
            whiteSpace: "nowrap",
          }}
        >
          {glyph}{Math.abs(raw).toFixed(2)}%
        </span>
      )}
      {tier === "full" && (
        <span
          data-testid="tile-sub"
          style={{
            color: fg2,
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: Math.max(11, size * 0.52),
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.2,
            marginTop: 3,
            whiteSpace: "nowrap",
          }}
        >
          {sub}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/components/TreemapTile.test.tsx`
Expected: PASS, 12 tests.

Note: `src/__tests__/components/Treemap.test.tsx` will now fail — the `Treemap` wrapper still passes the old props. That is fixed in Task 11; do not commit until then.

- [ ] **Step 5: Commit (after Task 11 is green)**

Deferred — `TreemapTile` and `Treemap` change together, so they commit together at the end of Task 11.

---

## Task 11: Treemap wrapper, domain wiring and arrow-key navigation

**Files:**
- Create: `src/lib/design/tile-nav.ts`
- Modify: `src/components/Treemap.tsx`
- Test: `src/__tests__/lib/design/tile-nav.test.ts`, `src/__tests__/components/Treemap.test.tsx`

- [ ] **Step 1: Write the failing navigation test**

```ts
import { nextTile, type NavRect } from "@/lib/design/tile-nav";

//  ┌──────┬──────┐
//  │  A   │  B   │
//  ├──────┼──────┤
//  │  C   │  D   │
//  └──────┴──────┘
const grid: NavRect[] = [
  { ticker: "A", x: 0, y: 0, w: 100, h: 100 },
  { ticker: "B", x: 100, y: 0, w: 100, h: 100 },
  { ticker: "C", x: 0, y: 100, w: 100, h: 100 },
  { ticker: "D", x: 100, y: 100, w: 100, h: 100 },
];

describe("nextTile", () => {
  it.each([
    ["A", "ArrowRight", "B"],
    ["B", "ArrowLeft", "A"],
    ["A", "ArrowDown", "C"],
    ["C", "ArrowUp", "A"],
    ["D", "ArrowLeft", "C"],
    ["B", "ArrowDown", "D"],
  ])("from %s, %s goes to %s", (from, key, expected) => {
    expect(nextTile(grid, from, key)).toBe(expected);
  });

  it("stays put at an edge rather than wrapping", () => {
    expect(nextTile(grid, "A", "ArrowLeft")).toBe("A");
    expect(nextTile(grid, "D", "ArrowDown")).toBe("D");
  });

  it("picks the nearest candidate when tiles are misaligned", () => {
    const ragged: NavRect[] = [
      { ticker: "BIG", x: 0, y: 0, w: 200, h: 100 },
      { ticker: "NEAR", x: 0, y: 100, w: 40, h: 60 },
      { ticker: "FAR", x: 150, y: 100, w: 50, h: 60 },
    ];
    expect(nextTile(ragged, "BIG", "ArrowDown")).toBe("NEAR");
  });

  it("ignores keys it does not handle", () => {
    expect(nextTile(grid, "A", "Tab")).toBeNull();
  });

  it("returns null when the current tile is unknown", () => {
    expect(nextTile(grid, "ZZZ", "ArrowRight")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/lib/design/tile-nav.test.ts`
Expected: FAIL — `Cannot find module '@/lib/design/tile-nav'`.

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/lib/design/tile-nav.test.ts`
Expected: PASS, 5 tests (the first is a 6-case table).

- [ ] **Step 5: Replace the `Treemap` wrapper in `src/components/Treemap.tsx`**

Replace everything below `TreemapTile` (the `sizeOf` helper, the old `getColor`, the `Props` interface and the `Treemap` function):

```tsx
import { useCallback, useRef } from "react";
import { ResponsiveTreeMapHtml } from "@nivo/treemap";
import { niceDomain } from "@/lib/design/ramp";
import { nextTile, type NavRect } from "@/lib/design/tile-nav";
import { usePreferences } from "@/lib/preferences-context";
import { useIsMobile } from "@/lib/use-is-mobile";
import type { SizingMode } from "@/types";

/**
 * Area for a tile. In P&L mode a floor of 0.4% of portfolio value keeps a
 * near-break-even position from vanishing entirely.
 */
function sizeOf(item: PortfolioItem, sizing: SizingMode, total: number): number {
  if (sizing !== "profit") return item.marketValue;
  return Math.max(Math.abs(item.totalPL), total * 0.004);
}

interface Props {
  items: PortfolioItem[];
  sizing: SizingMode;
  /** Clamp domain in percent. Derived by the caller so the legend agrees. */
  domain: number;
  onSelect: (item: PortfolioItem | null, rect: TileRect | null) => void;
}

export function Treemap({ items, sizing, domain, onSelect }: Props) {
  const { cvd } = usePreferences();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);

  const total = items.reduce((s, i) => s + i.marketValue, 0);

  const data = {
    id: "portfolio",
    children: [...items]
      .sort((a, b) => sizeOf(b, sizing, total) - sizeOf(a, sizing, total))
      .map((item) => ({ id: item.ticker, value: sizeOf(item, sizing, total), item })),
  };

  // Arrow keys move focus between tiles. Without this the primary data view is
  // unreachable without a mouse.
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const current = target.dataset?.ticker;
    if (!current || !containerRef.current) return;

    const tiles = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>("[data-ticker]"),
    );
    const rects: NavRect[] = tiles.map((el) => ({
      ticker: el.dataset.ticker as string,
      x: el.offsetLeft,
      y: el.offsetTop,
      w: el.offsetWidth,
      h: el.offsetHeight,
    }));

    const next = nextTile(rects, current, e.key);
    if (next === null) return;
    e.preventDefault();
    tiles.find((el) => el.dataset.ticker === next)?.focus();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full" onKeyDown={handleKeyDown}>
      <ResponsiveTreeMapHtml
        data={data}
        identity="id"
        value="value"
        tile="squarify"
        innerPadding={2}
        outerPadding={0}
        borderWidth={0}
        leavesOnly={true}
        label={() => ""}
        labelSkipSize={0}
        nodeComponent={({ node }) => {
          const item = (node.data as unknown as { item: PortfolioItem }).item;
          return (
            <TreemapTile
              item={item}
              changePercent={item.quote.changePercent}
              domain={domain}
              cvd={cvd}
              isMobile={isMobile}
              width={node.width}
              height={node.height}
              x={node.x}
              y={node.y}
              showPL={sizing === "profit"}
              onSelect={onSelect}
            />
          );
        }}
      />
    </div>
  );
}

/** Clamp domain for a set of items — exported so the legend and caption agree. */
export function domainFor(items: PortfolioItem[]): number {
  return niceDomain(items.map((i) => i.quote.changePercent));
}
```

Move the `PortfolioItem` import to the top of the file with the other type imports.

- [ ] **Step 6: Update `src/__tests__/components/Treemap.test.tsx`**

The existing suite renders `<Treemap items sizing onSelect />`. Add the required `domain` prop to every render call and wrap each in `<PreferencesProvider>`:

```tsx
import { PreferencesProvider } from "@/lib/preferences-context";

const renderTreemap = (props: Partial<React.ComponentProps<typeof Treemap>> = {}) =>
  render(
    <PreferencesProvider>
      <Treemap items={items} sizing="equity" domain={1} onSelect={jest.fn()} {...props} />
    </PreferencesProvider>,
  );
```

Add one new case:

```tsx
it("derives a domain that covers the largest absolute move", () => {
  expect(domainFor(items)).toBeGreaterThanOrEqual(
    Math.max(...items.map((i) => Math.abs(i.quote.changePercent))),
  );
});
```

- [ ] **Step 7: Run the full suite**

Run: `npm test && npm run lint`
Expected: PASS across `Treemap.test.tsx`, `TreemapTile.test.tsx` and `tile-nav.test.ts`; no lint errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/Treemap.tsx src/lib/design/tile-nav.ts \
  src/__tests__/components/Treemap.test.tsx \
  src/__tests__/components/TreemapTile.test.tsx \
  src/__tests__/lib/design/tile-nav.test.ts
git commit -m "feat(treemap): magnitude-encoding tiles with reachable keyboard nav

Tiles now colour from the data-derived domain through one luminance-
monotonic ramp, flip their ink for AA contrast, carry an arrow glyph so
sign never depends on colour, and label by size tier. Tiles are real
buttons with full aria-labels and arrow-key movement — the primary data
view was previously unusable without a mouse.

P&L sizing gains a 0.4%-of-portfolio floor so a near-break-even position
does not vanish."
```

---

## Task 12: Legend

**Files:**
- Create: `src/components/TreemapLegend.tsx`
- Test: `src/__tests__/components/TreemapLegend.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { TreemapLegend } from "@/components/TreemapLegend";

describe("TreemapLegend", () => {
  it("prints the domain at both ends so a quiet day is distinguishable", () => {
    render(<TreemapLegend domain={12} cvd={false} />);
    expect(screen.getByText("−12%")).toBeInTheDocument();
    expect(screen.getByText("+12%")).toBeInTheDocument();
  });

  it("renders a 21-stop gradient strip", () => {
    render(<TreemapLegend domain={1} cvd={false} />);
    expect(screen.getAllByTestId("legend-stop")).toHaveLength(21);
  });

  it("documents the flat / no-quote swatch", () => {
    render(<TreemapLegend domain={1} cvd={false} />);
    expect(screen.getByText("flat / no quote")).toBeInTheDocument();
  });

  it("states that lightness carries magnitude", () => {
    render(<TreemapLegend domain={1} cvd={false} />);
    expect(screen.getByText(/greyscale/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/components/TreemapLegend.test.tsx`
Expected: FAIL — `Cannot find module '@/components/TreemapLegend'`.

- [ ] **Step 3: Write the implementation**

```tsx
"use client";
import { rampColor, rgbString, RAMP_NORMAL, RAMP_CVD } from "@/lib/design/ramp";

interface Props {
  domain: number;
  cvd: boolean;
}

export function TreemapLegend({ domain, cvd }: Props) {
  const stops = cvd ? RAMP_CVD : RAMP_NORMAL;
  const swatches = Array.from({ length: 21 }, (_, i) =>
    rgbString(rampColor(-1 + i / 10, stops)),
  );

  return (
    <div className="mt-4 pt-3.5 border-t border-rd-border flex items-center gap-3 flex-wrap">
      <span className="font-mono text-[10px] text-rd-dim tabular-nums">
        −{domain}%
      </span>
      <div className="flex h-3 w-[300px] max-w-full overflow-hidden rounded-[2px]">
        {swatches.map((c, i) => (
          <div key={i} data-testid="legend-stop" className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <span className="font-mono text-[10px] text-rd-dim tabular-nums">
        +{domain}%
      </span>

      <span className="ml-2 flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[2px]" style={{ background: "var(--rd-flat-tile)" }} />
        <span className="font-mono text-[10px] text-rd-dim">flat / no quote</span>
      </span>

      <span className="font-mono text-[10px] text-rd-faint">
        Lightness carries magnitude, so the map still reads in greyscale.
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/components/TreemapLegend.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/TreemapLegend.tsx src/__tests__/components/TreemapLegend.test.tsx
git commit -m "feat(treemap): legend printing the derived domain

Without a stated domain there is no way to tell a strong day from a flat
one — the same swatch means +0.4% on Monday and +40% in an all-time view."
```

---

## Task 13: Tooltip that stays inside the card

**Files:**
- Create: `src/lib/design/tooltip-position.ts`
- Modify: `src/components/TreemapTooltip.tsx`
- Test: `src/__tests__/lib/design/tooltip-position.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { tooltipPosition } from "@/lib/design/tooltip-position";

const card = { top: 0, left: 0, width: 1000, height: 500 };

describe("tooltipPosition", () => {
  it("anchors below a tile in the top 45% of the card", () => {
    const p = tooltipPosition({ top: 40, left: 400, width: 100, height: 80 }, card);
    expect(p.placement).toBe("below");
  });

  it("anchors above a tile lower down, so it does not fall off the bottom", () => {
    const p = tooltipPosition({ top: 400, left: 400, width: 100, height: 80 }, card);
    expect(p.placement).toBe("above");
  });

  it("clamps the horizontal centre to 9-91% so it never clips at an edge", () => {
    const left = tooltipPosition({ top: 40, left: 0, width: 40, height: 40 }, card);
    expect(left.centerPct).toBeGreaterThanOrEqual(9);

    const right = tooltipPosition({ top: 40, left: 980, width: 20, height: 40 }, card);
    expect(right.centerPct).toBeLessThanOrEqual(91);
  });

  it("centres on the tile when there is room on both sides", () => {
    const p = tooltipPosition({ top: 40, left: 450, width: 100, height: 80 }, card);
    expect(p.centerPct).toBeCloseTo(50, 1);
  });

  it("handles a zero-height card without dividing by zero", () => {
    const p = tooltipPosition({ top: 0, left: 0, width: 10, height: 10 }, { ...card, height: 0 });
    expect(Number.isFinite(p.centerPct)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/lib/design/tooltip-position.test.ts`
Expected: FAIL — `Cannot find module '@/lib/design/tooltip-position'`.

- [ ] **Step 3: Write the implementation**

```ts
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

  const anchorPct = below
    ? ((tile.top - card.top + tile.height) / h) * 100
    : tileTopPct;

  return { placement: below ? "below" : "above", centerPct, anchorPct };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/lib/design/tooltip-position.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Rewrite `src/components/TreemapTooltip.tsx`**

Two changes. First the body, which currently omits weight and shows inconsistent precision. Second — and this is the part that makes `tooltipPosition` load-bearing — the desktop branch stops delegating to `DetailPanel`.

`DetailPanel` positions `fixed` and clamps to the **viewport**. The spec wants placement relative to the **card**: below when the tile sits in the top 45%, above otherwise, horizontal centre clamped to 9–91%. Those are different rules, and viewport clamping is what lets the panel drift away from the tile it describes. So the desktop tooltip renders absolutely *inside* the map body. `DetailPanel` is left untouched — it still has three consumers reaching it through `use-detail-selection` (`AnalystSentimentCard`, `ValuationCard`, `EquityAllocationChart`), which migrate in later plans. Its exported `TileRect` is structurally identical to `Rect`, so the two coexist without a cast.

The mobile branch still uses `Sheet` — there is no hover on mobile, and a bottom sheet is the right affordance for a tap.

```tsx
"use client";
import { useIsMobile } from "@/lib/use-is-mobile";
import { Sheet } from "@/components/ui/Sheet";
import { tooltipPosition, type Rect } from "@/lib/design/tooltip-position";
import { money, signedMoney, signedPct } from "@/lib/design/format";
import type { PortfolioItem } from "@/types";

export type TileRect = Rect;

interface Props {
  item: PortfolioItem | null;
  tileRect: TileRect | null;
  /** Bounding box of the map body, in the same coordinate space as tileRect. */
  cardRect: TileRect | null;
  weightPct: number;
  onClose?: () => void;
}

export function TreemapTooltip({ item, tileRect, cardRect, weightPct, onClose }: Props) {
  const isMobile = useIsMobile();
  if (!item) return null;

  const body = <TileBody item={item} weightPct={weightPct} />;

  if (isMobile) {
    return (
      <Sheet open onClose={onClose ?? (() => {})}>
        <div className="p-5">{body}</div>
      </Sheet>
    );
  }

  if (!tileRect || !cardRect) return null;
  const { placement, centerPct, anchorPct } = tooltipPosition(tileRect, cardRect);

  return (
    <div
      data-testid="treemap-tooltip"
      data-placement={placement}
      className="absolute z-40 w-[250px] rounded-[11px] p-3.5 pointer-events-none"
      style={{
        left: `${centerPct}%`,
        top: `${anchorPct}%`,
        transform: `translate(-50%, ${placement === "below" ? "8px" : "calc(-100% - 8px)"})`,
        background: "#141a21",
        border: "1px solid var(--rd-border-stronger)",
        boxShadow: "0 14px 34px #00000099",
      }}
    >
      {body}
    </div>
  );
}
```

Then the body itself:

```tsx
import { money, signedMoney, signedPct } from "@/lib/design/format";

function TileBody({ item, weightPct }: { item: PortfolioItem; weightPct: number }) {
  const dayDollar = item.quote.change * item.shares;
  const plClass = (v: number) => (v >= 0 ? "text-rd-gain" : "text-rd-loss");

  return (
    <>
      <div className="text-sm font-bold text-rd-text">{item.companyName}</div>
      <div className="font-mono text-[11px] text-rd-label mt-0.5 mb-3">
        {item.ticker} · {item.sector}
      </div>
      <div className="grid grid-cols-2 gap-y-1.5 text-xs tabular-nums">
        <span className="text-rd-label">Market value</span>
        <span className="text-right font-mono text-rd-text">{money(item.marketValue)}</span>

        <span className="text-rd-label">Today</span>
        <span className={`text-right font-mono ${plClass(dayDollar)}`}>
          {signedMoney(dayDollar)} ({signedPct(item.quote.changePercent)})
        </span>

        <span className="text-rd-label">Total P&L</span>
        <span className={`text-right font-mono ${plClass(item.totalPL)}`}>
          {signedMoney(item.totalPL)} ({signedPct(item.totalPLPercent)})
        </span>

        <span className="text-rd-label">Shares</span>
        <span className="text-right font-mono text-rd-body">
          {item.shares} @ {money(item.avgCost)}
        </span>

        <span className="text-rd-label">Weight</span>
        <span className="text-right font-mono text-rd-body">{weightPct.toFixed(2)}%</span>
      </div>
    </>
  );
}
```

- [ ] **Step 6: Update `src/__tests__/components/TreemapTooltip.test.tsx`**

Every render now needs `cardRect` and `weightPct`. Add a helper and three cases:

```tsx
const cardRect = { top: 0, left: 0, width: 1000, height: 500 };

const renderTooltip = (tileRect: TileRect | null) =>
  render(
    <TreemapTooltip
      item={item}
      tileRect={tileRect}
      cardRect={cardRect}
      weightPct={8.66}
    />,
  );

it("shows market value and weight, which the old tooltip omitted", () => {
  renderTooltip({ top: 40, left: 400, width: 100, height: 80 });
  expect(screen.getByText("$13,500.00")).toBeInTheDocument();
  expect(screen.getByText("8.66%")).toBeInTheDocument();
});

it("anchors below a tile near the top of the card", () => {
  renderTooltip({ top: 40, left: 400, width: 100, height: 80 });
  expect(screen.getByTestId("treemap-tooltip")).toHaveAttribute("data-placement", "below");
});

// The shipped tooltip clips at the container edge, hiding the numbers the
// user hovered to read.
it("flips above and clamps horizontally for a bottom-corner tile", () => {
  renderTooltip({ top: 430, left: 960, width: 40, height: 60 });
  const tip = screen.getByTestId("treemap-tooltip");
  expect(tip).toHaveAttribute("data-placement", "above");
  expect(parseFloat(tip.style.left)).toBeLessThanOrEqual(91);
});
```

- [ ] **Step 7: Run the suite**

Run: `npm test -- src/__tests__/components/TreemapTooltip.test.tsx src/__tests__/lib/design/tooltip-position.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/design/tooltip-position.ts src/components/TreemapTooltip.tsx \
  src/__tests__/lib/design/tooltip-position.test.ts \
  src/__tests__/components/TreemapTooltip.test.tsx
git commit -m "feat(treemap): tooltip carries the numbers users hover for

Adds market value and weight, applies the one number format throughout,
and computes a placement that flips above/below and clamps horizontally
so the panel stays inside the card instead of clipping at its edge."
```

---

## Task 14: Heat map card

**Files:**
- Create: `src/components/HeatMapCard.tsx`
- Test: `src/__tests__/components/HeatMapCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedGroup } from "@/components/HeatMapCard";

describe("SegmentedGroup", () => {
  const opts = [
    { value: "equity", label: "Equity" },
    { value: "profit", label: "P&L" },
  ];

  it("labels the group so it does not merge with its neighbour", () => {
    render(<SegmentedGroup label="Size" options={opts} value="equity" onChange={jest.fn()} />);
    expect(screen.getByText("SIZE")).toBeInTheDocument();
  });

  // Undifferentiated, the two groups read as one nine-segment control.
  it("associates the label with the group for screen readers", () => {
    render(<SegmentedGroup label="Size" options={opts} value="equity" onChange={jest.fn()} />);
    expect(screen.getByRole("group", { name: "Size" })).toBeInTheDocument();
  });

  it("marks the active option with aria-pressed, not just a fill", () => {
    render(<SegmentedGroup label="Size" options={opts} value="equity" onChange={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Equity" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "P&L" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the selected value", async () => {
    const onChange = jest.fn();
    render(<SegmentedGroup label="Size" options={opts} value="equity" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "P&L" }));
    expect(onChange).toHaveBeenCalledWith("profit");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/components/HeatMapCard.test.tsx`
Expected: FAIL — `Cannot find module '@/components/HeatMapCard'`.

- [ ] **Step 3: Write the implementation**

```tsx
"use client";
import { useRef } from "react";
import { Treemap, domainFor } from "@/components/Treemap";
import { TreemapLegend } from "@/components/TreemapLegend";
import { TreemapTooltip, type TileRect } from "@/components/TreemapTooltip";
import { usePreferences } from "@/lib/preferences-context";
import type { PortfolioItem, SizingMode, TimeRange } from "@/types";

interface SegmentedProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function SegmentedGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-rd-dim">
        {label}
      </span>
      <div
        role="group"
        aria-label={label}
        className="inline-flex gap-[3px] p-[3px] rounded-lg bg-rd-control border border-rd-border-control"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={`rd-focusable rounded-md px-3 py-1.5 text-xs font-semibold transition-none ${
                active ? "bg-rd-text text-rd-chrome" : "bg-transparent text-[#8b97a4]"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SIZE_OPTIONS: { value: SizingMode; label: string }[] = [
  { value: "equity", label: "Equity" },
  { value: "profit", label: "P&L" },
];

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = (
  ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"] as TimeRange[]
).map((r) => ({ value: r, label: r }));

interface Props {
  items: PortfolioItem[];
  sizing: SizingMode;
  range: TimeRange;
  onSizingChange: (m: SizingMode) => void;
  onRangeChange: (r: TimeRange) => void;
  onSelect: (item: PortfolioItem | null, rect: TileRect | null) => void;
  /** Currently selected tile, rendered as a tooltip inside the map body. */
  selected: PortfolioItem | null;
  selectedRect: TileRect | null;
  onDismiss: () => void;
  children?: React.ReactNode;
}

export function HeatMapCard({
  items,
  sizing,
  range,
  onSizingChange,
  onRangeChange,
  onSelect,
  selected,
  selectedRect,
  onDismiss,
  children,
}: Props) {
  const { cvd } = usePreferences();
  const domain = domainFor(items);
  const bodyRef = useRef<HTMLDivElement>(null);

  // The tooltip is positioned in the map body's coordinate space, so the card
  // owns the measurement. Read at render time rather than stored in state:
  // it is only needed while a tile is selected, and caching it would go stale
  // on resize.
  const bodyRect = selected ? bodyRef.current?.getBoundingClientRect() ?? null : null;

  const total = items.reduce((s, i) => s + i.marketValue, 0);
  const weightPct = selected && total > 0 ? (selected.marketValue / total) * 100 : 0;

  return (
    <section className="rounded-[14px] bg-rd-card border border-rd-border px-5 pt-[18px] pb-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-bold text-rd-text">Heat map</h2>
          <p className="font-mono text-[11px] text-rd-dim mt-1">
            Tile size by {sizing === "equity" ? "market value" : "absolute P&L"} · colour
            by {range} change, clamped ±{domain}%
          </p>
        </div>
        <div className="flex items-center gap-[18px] flex-wrap">
          <SegmentedGroup label="Size" options={SIZE_OPTIONS} value={sizing} onChange={onSizingChange} />
          <SegmentedGroup label="Colour" options={RANGE_OPTIONS} value={range} onChange={onRangeChange} />
        </div>
      </div>

      {children}

      <div ref={bodyRef} className="h-[456px] relative">
        <Treemap items={items} sizing={sizing} domain={domain} onSelect={onSelect} />
        <TreemapTooltip
          item={selected}
          tileRect={selectedRect}
          cardRect={bodyRect}
          weightPct={weightPct}
          onClose={onDismiss}
        />
      </div>

      <TreemapLegend domain={domain} cvd={cvd} />
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/components/HeatMapCard.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/HeatMapCard.tsx src/__tests__/components/HeatMapCard.test.tsx
git commit -m "feat(treemap): heat map card with labelled control groups

SIZE and COLOUR are labelled and each is a real aria-labelled group with
aria-pressed options. Undifferentiated they read as one nine-segment
control, and active state currently carries no non-visual signal.

The caption keeps the original app's size/colour explanation and extends
it with the derived clamp domain."
```

---

## Task 15: Wire the dashboard and verify

**Files:**
- Modify: `src/app/page.tsx`
- Delete: `src/components/SizingToggle.tsx`, `src/components/TimeRangeToggle.tsx`

- [ ] **Step 1: Replace the heat map block in `src/app/page.tsx`**

Swap the `bento-card` wrapper (lines 276–308 of the current file) for `HeatMapCard`, keeping the failed-ticker chip and empty state as children:

```tsx
{status === "empty" ? (
  <div className="bento-card p-5 mb-4">
    <EmptyPortfolio onImportClick={openImport} onAddClick={openAddHolding} />
  </div>
) : (
  <div className="mb-4">
    <HeatMapCard
      items={items}
      sizing={sizing}
      range={range}
      onSizingChange={setSizing}
      onRangeChange={setRange}
      onSelect={handleSelect}
      selected={selectedItem}
      selectedRect={tileRect}
      onDismiss={dismissSelection}
    >
      <FailedTickersChip tickers={failedTickers} onRetry={fetchPortfolio} />
    </HeatMapCard>
  </div>
)}
```

Remove the `SizingToggle`, `TimeRangeToggle` and `TreemapTooltip` imports — the tooltip now renders inside `HeatMapCard`, which owns the coordinate space it is positioned in. Add `HeatMapCard`.

- [ ] **Step 2: Delete the absorbed toggle components**

```bash
git rm src/components/SizingToggle.tsx src/components/TimeRangeToggle.tsx
```

- [ ] **Step 3: Verify the full suite and build**

Run: `npm run lint && npm run build && npm test`
Expected: no lint errors, build succeeds, all tests pass.

- [ ] **Step 4: Verify in the browser**

Start the dev server and open `/demo`. Confirm, using `read_page` and a screenshot:

1. Tiles show ticker + `▲`/`▼` + percent + market value at large sizes, degrading cleanly at small ones.
2. Light gain tiles have dark ink; dark loss tiles have white ink.
3. The caption reads `… clamped ±N%` and the legend prints the same `N` at both ends.
4. Switching COLOUR from `1D` to `ALL` changes the domain in both caption and legend.
5. Switching SIZE to `P&L` re-lays the map and flips tile sub-labels to signed P&L.
6. Tabbing into the map focuses a tile with a visible green ring; arrow keys move between tiles.
7. Hovering a tile in the top-left corner shows a tooltip fully inside the card.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(dashboard): mount the redesigned heat map

Replaces the bento heat map block with HeatMapCard and retires the two
standalone toggles it absorbed."
```

---

## Done when

- `npm test` passes, including the new `src/__tests__/lib/design/` suites.
- The `/demo` heat map colours from a printed, data-derived domain through one luminance-monotonic ramp.
- Every tile label clears 4.5:1 against its own background.
- The map is fully navigable by keyboard with a visible focus ring.
- The legacy oklch palette is still intact and the other screens still render — only the heat map has migrated.

## Next

Redesign plan 2: Dashboard — hero consolidation, "What moved the number", allocation strip, and the loading/empty/failed states.
