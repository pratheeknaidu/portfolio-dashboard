# Design: Portfolio Dashboard Redesign

**Date:** 2026-07-26
**Source:** Claude Design handoff bundle (`design_handoff_portfolio_dashboard`) — a
scored UI review of the shipped app (4.9/10) plus a high-fidelity prototype addressing
its nine findings.

## Goal

Recreate the handoff's three-screen design in this codebase using its existing stack
(Next.js 14 App Router, Tailwind, Nivo, Recharts). The prototype is a reference, not
code to port: what transfers is the *rules* — the colour ramp, the luminance foreground
flip, the number formatter, the tile label thresholds.

The single highest-impact change is the treemap colour scale. The shipped version uses
two unrelated ramps, neither of which encodes magnitude, which makes the core view a
decorative mosaic rather than an instrument.

## Scope decisions

Three decisions were settled before design, and they narrow the handoff:

1. **All three screens**, both viewports, four data states, three modals.
2. **`VixPill`, `ValuationCard` and `AnalystSentimentCard` survive**, restyled to the new
   tokens. The handoff never saw them. VIX stays in the top bar; the two valuation cards
   become a fourth block on Analytics, below the three the spec defines. This costs the
   spec's "Analytics is exactly three blocks" purity and is accepted.
3. **Failed tickers get reasons + Retry/Remove, but not "Set final price."** A manual
   price override needs a new persisted field on `Holding` and raises a trust question
   the design does not answer (how do you mark a number as hand-entered everywhere it
   appears?). It is a delisted-stock feature, not a design fix, and is out of scope.

## Non-goals

- Porting the prototype's markup or its hand-rolled `squarify`.
- Chart entry animations. The only transition in the design is `filter .12s` on tile
  hover. This is a glanceable data view; animation is a liability.
- Backfilling snapshot history. See *Known gaps*.

---

## 1. Foundation layer

A new `src/lib/design/` directory. Every module is pure, imports no React, and is
unit-tested before any UI consumes it. This is the handoff's own build-order item #1 and
carries most of the design value at zero render risk.

### `ramp.ts`

```ts
type Rgb = readonly [number, number, number];
type Stop = readonly [number, Rgb];

export const RAMP_NORMAL: Stop[]   // dark red → neutral grey → light green
export const RAMP_CVD: Stop[]      // dark orange → neutral grey → light blue

export function rampColor(t: number, stops: Stop[]): Rgb
export function niceDomain(values: number[]): number
```

Both ramps are **luminance-monotonic**: lightness rises continuously from largest loss
to largest gain, so magnitude survives greyscale and every form of colour vision
deficiency. Flat is an explicit neutral grey `[92, 98, 106]`, never a pale green.

`rampColor` linearly interpolates between stops on `t = change / domain`, clamped to
`[-1, 1]`.

`niceDomain` picks the first value in `[0.5, 1, 2, 3, 5, 8, 12, 20, 30, 50, 80, 120, 200]`
that is `>= max(|change|)`, falling back to `200`. It **filters non-finite values first** —
a single bad quote otherwise poisons `Math.max` and collapses the whole map to neutral.
The domain is always derived from the data, never hardcoded, and is always printed in
both the legend and the caption.

### `luminance.ts`

```ts
export function relativeLuminance(c: Rgb): number   // WCAG formula
export function foregroundFor(c: Rgb): { fg: string; fg2: string }
```

`fg` is `#06120c` when luminance > 0.30, else `#ffffff`; `fg2` appends `c4` (~0.77 alpha)
for secondary lines. Fixed white on the current loss tile is 2.9:1 and fails AA at every
size. With the flip, every tile clears 4.5:1.

### `format.ts`

```ts
export function money(v: number, dp = 2): string          // $155,876.26 / −$60.97
export function signedMoney(v: number, dp = 2): string    // +$80.92 / −$60.97
export function signedPct(v: number): string              // +0.06% / −1.24%
export function axisMoney(v: number): string              // $165k — the ONLY abbreviation
```

The minus sign is **U+2212**, never a hyphen: it shares an advance width with digits in
tabular figures, so negative numbers stay column-aligned. Every numeric cell in the app
gets `font-variant-numeric: tabular-nums`.

### `sectors.ts`

The 10-sector palette plus `Other`, replacing `chart-palette.ts`. It deliberately
contains **no green and no red** so sector identity can never be confused with P&L
direction.

### `tiles.ts`

```ts
export type LabelTier = "none" | "ticker" | "percent" | "full";
export function labelTier(w: number, h: number, isMobile: boolean): LabelTier
export function tileFontSize(w: number, h: number): number
```

Thresholds: ticker needs ≥ 34×24px desktop / 30×22px mobile; percent ≥ 62×44px; sub
≥ 92×78px. Font size is `clamp(11, min(w / 4.6, h / 4.2), 22)` — never below 11px. Below
the ticker threshold a tile renders unlabelled; on mobile it is excluded from the map
entirely and rolled into the aggregate strip.

---

## 2. Token swap

`globals.css` loses the oklch palette, the body radial gradients, `.bento-card`,
`.brand-mark` and `.app-divider`, and gains the handoff's flat tokens as CSS variables.

This is destructive rather than additive by necessity. The current theme's depth cues are
subtractive against an `oklch(0.18)` page — `backdrop-filter` blurs and inset highlights
only read because there is luminance headroom above the background. At `#07090b` there is
none, so a half-migrated card does not look "slightly off," it looks like a rendering bug.
**Each screen's token migration therefore lands as one commit, not incrementally.**

Surfaces `#07090b` page / `#0b0e12` chrome / `#0f1318` card / `#12161c` control.
Borders `#151b21` hairline / `#1c222a` default / `#1e242c` control.
Text ramp `#e9edf1` → `#3a434e` across seven steps.

Semantic colours: gain `#4ade9b` (CVD `#5eb2e0`), loss `#e2707f` (CVD `#e0913e`), warning
`#d9a441`, error `#e0913e` — deliberately a different hue from loss, so a data problem
never reads as a big loss.

**Rule: gain and loss colours appear only on P&L values.** Chrome, CTAs, active states,
logo and links are neutral. Today green is simultaneously the brand, the gain colour, the
CTA fill, every active pill, the sparkline and a sector wedge — so it carries no signal.

Shadows exist in exactly two places: modal `0 24px 60px #000000aa` and tooltip
`0 14px 34px #00000099`. Nothing else casts one.

**Fonts:** `Instrument Sans` replaces Space Grotesk + DM Sans. JetBrains Mono stays; add
weight `700`. The pairing rule — proportional sans for prose, tabular mono for every
number — is what matters.

---

## 3. Structure

### Routes

`/` · `/holdings` (new) · `/analytics`, each mirrored under `/demo` via the existing
`DemoProvider` re-export pattern.

### Shared data hook

`src/app/page.tsx` and `src/app/analytics/page.tsx` already duplicate the entire
fetch → merge → derive block. A third screen makes that three copies, so
`usePortfolioData()` is extracted to `src/lib/use-portfolio-data.ts` first: positions,
quotes, snapshots, failed tickers, the demo branch, and the market-hours poll.

Derived values are **never stored** — total value, day change, cost basis, total P&L,
sector aggregates, movers ranking and the clamp domain are all pure functions of
positions + quotes.

### Preferences

`usePreferences()` context backed by `localStorage`, holding the colourblind ramp
preference. Not Firestore: it is a device-level display preference and should not cost a
round trip on first paint. It flips the ramp *and* the gain/loss text tokens globally.

### Component churn

**Rewritten:** `Treemap`, `TreemapTooltip`, `HoldingsTable`, `MoversCard`,
`AllocationCard`, `PerformanceChart`, `EmptyPortfolio`, `FailedTickersChip`, `Navbar`.

**New:** `AppShell`, `StatusPill`, `SummaryCard`, `Sparkline`, `HeatMapCard`,
`TreemapLegend`, `AllocationStrip`, `MobileHoldingsList`, `SectorPLCard`, `PositionSheet`,
plus skeleton variants.

**Deleted:** `MobileMenu` (the spec kills the hamburger), `MetricCard`, `SectorChart`,
`EquityAllocationChart`, `PortfolioHeroCard`, `chart-palette.ts`.

**Absorbed:** `SizingToggle` and `TimeRangeToggle` merge into `HeatMapCard` as the two
*labelled* segmented groups, SIZE and COLOUR. Labelling them matters: undifferentiated,
they read as one nine-segment control.

`@nivo/treemap` is kept for layout; only the tile renderer is swapped. The handoff
explicitly says to reuse the codebase's existing treemap rather than port its squarify.

### Where edit and delete live

The handoff specifies three modals — import, add, detail — and says nothing about
editing, because the reviewed screenshots did not show it. But Analytics loses its
holdings table, and that table is where `EditHoldingModal` and the delete `ConfirmDialog`
are currently reached from. Dropping the design in as-written would strand both.

`PositionSheet` therefore becomes the single entry point for a position: it is what a
tile tap, a mover row and a table row all open, it carries the tooltip's numbers, and it
gains **Edit** and **Remove** actions in a footer. `EditHoldingModal` and `ConfirmDialog`
are kept and restyled; `ChipDetail` is replaced by `PositionSheet`, and the `Sheet` and
`DetailPanel` primitives in `src/components/ui/` are retained as its mobile and desktop
containers.

This also resolves a gap the design does have: on mobile there is otherwise no path to
edit or remove a holding at all.

### Screens

**Dashboard.** Hero row (`1.55fr 1fr`): a single summary card — portfolio value at 40px,
today's change at 27px as the **second-largest element on the page** — beside a "What
moved the number" card ranking positions by *dollar* contribution, not percent. Then the
heat map card, the allocation strip, and the holdings table capped at 10 rows.

**Holdings.** The table alone, all rows. This is the accessible, precise, sortable view
and the documented equivalent of the heat map for keyboard and screen-reader users. Ten
sortable columns on one shared grid template; company names ellipsis-truncated.

**Analytics.** Performance (zoomed y-axis, stated range), Allocation (direct-labelled
rows, no donut, no legend), P&L by sector (the one fact neither the map nor the table
shows) — then the retained valuation block. **No heat map, no hero, no holdings table**;
that separation is the fix for the review's duplication finding.

### Mobile (375px)

No hamburger. A full-width three-tab segmented control under the top bar. `MobileMenu` is
deleted, but the two things it currently carries must survive its removal: **Sign out**
(authenticated) and **Sign in** (demo mode) move into the top bar as a real control at
≥44px, not the ~20px stranded text link the review flagged. The heat map
shows the **top 10 positions only**, with the remainder as a tappable aggregate strip
below it that routes to Holdings — never as a tile inside the map, whose area would
exceed every real position and misrepresent the largest thing the user owns.

`MobileHoldingsList` is nav-aware: 6 rows with a "Show all" CTA on Dashboard, all rows
plus a total row and a scrolling sort control on Holdings. If the slice is not nav-aware,
the map's "+N smaller positions" strip routes to a screen that does not contain them.

Every interactive target is ≥44px in its smallest dimension, and nothing depends on hover.

---

## 4. Quote failure reasons

`src/lib/yahoo-finance.ts:134` currently derives failures after the fact —
`tickers.filter(t => !quotes[t])` — which is precisely why no reason survives.

The reason is captured at the `catch` site instead, and the type widens:

```ts
export type FailureReason = "unlisted" | "timeout" | "no_price";
export interface QuoteFailure { ticker: string; reason: FailureReason }
// QuotesResult.failed: QuoteFailure[]
```

This is a breaking change to `/api/quotes`. Both page callers and
`src/__tests__/api/quotes.test.ts` move with it.

The strip renders as a **slim inline amber bar above a working map** — never a page
takeover. It states the count, that the map still covers the rest, and the excluded
dollar value, then one chip per bad ticker carrying its reason and Retry / Remove.

---

## States

| State | Treatment |
|---|---|
| **Loading** | Skeleton tiles laid out with the **real treemap geometry** so nothing reflows on arrival. Never render `$0.00` or the empty state as a placeholder — a slow connection currently flashes a zeroed portfolio, which is the most trust-destroying frame a money app can show |
| **Empty** | Dashed border, headline, two **real** buttons (the current secondary is unstyled grey text with no affordance), and a ghost heat map at 0.55 opacity so the user sees what they are about to get |
| **Failed tickers** | Amber inline strip above a working map, per-ticker reason and actions |
| **Market closed** | Amber dot + "Closed · as of 4:00 PM ET" in **status styling, not button styling**. The current pill is shaped exactly like the Add and Sign in buttons beside it, so it reads as a control that does nothing |

---

## Accessibility

The reviewed app scores 3/10 here and most of the fix is mechanical.

- The luminance flip fixes tile contrast; everything must clear 4.5:1.
- **Never colour alone.** Every tile prints ▲/▼/◆ with its signed percentage. Sort state
  carries an arrow. Segmented pills get `aria-pressed`.
- Every interactive element gets a visible focus ring — 2px `#4ade9b` with a dark offset.
  There is currently no visible focus anywhere in the product.
- **The treemap must be reachable.** Tiles are `<button>`s with
  `aria-label="AAPL, Apple Inc., $13,500.00, up 0.65% today"` and arrow-key navigation,
  with the Holdings table documented as the equivalent tabular view.

---

## Testing

**Unit** (`src/__tests__/lib/design/`): ramp interpolation and endpoint clamping,
luminance-monotonicity across each ramp, `niceDomain` selection including the `NaN`
guard, foreground flip thresholds, all four formatters including U+2212, label-tier
thresholds at their exact boundaries, and failure classification.

**Component:** existing suites updated for the new markup; new suites for `SummaryCard`,
`TreemapLegend`, `MobileHoldingsList` nav-awareness, and the tooltip flip logic.

**End-to-end:** Playwright against `/demo`, which renders every screen from the static
fixture with no auth and no network.

---

## Known gaps

**Snapshot history.** `/api/snapshot` only accumulates from the day a user first loads
the dashboard, so a new account has one data point and the Analytics "since {date}" delta
is meaningless. The prototype assumes 120 sessions and never shows this case. Under five
snapshots the performance card renders an honest empty state rather than drawing a
two-point line.

**`SizingMode` naming.** The spec says `'equity' | 'pl'`; `src/types/index.ts:32` says
`"equity" | "profit"`. The existing type is kept and only the pill label changes to
"P&L" — renaming would churn tests for no behavioural gain.

---

## Build order

Ranked by impact ÷ risk, with the two prerequisites hoisted:

1. Foundation lib + tests — pure, no UI dependency, fixes magnitude encoding, contrast
   and credibility at once
2. `usePortfolioData()` extraction
3. Token swap + fonts + `AppShell` / nav
4. Heat map — treemap, legend, tooltip, controls
5. Dashboard — hero, movers, allocation strip, states
6. Holdings screen + table rewrite + mobile list
7. Analytics rewrite + `SectorPLCard` + retained valuation block
8. Modals — import, add, position detail
9. Mobile pass across all three screens
10. Accessibility sweep + quote failure reasons
