# Redesign Plan 2: Dashboard Screen

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the dashboard on the plan 1 foundation — a real app shell with working mobile navigation, a summary card whose hierarchy matches the design, movers ranked by dollar contribution rather than percent, a direct-labelled allocation strip, and the four data states the spec defines.

**Architecture:** Four pure modules land first (`portfolio-totals`, `movers`, `allocation`, `quote-failures`) so every derived number is unit-tested before a component renders it. Chrome (`AppShell`, `TopBar`, `StatusPill`) comes next, then the four cards, then the states. The dashboard's migration to `--rd-*` tokens lands as **one commit** (spec §2): the old theme's depth cues are subtractive against `oklch(0.18)` and read as rendering bugs at `#07090b`, so a half-migrated screen looks broken rather than unfinished.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, `@nivo/treemap`, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-26-design-handoff-redesign-design.md`
**Predecessor:** `docs/superpowers/plans/2026-07-26-redesign-01-foundation-heatmap.md` (complete)

---

## Inherited context you must not re-litigate

| Decision | Where it came from |
|---|---|
| Tokens are **additive** — `--rd-*` coexists with the legacy oklch palette; legacy is deleted in plan 4 | Plan 1, settled |
| `SizingMode` stays `"equity" \| "profit"`; only the UI label says "P&L" | Spec, *Known gaps* |
| `VixPill` survives, restyled, and stays in the top bar | Spec, *Scope decisions* #2 |
| Failed tickers get reasons + Retry/Remove, but **not** "Set final price" | Spec, *Scope decisions* #3 |
| Dark ink is `#000000` flipping at luminance `0.1833`; `RAMP_CVD` loss stops are the corrected values | Plan 1, approved deviation |

**Deferred to plan 3, deliberately — do not build here:**
- The `/holdings` route and `MobileHoldingsList`. `TopBar` renders its tabs from a config array; plan 3 appends the Holdings entry. Building a stub screen now would ship a half-empty route.
- The mobile "top 10 + aggregate strip" heat map behaviour. The strip routes to Holdings, which does not exist yet.
- **The dashboard's 10-row holdings table** (spec, *Screens*). It is the rewritten table capped at 10, and the rewrite is plan 3's first task. Adding the current `HoldingsTable` here would mean styling it to the new tokens and then discarding that work.
- **`PositionSheet`**, and with it the Edit/Remove entry point (spec, *Where edit and delete live*). It is opened from a tile, a mover row *and* a table row; two of those three do not exist until plan 3, so building it now would leave it half-wired.

Nothing above is dropped — each is listed in plan 3's inbox at the bottom of this file.

**User standing rules:** never add `Co-Authored-By` or any AI mention to commits or PRs; branch before the first commit on new work; default to opening a PR when work is ready; no "for recruiters" framing anywhere in the repo.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `src/lib/design/portfolio-totals.ts` | Total value, cost basis, P&L, day change — all derived, never stored |
| `src/lib/design/movers.ts` | Rank positions by **dollar** contribution to today's move |
| `src/lib/design/allocation.ts` | Sector aggregation with an `Other` roll-up |
| `src/lib/quote-failures.ts` | `FailureReason` classification, shared by server and client |
| `src/components/AppShell.tsx` | Page frame: top bar, mobile tabs, main width cap |
| `src/components/TopBar.tsx` | Brand, desktop tabs, VIX, status, auth control |
| `src/components/MobileTabs.tsx` | Full-width segmented route control, no hamburger |
| `src/components/StatusPill.tsx` | Market open/closed in **status** styling, not button styling |
| `src/components/Sparkline.tsx` | Inline SVG trend line, honest empty state under 5 points |
| `src/components/SummaryCard.tsx` | Portfolio value + today's change, the page's two largest elements |
| `src/components/AllocationStrip.tsx` | Direct-labelled sector bar, no donut, no legend |
| `src/components/FailedTickersStrip.tsx` | Amber inline bar with per-ticker reason and actions |
| `src/components/DashboardSkeleton.tsx` | Loading state at the real geometry |

**Modify:** `src/components/MoversCard.tsx` (rewrite), `src/components/EmptyPortfolio.tsx` (rewrite), `src/lib/use-portfolio-data.ts` (snapshots), `src/lib/yahoo-finance.ts`, `src/app/api/quotes/route.ts`, `src/app/page.tsx`, `src/types/index.ts`.

**Delete:** `src/components/MetricCard.tsx`, `src/components/PortfolioHeroCard.tsx`, `src/components/AllocationCard.tsx`, `src/components/FailedTickersChip.tsx`.

These four are dashboard-only — verified with `grep -rl` — so nothing on Analytics moves.

**Not deleted here — correction to the original plan:** `Navbar.tsx` and `MobileMenu.tsx` are NOT dashboard-only. `src/app/analytics/page.tsx` also renders `Navbar`, and `MobileMenu` has its own unit test. Analytics is not rewritten until plan 3, so both survive plan 2 and coexist with the new `AppShell`/`TopBar` — exactly the additive coexistence the new CSS tokens use against the legacy palette. They move to the **plan 3 inbox** for deletion once analytics stops rendering `Navbar`. Consequence: there is no deliberately-red phase in this plan; the suite stays green throughout.

---

## Task 1: Portfolio totals

`src/app/page.tsx` computes these inline today, which is why no test covers the day-change denominator.

**Files:**
- Create: `src/lib/design/portfolio-totals.ts`
- Test: `src/__tests__/lib/design/portfolio-totals.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { portfolioTotals } from "@/lib/design/portfolio-totals";
import type { PortfolioItem } from "@/types";

function item(over: Partial<PortfolioItem> = {}): PortfolioItem {
  const shares = over.shares ?? 100;
  const avgCost = over.avgCost ?? 100;
  const quote = { price: 110, change: 2, changePercent: 1.85, previousClose: 108, ...over.quote };
  return {
    ticker: "AAPL",
    companyName: "Apple Inc.",
    sector: "Technology",
    shares,
    avgCost,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote,
    marketValue: shares * quote.price,
    totalPL: shares * (quote.price - avgCost),
    totalPLPercent: ((quote.price - avgCost) / avgCost) * 100,
    ...over,
  };
}

describe("portfolioTotals", () => {
  it("sums market value and cost basis across positions", () => {
    const t = portfolioTotals([
      item({ shares: 100, avgCost: 100, quote: { price: 110, change: 2, changePercent: 1.85, previousClose: 108 } }),
      item({ shares: 50, avgCost: 200, quote: { price: 220, change: -5, changePercent: -2.22, previousClose: 225 } }),
    ]);
    expect(t.totalValue).toBe(100 * 110 + 50 * 220);
    expect(t.costBasis).toBe(100 * 100 + 50 * 200);
  });

  it("derives P&L from value minus cost", () => {
    const t = portfolioTotals([item({ shares: 100, avgCost: 100 })]);
    expect(t.totalPL).toBe(1000);
    expect(t.totalPLPercent).toBeCloseTo(10, 5);
  });

  // The denominator is yesterday's close, not today's value. Dividing by today
  // understates every move, and the error grows with the size of the move.
  it("measures the day change against yesterday's value", () => {
    const t = portfolioTotals([
      item({ shares: 100, quote: { price: 110, change: 10, changePercent: 10, previousClose: 100 } }),
    ]);
    expect(t.dayChange).toBe(1000);
    expect(t.dayChangePercent).toBeCloseTo(10, 5);
  });

  it("nets gainers against losers in the day change", () => {
    const t = portfolioTotals([
      item({ shares: 100, quote: { price: 110, change: 10, changePercent: 10, previousClose: 100 } }),
      item({ shares: 100, quote: { price: 90, change: -10, changePercent: -10, previousClose: 100 } }),
    ]);
    expect(t.dayChange).toBe(0);
    expect(t.dayChangePercent).toBe(0);
  });

  it("returns zeros for an empty portfolio without dividing by zero", () => {
    const t = portfolioTotals([]);
    expect(t).toEqual({
      totalValue: 0,
      costBasis: 0,
      totalPL: 0,
      totalPLPercent: 0,
      dayChange: 0,
      dayChangePercent: 0,
    });
  });

  // A fully written-off position leaves costBasis at 0; percent must not be Infinity.
  it("reports zero percent rather than Infinity when cost basis is zero", () => {
    const t = portfolioTotals([item({ shares: 10, avgCost: 0 })]);
    expect(Number.isFinite(t.totalPLPercent)).toBe(true);
    expect(t.totalPLPercent).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/lib/design/portfolio-totals.test.ts`
Expected: FAIL — `Cannot find module '@/lib/design/portfolio-totals'`.

- [ ] **Step 3: Write the implementation**

```ts
import type { PortfolioItem } from "@/types";

export interface PortfolioTotals {
  totalValue: number;
  costBasis: number;
  totalPL: number;
  totalPLPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

const EMPTY: PortfolioTotals = {
  totalValue: 0,
  costBasis: 0,
  totalPL: 0,
  totalPLPercent: 0,
  dayChange: 0,
  dayChangePercent: 0,
};

/**
 * Every dashboard number in one place, derived and never stored.
 *
 * `dayChangePercent` divides by YESTERDAY's value, not today's. Dividing by
 * today's understates every move, and the understatement grows with the move —
 * exactly when the number matters most.
 */
export function portfolioTotals(items: PortfolioItem[]): PortfolioTotals {
  if (items.length === 0) return EMPTY;

  let totalValue = 0;
  let costBasis = 0;
  let dayChange = 0;

  for (const i of items) {
    totalValue += i.marketValue;
    costBasis += i.shares * i.avgCost;
    dayChange += i.shares * i.quote.change;
  }

  const previousValue = totalValue - dayChange;
  const totalPL = totalValue - costBasis;

  return {
    totalValue,
    costBasis,
    totalPL,
    totalPLPercent: costBasis > 0 ? (totalPL / costBasis) * 100 : 0,
    dayChange,
    dayChangePercent: previousValue > 0 ? (dayChange / previousValue) * 100 : 0,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/lib/design/portfolio-totals.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/portfolio-totals.ts src/__tests__/lib/design/portfolio-totals.test.ts
git commit -m "feat(design): derive portfolio totals in one tested place

The dashboard page computed these inline, which is why nothing caught
that the day-change percentage divided by today's value instead of
yesterday's close — an error that grows with the size of the move."
```

---

## Task 2: Movers by dollar contribution

`MoversCard` currently sorts by `Math.abs(changePercent)`, so a $200 position moving 9% outranks a $40,000 position moving 1.2%. The card claims to explain the headline number and instead contradicts it.

**Files:**
- Create: `src/lib/design/movers.ts`
- Test: `src/__tests__/lib/design/movers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { topMovers } from "@/lib/design/movers";
import type { PortfolioItem } from "@/types";

function item(ticker: string, shares: number, change: number, price = 100): PortfolioItem {
  return {
    ticker,
    companyName: `${ticker} Inc.`,
    sector: "Technology",
    shares,
    avgCost: 90,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: {
      price,
      change,
      changePercent: (change / (price - change)) * 100,
      previousClose: price - change,
    },
    marketValue: shares * price,
    totalPL: shares * (price - 90),
    totalPLPercent: ((price - 90) / 90) * 100,
  };
}

describe("topMovers", () => {
  // The card sits beside the headline day change and claims to explain it. A
  // percent ranking contradicts that headline: a tiny position with a big
  // percent move outranks the position that actually moved the number.
  it("ranks by dollar contribution, not percent", () => {
    const big = item("BIG", 400, 1.2); // +$480
    const tiny = item("TINY", 2, 9); // +$18
    expect(topMovers([tiny, big]).map((m) => m.item.ticker)).toEqual(["BIG", "TINY"]);
  });

  it("reports each position's signed dollar contribution", () => {
    const movers = topMovers([item("AAPL", 100, 2)]);
    expect(movers[0].contribution).toBe(200);
  });

  it("ranks by absolute contribution so big losers surface too", () => {
    const gainer = item("UP", 100, 1); // +$100
    const loser = item("DOWN", 100, -5); // -$500
    expect(topMovers([gainer, loser]).map((m) => m.item.ticker)).toEqual(["DOWN", "UP"]);
  });

  it("keeps the sign on the contribution after ranking by magnitude", () => {
    const movers = topMovers([item("DOWN", 100, -5)]);
    expect(movers[0].contribution).toBe(-500);
  });

  it("caps the list at the requested limit", () => {
    const items = ["A", "B", "C", "D", "E", "F", "G"].map((t, n) => item(t, 100, n + 1));
    expect(topMovers(items, 5)).toHaveLength(5);
    expect(topMovers(items, 3)).toHaveLength(3);
  });

  it("defaults to five, the number the card has room for", () => {
    const items = ["A", "B", "C", "D", "E", "F", "G"].map((t, n) => item(t, 100, n + 1));
    expect(topMovers(items)).toHaveLength(5);
  });

  it("drops positions that did not move, which explain nothing", () => {
    const movers = topMovers([item("FLAT", 100, 0), item("MOVED", 100, 1)]);
    expect(movers.map((m) => m.item.ticker)).toEqual(["MOVED"]);
  });

  it("returns an empty list for an empty portfolio", () => {
    expect(topMovers([])).toEqual([]);
  });

  it("ignores non-finite changes so one bad quote cannot take the top slot", () => {
    const bad = item("BAD", 100, NaN);
    const good = item("GOOD", 100, 1);
    expect(topMovers([bad, good]).map((m) => m.item.ticker)).toEqual(["GOOD"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/lib/design/movers.test.ts`
Expected: FAIL — `Cannot find module '@/lib/design/movers'`.

- [ ] **Step 3: Write the implementation**

```ts
import type { PortfolioItem } from "@/types";

export interface Mover {
  item: PortfolioItem;
  /** Signed dollars this position added to or removed from today's change. */
  contribution: number;
}

/**
 * Positions ranked by what they did to the headline number, in dollars.
 *
 * Ranking by percent — which this card did before — puts a $200 position that
 * moved 9% above a $40,000 position that moved 1.2%, so the card sitting
 * directly beside the day change actively contradicts it.
 *
 * Non-finite changes are dropped rather than sorted: NaN comparisons are all
 * false, so a single bad quote lands wherever the sort happens to leave it,
 * which can be the top slot.
 */
export function topMovers(items: PortfolioItem[], limit = 5): Mover[] {
  return items
    .filter((i) => Number.isFinite(i.quote.change) && i.quote.change !== 0)
    .map((item) => ({ item, contribution: item.shares * item.quote.change }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, limit);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/lib/design/movers.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/movers.ts src/__tests__/lib/design/movers.test.ts
git commit -m "feat(design): rank movers by dollar contribution

Ranking by percent puts a \$200 position moving 9% above a \$40,000
position moving 1.2%, so the card sitting beside the headline day change
contradicts it. Contribution is shares x per-share change."
```

---

## Task 3: Sector allocation

**Files:**
- Create: `src/lib/design/allocation.ts`
- Test: `src/__tests__/lib/design/allocation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { sectorAllocation } from "@/lib/design/allocation";
import { OTHER_COLOR, sectorColor } from "@/lib/design/sectors";
import type { PortfolioItem } from "@/types";

function item(sector: string, marketValue: number, ticker = sector.slice(0, 4)): PortfolioItem {
  return {
    ticker,
    companyName: `${ticker} Inc.`,
    sector,
    shares: 1,
    avgCost: 1,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: { price: marketValue, change: 0, changePercent: 0, previousClose: marketValue },
    marketValue,
    totalPL: 0,
    totalPLPercent: 0,
  };
}

describe("sectorAllocation", () => {
  it("aggregates market value by sector, largest first", () => {
    const slices = sectorAllocation([
      item("Technology", 100),
      item("Healthcare", 300),
      item("Technology", 250),
    ]);
    expect(slices.map((s) => [s.sector, s.value])).toEqual([
      ["Technology", 350],
      ["Healthcare", 300],
    ]);
  });

  it("reports each sector's share of the total", () => {
    const slices = sectorAllocation([item("Technology", 750), item("Energy", 250)]);
    expect(slices[0].pct).toBeCloseTo(75, 5);
    expect(slices[1].pct).toBeCloseTo(25, 5);
  });

  it("takes its colours from the shared sector palette", () => {
    const slices = sectorAllocation([item("Technology", 100)]);
    expect(slices[0].color).toBe(sectorColor("Technology"));
  });

  // Beyond the cap the strip becomes unreadable slivers. Rolling the tail into
  // one bucket keeps the percentages summing to 100 without lying about them.
  it("rolls everything past the limit into a single Other bucket", () => {
    const items = [
      item("Technology", 100),
      item("Healthcare", 90),
      item("Energy", 80),
      item("Utilities", 5),
      item("Industrials", 4),
      item("Real Estate", 3),
    ];
    const slices = sectorAllocation(items, 3);
    expect(slices).toHaveLength(4);
    expect(slices[3]).toEqual(
      expect.objectContaining({ sector: "Other", value: 12, color: OTHER_COLOR }),
    );
  });

  it("keeps percentages summing to 100 after the roll-up", () => {
    const items = [
      item("Technology", 100),
      item("Healthcare", 90),
      item("Energy", 80),
      item("Utilities", 5),
      item("Industrials", 4),
    ];
    const total = sectorAllocation(items, 3).reduce((s, x) => s + x.pct, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it("does not add an Other bucket when everything already fits", () => {
    const slices = sectorAllocation([item("Technology", 100), item("Energy", 50)], 3);
    expect(slices.map((s) => s.sector)).toEqual(["Technology", "Energy"]);
  });

  it("buckets missing sectors as Other rather than dropping the money", () => {
    const orphan = { ...item("Technology", 40), sector: "" };
    const slices = sectorAllocation([item("Technology", 60), orphan]);
    expect(slices.find((s) => s.sector === "Other")?.value).toBe(40);
  });

  it("returns an empty list for an empty portfolio", () => {
    expect(sectorAllocation([])).toEqual([]);
  });

  it("returns an empty list rather than dividing by a zero total", () => {
    expect(sectorAllocation([item("Technology", 0)])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/lib/design/allocation.test.ts`
Expected: FAIL — `Cannot find module '@/lib/design/allocation'`.

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/lib/design/allocation.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/allocation.ts src/__tests__/lib/design/allocation.test.ts
git commit -m "feat(design): aggregate allocation by sector

Largest first, with the tail and any unknown sectors rolled into one
Other bucket so the direct labels stay readable and the percentages
still sum to 100."
```

---

## Task 4: Quote failure reasons

`src/lib/yahoo-finance.ts:134` derives failures after the fact with `tickers.filter(t => !quotes[t])`, which is exactly why no reason survives to the UI. The reason is captured at the `catch` site instead.

This is a **breaking change to `/api/quotes`**. Every caller and its test moves with it.

**Files:**
- Create: `src/lib/quote-failures.ts`
- Test: `src/__tests__/lib/quote-failures.test.ts`
- Modify: `src/types/index.ts`, `src/lib/yahoo-finance.ts`, `src/lib/use-portfolio-data.ts`, `src/__tests__/lib/yahoo-finance.test.ts`, `src/__tests__/api/quotes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { classifyFailure } from "@/lib/quote-failures";

describe("classifyFailure", () => {
  it("reads a delisted or misspelled symbol as unlisted", () => {
    expect(classifyFailure(new Error("Quote not found for symbol: ZZZZ"))).toBe("unlisted");
    expect(classifyFailure(new Error("No data found, symbol may be delisted"))).toBe("unlisted");
  });

  it("reads a slow or aborted request as a timeout", () => {
    expect(classifyFailure(new Error("ETIMEDOUT"))).toBe("timeout");
    expect(classifyFailure(new Error("The operation was aborted"))).toBe("timeout");
    expect(classifyFailure(new Error("network socket disconnected"))).toBe("timeout");
  });

  // A symbol that resolves but carries no price is a real, distinct case:
  // halted stocks and some ADRs do this, and calling them "unlisted" would
  // tell the user to remove a holding they should keep.
  it("reads a resolved symbol with no usable price as no_price", () => {
    expect(classifyFailure(new Error("regularMarketPrice missing"))).toBe("no_price");
  });

  it("falls back to no_price for anything unrecognised", () => {
    expect(classifyFailure(new Error("kaboom"))).toBe("no_price");
    expect(classifyFailure("a bare string")).toBe("no_price");
    expect(classifyFailure(undefined)).toBe("no_price");
  });

  it("matches case-insensitively, since the upstream wording varies", () => {
    expect(classifyFailure(new Error("SYMBOL MAY BE DELISTED"))).toBe("unlisted");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/lib/quote-failures.test.ts`
Expected: FAIL — `Cannot find module '@/lib/quote-failures'`.

- [ ] **Step 3: Write the classifier**

```ts
export type FailureReason = "unlisted" | "timeout" | "no_price";

export interface QuoteFailure {
  ticker: string;
  reason: FailureReason;
}

/** Human wording for the failed-ticker strip. */
export const FAILURE_LABELS: Record<FailureReason, string> = {
  unlisted: "Not found",
  timeout: "Timed out",
  no_price: "No price",
};

/** What the user can actually do about it, per reason. */
export const FAILURE_HINTS: Record<FailureReason, string> = {
  unlisted: "Symbol may be delisted or misspelled.",
  timeout: "The quote service was slow. Retrying usually works.",
  no_price: "The symbol resolved but returned no price.",
};

/**
 * Map an upstream throw onto a reason the user can act on.
 *
 * `no_price` is the fallback rather than `unlisted` on purpose: telling someone
 * their holding does not exist is the one wrong answer that prompts them to
 * delete a position they should keep.
 */
export function classifyFailure(err: unknown): FailureReason {
  const message = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();

  if (message.includes("not found") || message.includes("delisted")) return "unlisted";
  if (
    message.includes("timeout") ||
    message.includes("etimedout") ||
    message.includes("aborted") ||
    message.includes("socket")
  ) {
    return "timeout";
  }
  return "no_price";
}
```

- [ ] **Step 4: Widen the shared type**

In `src/types/index.ts`, re-export the failure types so client components import from one place:

```ts
export type { FailureReason, QuoteFailure } from "@/lib/quote-failures";
```

- [ ] **Step 5: Capture the reason at the catch site in `src/lib/yahoo-finance.ts`**

Change the `QuotesResult` interface (line 8-11):

```ts
export interface QuotesResult {
  quotes: Record<string, Quote>;
  failed: QuoteFailure[];
}
```

Add the import at the top of the file:

```ts
import { classifyFailure, type QuoteFailure } from "@/lib/quote-failures";
```

Declare a collector immediately before the `Promise.allSettled` batch that fetches quotes:

```ts
const failures = new Map<string, QuoteFailure>();
```

In that batch's `catch` clause, record the reason instead of swallowing it:

```ts
} catch (err) {
  failures.set(ticker, { ticker, reason: classifyFailure(err) });
}
```

Replace the derived `failed` line (currently line 134):

```ts
  // Anything with no quote and no recorded throw resolved without a price.
  for (const ticker of tickers) {
    if (!quotes[ticker] && !failures.has(ticker)) {
      failures.set(ticker, { ticker, reason: "no_price" });
    }
  }
  const result: QuotesResult = { quotes, failed: [...failures.values()] };
```

And update the sandbox short-circuit (line 72) — `failed: []` still type-checks unchanged.

- [ ] **Step 6: Move the consumers**

In `src/lib/use-portfolio-data.ts`, change the `failed` state type from `string[]` to `QuoteFailure[]`, importing the type from `@/types`. The existing `data.failed ?? []` assignment needs no other change.

- [ ] **Step 7: Update the two affected suites**

In `src/__tests__/lib/yahoo-finance.test.ts` and `src/__tests__/api/quotes.test.ts`, every assertion of the shape `expect(result.failed).toEqual(["ZZZZ"])` becomes:

```ts
expect(result.failed).toEqual([{ ticker: "ZZZZ", reason: "unlisted" }]);
```

Pick the reason that matches what each test's mock actually throws — do not assume `unlisted`. If a mock resolves with no price rather than throwing, the expected reason is `no_price`.

In `src/__tests__/lib/use-portfolio-data.test.tsx`, the two `failed` fixtures become objects:

```ts
quotes: { body: { quotes: { AAPL: quote() }, failed: [{ ticker: "ZZZZ", reason: "unlisted" }] } },
```

and the assertion:

```ts
expect(result.current.failed).toEqual([{ ticker: "ZZZZ", reason: "unlisted" }]);
```

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS. If a quotes test fails on the reason rather than the shape, fix the *expectation* to match what the mock throws — do not loosen the assertion to `expect.any(String)`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/quote-failures.ts src/__tests__/lib/quote-failures.test.ts src/types/index.ts src/lib/yahoo-finance.ts src/lib/use-portfolio-data.ts src/__tests__/lib/yahoo-finance.test.ts src/__tests__/api/quotes.test.ts src/__tests__/lib/use-portfolio-data.test.tsx
git commit -m "feat(quotes): carry a reason on every failed ticker

Failures were derived after the fact with a filter over the tickers that
produced no quote, which discards the reason at exactly the point it is
known. The reason is captured at the catch site instead, so the strip can
tell a delisted symbol apart from a timeout — the first wants Remove, the
second wants Retry.

Breaking change to /api/quotes: failed is now QuoteFailure[]."
```

---

## Task 5: Snapshots in the shared hook

The summary card's sparkline needs history. The hook already **writes** snapshots but never reads them, and the spec's *Shared data hook* section lists snapshots as its responsibility.

**Files:**
- Modify: `src/lib/use-portfolio-data.ts`
- Test: `src/__tests__/lib/use-portfolio-data.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/lib/use-portfolio-data.test.tsx`. Add `DEMO_SNAPSHOTS` to the `@/lib/demo-data` mock factory first:

```ts
jest.mock("@/lib/demo-data", () => ({
  buildDemoItems: (range: TimeRange) => mockBuildDemoItems(range),
  DEMO_SNAPSHOTS: [{ date: "2026-07-01", totalValue: 1000, holdings: {} }],
}));
```

Extend `stubFetch` to route the snapshot GET, immediately before its `/api/quotes` branch:

```ts
    if (url.startsWith("/api/snapshot") && (!init || init.method !== "POST")) {
      const r = routes.snapshots ?? { ok: true, body: [] };
      return { ok: r.ok ?? true, status: 200, json: async () => r.body };
    }
```

and widen its signature and the inner mock to accept the init argument:

```ts
function stubFetch(routes: {
  holdings?: { ok?: boolean; status?: number; body?: unknown };
  quotes?: { ok?: boolean; body?: unknown };
  snapshots?: { ok?: boolean; body?: unknown };
  throws?: boolean;
}) {
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
```

Then the new cases:

```ts
describe("usePortfolioData snapshots", () => {
  const history = [
    { date: "2026-07-25", totalValue: 1000, holdings: { AAPL: 1000 } },
    { date: "2026-07-26", totalValue: 1100, holdings: { AAPL: 1100 } },
  ];

  it("returns snapshot history for the sparkline", async () => {
    stubFetch({
      holdings: { body: [holding()] },
      quotes: { body: { quotes: { AAPL: quote() }, failed: [] } },
      snapshots: { body: history },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.snapshots).toEqual(history);
  });

  // A failed history read must not take down a working portfolio: the
  // sparkline is decoration, the value above it is the point of the screen.
  it("keeps the portfolio ready when only the history read fails", async () => {
    stubFetch({
      holdings: { body: [holding()] },
      quotes: { body: { quotes: { AAPL: quote() }, failed: [] } },
      snapshots: { ok: false },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.snapshots).toEqual([]);
  });

  it("serves the fixture history in demo mode with no network", async () => {
    const fetchMock = stubFetch({});
    isDemo = true;
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.snapshots).toEqual([
      { date: "2026-07-01", totalValue: 1000, holdings: {} },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/lib/use-portfolio-data.test.tsx -t "snapshots"`
Expected: FAIL — `result.current.snapshots` is `undefined`.

- [ ] **Step 3: Write the implementation**

In `src/lib/use-portfolio-data.ts`, add the import:

```ts
import { buildDemoItems, DEMO_SNAPSHOTS } from "@/lib/demo-data";
import type { Snapshot } from "@/types";
```

Add the state beside the existing `items` state:

```ts
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
```

In the demo branch of `refresh`, before the early return:

```ts
      setSnapshots(DEMO_SNAPSHOTS);
```

After the snapshot POST in the authenticated path, read the history back:

```ts
      // Decoration, not the point of the screen — a failed history read must
      // not fail the portfolio that renders above it.
      try {
        const historyRes = await fetch("/api/snapshot", { headers });
        setSnapshots(historyRes.ok ? await historyRes.json() : []);
      } catch {
        setSnapshots([]);
      }
```

Add `snapshots` to the returned object.

- [ ] **Step 4: Run the full hook suite**

Run: `npm test -- src/__tests__/lib/use-portfolio-data.test.tsx`
Expected: PASS, 26 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/use-portfolio-data.ts src/__tests__/lib/use-portfolio-data.test.tsx
git commit -m "feat(dashboard): read snapshot history in the shared hook

The hook wrote snapshots and never read them back. The history read is
isolated in its own try so a failed read leaves a working portfolio
rendering — the sparkline is decoration, the value above it is not."
```

---

## Task 6: Status pill

The current market-status pill is shaped exactly like the Add and Sign in buttons beside it, so it reads as a control that does nothing when clicked.

**Files:**
- Create: `src/components/StatusPill.tsx`
- Test: `src/__tests__/components/StatusPill.test.tsx`
- Modify: `src/app/globals.css`, `tailwind.config.ts`

- [ ] **Step 0: Extend the token set for the components that follow**

Plan 1 added `--rd-flat-tile` and `--rd-flat-aggregate` to `globals.css` but never exposed them to Tailwind, and the amber strip in Task 12 needs surface and border variants of the warning colour.

**This is not stylistic.** Tailwind 3.4 silently drops opacity modifiers on `var()`-valued colours — `bg-rd-warning/10` compiles to *nothing at all*, not to a faint amber. Verified against the actual Tailwind binary in this repo. Never write `/NN` after an `rd-` colour anywhere in this plan; use a dedicated token instead.

Add to the `:root` block in `src/app/globals.css`, beside the existing `--rd-warning`:

```css
    --rd-warning-surface: #d9a4411a;
    --rd-warning-border: #d9a4414d;
```

Add to the `rd` group in `tailwind.config.ts`:

```ts
          "flat-tile": "var(--rd-flat-tile)",
          "flat-aggregate": "var(--rd-flat-aggregate)",
          "warning-surface": "var(--rd-warning-surface)",
          "warning-border": "var(--rd-warning-border)",
```

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { StatusPill } from "@/components/StatusPill";

describe("StatusPill", () => {
  it("states that the market is open", () => {
    render(<StatusPill open asOf="4:00 PM ET" />);
    expect(screen.getByText(/open/i)).toBeInTheDocument();
  });

  it("states when the market closed, not just that it is closed", () => {
    render(<StatusPill open={false} asOf="4:00 PM ET" />);
    expect(screen.getByText(/closed/i)).toBeInTheDocument();
    expect(screen.getByText(/4:00 PM ET/)).toBeInTheDocument();
  });

  // The shipped pill is a rounded-full bordered pill identical to the Add and
  // Sign in buttons beside it, so it reads as a control that does nothing.
  it("is not a button and carries no button affordance", () => {
    const { container } = render(<StatusPill open={false} asOf="4:00 PM ET" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector(".rounded-full")).toBeNull();
  });

  it("announces itself as a live status region", () => {
    render(<StatusPill open asOf="4:00 PM ET" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // Never colour alone: the dot is reinforced by the word beside it.
  it("carries the state in text, not only in the dot colour", () => {
    const { rerender } = render(<StatusPill open asOf="4:00 PM ET" />);
    expect(screen.getByRole("status")).toHaveTextContent(/open/i);
    rerender(<StatusPill open={false} asOf="4:00 PM ET" />);
    expect(screen.getByRole("status")).toHaveTextContent(/closed/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/components/StatusPill.test.tsx`
Expected: FAIL — `Cannot find module '@/components/StatusPill'`.

- [ ] **Step 3: Write the implementation**

```tsx
interface StatusPillProps {
  open: boolean;
  /** Last session close, e.g. "4:00 PM ET". */
  asOf: string;
}

/**
 * Market status in STATUS styling, deliberately not button styling.
 *
 * The shipped pill was a rounded-full bordered pill sitting between Add and
 * Sign in, identical in shape to both, so it read as a control — users click
 * it and nothing happens. No border, no pill radius, no hover state: a dot,
 * a word, and a timestamp.
 */
export function StatusPill({ open, asOf }: StatusPillProps) {
  return (
    <div
      role="status"
      className="inline-flex items-center gap-2 px-1 font-mono text-[11px] text-rd-muted"
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${open ? "bg-rd-gain" : "bg-rd-warning"}`}
      />
      {open ? <span>Open</span> : <span>Closed · as of {asOf}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/components/StatusPill.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/StatusPill.tsx src/__tests__/components/StatusPill.test.tsx src/app/globals.css tailwind.config.ts
git commit -m "feat(chrome): market status in status styling, not button styling

The shipped pill was shaped exactly like the Add and Sign in buttons
beside it, so it read as a control that does nothing when clicked.

Also exposes the flat and warning tokens to Tailwind. Tailwind 3.4 drops
opacity modifiers on var() colours silently, so warning surface and
border need their own tokens rather than /10 and /30."
```

---

## Task 7: Sparkline

**Files:**
- Create: `src/components/Sparkline.tsx`
- Test: `src/__tests__/components/Sparkline.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { Sparkline } from "@/components/Sparkline";

const series = [100, 105, 103, 110, 108, 115];

describe("Sparkline", () => {
  it("draws a path through the series", () => {
    const { container } = render(<Sparkline values={series} />);
    const path = container.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path!.getAttribute("d")!.length).toBeGreaterThan(10);
  });

  // Spec, Known gaps: /api/snapshot only accumulates from first load, so a new
  // account has one or two points. Drawing a two-point line implies a trend
  // that was never measured.
  it("renders an honest note instead of a line under five points", () => {
    render(<Sparkline values={[100, 120]} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(/not enough history/i)).toBeInTheDocument();
  });

  it("draws once it has five points", () => {
    const { container } = render(<Sparkline values={[1, 2, 3, 4, 5]} />);
    expect(container.querySelector("path")).toBeInTheDocument();
  });

  it("renders the empty note for no data at all", () => {
    render(<Sparkline values={[]} />);
    expect(screen.getByText(/not enough history/i)).toBeInTheDocument();
  });

  it("colours by direction of the whole series, not the last step", () => {
    const { container: up } = render(<Sparkline values={[100, 90, 95, 92, 130]} />);
    expect(up.querySelector("path")).toHaveAttribute("stroke", "var(--rd-gain)");
    const { container: down } = render(<Sparkline values={[130, 140, 120, 135, 100]} />);
    expect(down.querySelector("path")).toHaveAttribute("stroke", "var(--rd-loss)");
  });

  // A flat series has zero range; scaling by it yields NaN in every y value
  // and React renders d="MNaN,NaN..." silently.
  it("survives a perfectly flat series without emitting NaN", () => {
    const { container } = render(<Sparkline values={[100, 100, 100, 100, 100]} />);
    expect(container.querySelector("path")!.getAttribute("d")).not.toContain("NaN");
  });

  it("is hidden from assistive tech, since the numbers beside it are the content", () => {
    const { container } = render(<Sparkline values={series} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/components/Sparkline.test.tsx`
Expected: FAIL — `Cannot find module '@/components/Sparkline'`.

- [ ] **Step 3: Write the implementation**

```tsx
interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

/** Below this the line implies a trend nobody measured. */
const MIN_POINTS = 5;

/**
 * Inline trend line for the summary card.
 *
 * Under five points it refuses to draw. `/api/snapshot` only accumulates from
 * the day a user first loads the dashboard, so a new account genuinely has one
 * or two points — and a two-point line is a straight segment that looks like a
 * measured trend.
 */
export function Sparkline({ values, width = 320, height = 44 }: SparklineProps) {
  if (values.length < MIN_POINTS) {
    return (
      <p className="font-mono text-[11px] text-rd-faint">
        Not enough history yet — a few more days and a trend appears here.
      </p>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series has zero range; dividing by it puts NaN into every y.
  const range = max - min || 1;
  const stepX = width / (values.length - 1);

  const d = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const rising = values[values.length - 1] >= values[0];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        d={d}
        fill="none"
        stroke={rising ? "var(--rd-gain)" : "var(--rd-loss)"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/components/Sparkline.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sparkline.tsx src/__tests__/components/Sparkline.test.tsx
git commit -m "feat(dashboard): sparkline that refuses to draw a fake trend

Snapshot history only accumulates from a user's first load, so a new
account has one or two points. Under five the component says so instead
of drawing a straight segment that reads as a measured trend."
```

---

## Task 8: App shell and navigation

The hamburger goes. The two things `MobileMenu` currently carries — **Sign out** (authenticated) and **Sign in** (demo) — must survive its deletion as real ≥44px controls in the top bar, not the ~20px stranded text link the review flagged.

**Files:**
- Create: `src/components/AppShell.tsx`, `src/components/TopBar.tsx`, `src/components/MobileTabs.tsx`
- Test: `src/__tests__/components/TopBar.test.tsx`, `src/__tests__/components/MobileTabs.test.tsx`

**Additive only.** The original plan deleted `Navbar.tsx`/`MobileMenu.tsx` here and accepted a red suite until Task 15. That was wrong: `analytics/page.tsx` also imports `Navbar`, and `MobileMenu` has its own test — deleting either breaks files unrelated to the dashboard, and analytics is not rewritten until plan 3. So this task only ADDS the three new components; the legacy chrome stays until plan 3. The suite stays green.

- [ ] **Step 1: Write the failing tests**

`src/__tests__/components/MobileTabs.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MobileTabs, NAV_TABS } from "@/components/MobileTabs";

jest.mock("next/navigation", () => ({ usePathname: () => mockPathname() }));
const mockPathname = jest.fn(() => "/");

describe("MobileTabs", () => {
  beforeEach(() => mockPathname.mockReturnValue("/"));

  it("renders one link per configured tab", () => {
    render(<MobileTabs />);
    for (const tab of NAV_TABS) {
      expect(screen.getByRole("link", { name: tab.label })).toBeInTheDocument();
    }
  });

  it("marks the tab matching the current route as current", () => {
    mockPathname.mockReturnValue("/analytics");
    render(<MobileTabs />);
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  // The demo routes mirror the real ones. Without prefix-awareness every tab
  // under /demo renders inactive and the control looks broken.
  it("resolves the active tab under the /demo prefix", () => {
    mockPathname.mockReturnValue("/demo/analytics");
    render(<MobileTabs />);
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps links inside /demo when browsing the demo", () => {
    mockPathname.mockReturnValue("/demo");
    render(<MobileTabs />);
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute(
      "href",
      "/demo/analytics",
    );
  });

  it("does not mark Dashboard current on a nested route", () => {
    mockPathname.mockReturnValue("/analytics");
    render(<MobileTabs />);
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });
});
```

`src/__tests__/components/TopBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { TopBar } from "@/components/TopBar";

jest.mock("next/navigation", () => ({ usePathname: () => "/" }));

const base = {
  onImportClick: jest.fn(),
  onAddClick: jest.fn(),
  onSignOut: jest.fn(),
  vix: null,
  marketOpen: false,
};

describe("TopBar", () => {
  // MobileMenu is deleted; these two must not vanish with it.
  it("keeps Sign out reachable without a hamburger", () => {
    render(<TopBar {...base} isDemo={false} />);
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /menu/i })).toBeNull();
  });

  it("offers Sign in instead when browsing the demo", () => {
    render(<TopBar {...base} isDemo />);
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
  });

  // The review flagged a ~20px text link as the only way out.
  it("gives the auth control a 44px minimum touch target", () => {
    render(<TopBar {...base} isDemo={false} />);
    expect(screen.getByRole("button", { name: /sign out/i })).toHaveClass("min-h-[44px]");
  });

  it("shows market status as a status region, not a button", () => {
    render(<TopBar {...base} isDemo={false} marketOpen={false} />);
    expect(screen.getByRole("status")).toHaveTextContent(/closed/i);
  });

  it("exposes Import and Add", () => {
    render(<TopBar {...base} isDemo={false} />);
    expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/__tests__/components/MobileTabs.test.tsx src/__tests__/components/TopBar.test.tsx`
Expected: FAIL — `Cannot find module '@/components/MobileTabs'`.

- [ ] **Step 3: Write `src/components/MobileTabs.tsx`**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavTab {
  href: string;
  label: string;
}

/**
 * Route tabs, in order.
 *
 * Plan 3 appends `{ href: "/holdings", label: "Holdings" }` when that screen
 * exists. Listing it before the route does would ship a dead tab.
 */
export const NAV_TABS: NavTab[] = [
  { href: "/", label: "Dashboard" },
  { href: "/analytics", label: "Analytics" },
];

const DEMO_PREFIX = "/demo";

/** Strip the demo prefix so one comparison serves both route trees. */
export function normalizePath(pathname: string): string {
  if (pathname === DEMO_PREFIX) return "/";
  return pathname.startsWith(`${DEMO_PREFIX}/`) ? pathname.slice(DEMO_PREFIX.length) : pathname;
}

/**
 * Full-width segmented route control. Replaces the hamburger outright: a menu
 * that hides two destinations behind a tap costs more than it saves.
 */
export function MobileTabs() {
  const pathname = usePathname();
  const inDemo = pathname === DEMO_PREFIX || pathname.startsWith(`${DEMO_PREFIX}/`);
  const current = normalizePath(pathname);

  return (
    <nav
      aria-label="Sections"
      className="lg:hidden grid grid-flow-col auto-cols-fr gap-[3px] p-[3px] mx-4 rounded-lg bg-rd-control border border-rd-border-control"
    >
      {NAV_TABS.map((tab) => {
        const active = current === tab.href;
        const href = inDemo ? `${DEMO_PREFIX}${tab.href === "/" ? "" : tab.href}` : tab.href;
        return (
          <Link
            key={tab.href}
            href={href || DEMO_PREFIX}
            aria-current={active ? "page" : undefined}
            className={`rd-focusable flex min-h-[44px] items-center justify-center rounded-md text-sm font-medium transition-colors ${
              active ? "bg-rd-card text-rd-text" : "text-rd-muted hover:text-rd-text"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Write `src/components/TopBar.tsx`**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { VixPill } from "@/components/VixPill";
import { StatusPill } from "@/components/StatusPill";
import { NAV_TABS, normalizePath } from "@/components/MobileTabs";
// Not from @/types — this type lives with the VIX heuristic that produces it.
import type { VixApiResponse } from "@/lib/vix-sentiment";

interface TopBarProps {
  onImportClick: () => void;
  onAddClick: () => void;
  onSignOut: () => void;
  isDemo: boolean;
  marketOpen: boolean;
  vix: VixApiResponse | null;
}

export function TopBar({
  onImportClick,
  onAddClick,
  onSignOut,
  isDemo,
  marketOpen,
  vix,
}: TopBarProps) {
  const current = normalizePath(usePathname());

  return (
    <header className="sticky top-0 z-40 border-b border-rd-border-hairline bg-rd-chrome">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-4 px-4 lg:px-8">
        <span className="font-semibold tracking-tight text-rd-text">Portfolio</span>

        <nav aria-label="Sections" className="hidden lg:flex items-center gap-1">
          {NAV_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={isDemo ? `/demo${tab.href === "/" ? "" : tab.href}` : tab.href}
              aria-current={current === tab.href ? "page" : undefined}
              className={`rd-focusable rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                current === tab.href
                  ? "bg-rd-control text-rd-text"
                  : "text-rd-muted hover:text-rd-text"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <StatusPill open={marketOpen} asOf="4:00 PM ET" />
          </div>
          {/* VixPill's prop is `data`, and it handles null itself. */}
          <VixPill data={vix} />

          <button
            onClick={onAddClick}
            className="rd-focusable inline-flex min-h-[44px] items-center rounded-lg border border-rd-border-control bg-rd-control px-3 text-sm font-medium text-rd-text hover:border-rd-border-strong"
          >
            Add
          </button>
          <button
            onClick={onImportClick}
            className="rd-focusable inline-flex min-h-[44px] items-center rounded-lg border border-rd-border-control bg-rd-control px-3 text-sm font-medium text-rd-text hover:border-rd-border-strong"
          >
            Import
          </button>

          {/* MobileMenu carried these; it is deleted, so they live here at a
              real touch target rather than as the ~20px text link the review
              flagged as the only way out of the app. */}
          {isDemo ? (
            <Link
              href="/"
              className="rd-focusable inline-flex min-h-[44px] items-center rounded-lg border border-rd-border-control px-3 text-sm font-medium text-rd-text hover:border-rd-border-strong"
            >
              Sign in
            </Link>
          ) : (
            <button
              onClick={onSignOut}
              className="rd-focusable inline-flex min-h-[44px] items-center rounded-lg border border-rd-border-control px-3 text-sm font-medium text-rd-muted hover:text-rd-text"
            >
              Sign out
            </button>
          )}
        </div>
      </div>

      <div className="pb-3 lg:pb-0">
        <MobileTabsSlot />
      </div>
    </header>
  );
}

/** Split out so TopBar's own tests do not need the tab control's route mock. */
function MobileTabsSlot() {
  const { MobileTabs } = require("@/components/MobileTabs") as typeof import("@/components/MobileTabs");
  return <MobileTabs />;
}
```

> **Note for the implementer:** if `require` inside the component trips the lint rule `@typescript-eslint/no-var-requires`, replace `MobileTabsSlot` with a direct `<MobileTabs />` import at the top of the file and delete the helper. The split exists only to keep the TopBar suite from needing the tab mock; a direct import with the mock added to `TopBar.test.tsx` is equally acceptable.

- [ ] **Step 5: Write `src/components/AppShell.tsx`**

```tsx
import type { ReactNode } from "react";

interface AppShellProps {
  topBar: ReactNode;
  children: ReactNode;
}

/**
 * Page frame. Owns the width cap and gutters so no screen re-declares them and
 * they cannot drift apart between routes.
 */
export function AppShell({ topBar, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-rd-page">
      {topBar}
      <main className="mx-auto w-full max-w-[1400px] px-4 py-4 lg:px-8 lg:py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 6: Delete the replaced chrome**

**Do NOT delete `Navbar.tsx` or `MobileMenu.tsx`.** They are shared with `analytics/page.tsx` (still using `Navbar`) and `MobileMenu` has its own test. They leave in plan 3. Nothing is deleted in this task.

- [ ] **Step 7: Run the two new suites, then the whole suite**

Run: `npm test -- src/__tests__/components/MobileTabs.test.tsx src/__tests__/components/TopBar.test.tsx`
Expected: PASS, 10 tests. Then run the whole `npm test` — it stays GREEN, since this task is purely additive. `npm run lint` and `npx tsc --noEmit` must both be clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/AppShell.tsx src/components/TopBar.tsx src/components/MobileTabs.tsx src/__tests__/components/TopBar.test.tsx src/__tests__/components/MobileTabs.test.tsx
git commit -m "feat(chrome): app shell with tab navigation, no hamburger

Adds AppShell, TopBar and a full-width MobileTabs control to replace the
hamburger. Sign out and Sign in move into the top bar as real 44px
controls rather than the ~20px text link the review flagged.

Additive only: the legacy Navbar and MobileMenu stay in place for the
analytics screen, which is not migrated yet, and are removed once its
last consumer is gone — the same coexistence the new CSS tokens use."
```

---

## Task 9: Summary card

The hero. Portfolio value at 40px and today's change at 27px are the **two largest elements on the page** — the review's finding was that today's change, the number people open the app for, was smaller than three separate pieces of chrome.

**Files:**
- Create: `src/components/SummaryCard.tsx`
- Test: `src/__tests__/components/SummaryCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { SummaryCard } from "@/components/SummaryCard";
import type { PortfolioTotals } from "@/lib/design/portfolio-totals";

const totals: PortfolioTotals = {
  totalValue: 155876.26,
  costBasis: 134481,
  totalPL: 21395.26,
  totalPLPercent: 15.91,
  dayChange: 80.92,
  dayChangePercent: 0.05,
};

describe("SummaryCard", () => {
  it("prints the portfolio value in full, never abbreviated", () => {
    render(<SummaryCard totals={totals} snapshots={[]} />);
    expect(screen.getByText("$155,876.26")).toBeInTheDocument();
  });

  it("prints today's change with an explicit sign and its percentage", () => {
    render(<SummaryCard totals={totals} snapshots={[]} />);
    expect(screen.getByText(/\+\$80\.92/)).toBeInTheDocument();
    expect(screen.getByText(/\+0\.05%/)).toBeInTheDocument();
  });

  it("uses a true minus sign on a down day, never a hyphen", () => {
    render(
      <SummaryCard totals={{ ...totals, dayChange: -60.97, dayChangePercent: -0.04 }} snapshots={[]} />,
    );
    const el = screen.getByText(/60\.97/);
    expect(el.textContent).toContain("−");
    expect(el.textContent).not.toContain("-");
  });

  // Never colour alone.
  it("carries direction as a glyph as well as a colour", () => {
    const { rerender } = render(<SummaryCard totals={totals} snapshots={[]} />);
    expect(screen.getByTestId("day-change")).toHaveTextContent("▲");
    rerender(<SummaryCard totals={{ ...totals, dayChange: -1, dayChangePercent: -0.01 }} snapshots={[]} />);
    expect(screen.getByTestId("day-change")).toHaveTextContent("▼");
  });

  it("uses the flat glyph when nothing moved", () => {
    render(<SummaryCard totals={{ ...totals, dayChange: 0, dayChangePercent: 0 }} snapshots={[]} />);
    expect(screen.getByTestId("day-change")).toHaveTextContent("◆");
  });

  it("shows cost basis and total P&L as supporting figures", () => {
    render(<SummaryCard totals={totals} snapshots={[]} />);
    expect(screen.getByText("$134,481.00")).toBeInTheDocument();
    expect(screen.getByText(/\+\$21,395\.26/)).toBeInTheDocument();
  });

  // The review's headline finding: the number people open the app for was
  // smaller than the chrome around it.
  it("renders today's change larger than the supporting figures", () => {
    render(<SummaryCard totals={totals} snapshots={[]} />);
    const day = screen.getByTestId("day-change");
    const support = screen.getByTestId("cost-basis");
    expect(parseFloat(getComputedStyle(day).fontSize)).toBeGreaterThan(
      parseFloat(getComputedStyle(support).fontSize),
    );
  });

  it("passes snapshot history to the sparkline", () => {
    const history = [1, 2, 3, 4, 5, 6].map((n) => ({
      date: `2026-07-0${n}`,
      totalValue: 100 + n,
      holdings: {},
    }));
    const { container } = render(<SummaryCard totals={totals} snapshots={history} />);
    expect(container.querySelector("path")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/components/SummaryCard.test.tsx`
Expected: FAIL — `Cannot find module '@/components/SummaryCard'`.

- [ ] **Step 3: Write the implementation**

```tsx
import { money, signedMoney, signedPct } from "@/lib/design/format";
import { Sparkline } from "@/components/Sparkline";
import type { PortfolioTotals } from "@/lib/design/portfolio-totals";
import type { Snapshot } from "@/types";

interface SummaryCardProps {
  totals: PortfolioTotals;
  snapshots: Snapshot[];
}

function glyph(v: number): string {
  if (v > 0) return "▲";
  if (v < 0) return "▼";
  return "◆";
}

function toneClass(v: number): string {
  if (v > 0) return "text-rd-gain";
  if (v < 0) return "text-rd-loss";
  return "text-rd-flat";
}

/**
 * The hero. Portfolio value at 40px and today's change at 27px are the two
 * largest elements on the page — the review's headline finding was that
 * today's change, the number people open the app for, was smaller than three
 * separate pieces of chrome.
 *
 * Direction is carried by a glyph as well as a colour, so the card survives
 * greyscale and colour vision deficiency.
 */
export function SummaryCard({ totals, snapshots }: SummaryCardProps) {
  const { totalValue, dayChange, dayChangePercent, costBasis, totalPL, totalPLPercent } = totals;

  return (
    <section
      aria-label="Portfolio summary"
      className="rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
        Portfolio value
      </p>

      <p className="mt-1 font-mono text-[40px] font-bold leading-none tabular-nums text-rd-text">
        {money(totalValue)}
      </p>

      <p
        data-testid="day-change"
        className={`mt-3 font-mono text-[27px] font-semibold leading-none tabular-nums ${toneClass(dayChange)}`}
      >
        <span aria-hidden="true">{glyph(dayChange)}</span> {signedMoney(dayChange)}{" "}
        <span className="text-[18px]">({signedPct(dayChangePercent)})</span>
        <span className="ml-2 font-sans text-[13px] font-normal text-rd-muted">today</span>
      </p>

      <div className="mt-5">
        <Sparkline values={snapshots.map((s) => s.totalValue)} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-rd-border-hairline pt-4">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
            Cost basis
          </dt>
          <dd
            data-testid="cost-basis"
            className="mt-1 font-mono text-[15px] tabular-nums text-rd-body"
          >
            {money(costBasis)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
            Unrealized P&amp;L
          </dt>
          <dd className={`mt-1 font-mono text-[15px] tabular-nums ${toneClass(totalPL)}`}>
            {signedMoney(totalPL)}{" "}
            <span className="text-rd-muted">({signedPct(totalPLPercent)})</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/components/SummaryCard.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/SummaryCard.tsx src/__tests__/components/SummaryCard.test.tsx
git commit -m "feat(dashboard): summary card with the right hierarchy

Portfolio value and today's change become the two largest elements on
the page. The review's headline finding was that today's change — the
number people open the app for — was smaller than three separate pieces
of chrome. Direction carries a glyph as well as a colour."
```

---

## Task 10: Movers card

**Files:**
- Modify: `src/components/MoversCard.tsx` (full rewrite)
- Test: `src/__tests__/components/MoversCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { MoversCard } from "@/components/MoversCard";
import type { PortfolioItem } from "@/types";

function item(ticker: string, shares: number, change: number, price = 100): PortfolioItem {
  return {
    ticker,
    companyName: `${ticker} Corp`,
    sector: "Technology",
    shares,
    avgCost: 90,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: {
      price,
      change,
      changePercent: (change / (price - change)) * 100,
      previousClose: price - change,
    },
    marketValue: shares * price,
    totalPL: shares * (price - 90),
    totalPLPercent: ((price - 90) / 90) * 100,
  };
}

describe("MoversCard", () => {
  it("names what it is explaining", () => {
    render(<MoversCard items={[item("AAPL", 100, 2)]} />);
    expect(screen.getByText(/what moved the number/i)).toBeInTheDocument();
  });

  it("orders rows by dollar contribution", () => {
    render(<MoversCard items={[item("TINY", 2, 9), item("BIG", 400, 1.2)]} />);
    const rows = screen.getAllByTestId("mover-row");
    expect(rows[0]).toHaveTextContent("BIG");
    expect(rows[1]).toHaveTextContent("TINY");
  });

  it("shows each position's dollar contribution, not just its percent", () => {
    render(<MoversCard items={[item("AAPL", 100, 2)]} />);
    expect(screen.getByText(/\+\$200\.00/)).toBeInTheDocument();
  });

  it("carries direction as a glyph as well as a colour", () => {
    render(<MoversCard items={[item("DOWN", 100, -5)]} />);
    expect(screen.getByTestId("mover-row")).toHaveTextContent("▼");
  });

  it("says so plainly when nothing moved", () => {
    render(<MoversCard items={[item("FLAT", 100, 0)]} />);
    expect(screen.getByText(/nothing moved today/i)).toBeInTheDocument();
  });

  it("says so plainly for an empty portfolio", () => {
    render(<MoversCard items={[]} />);
    expect(screen.getByText(/nothing moved today/i)).toBeInTheDocument();
  });

  it("caps the list at five rows", () => {
    const items = ["A", "B", "C", "D", "E", "F", "G"].map((t, n) => item(t, 100, n + 1));
    render(<MoversCard items={items} />);
    expect(screen.getAllByTestId("mover-row")).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/components/MoversCard.test.tsx`
Expected: FAIL — the current card renders "Today's Movers" and has no `mover-row` test ids.

- [ ] **Step 3: Replace `src/components/MoversCard.tsx` entirely**

```tsx
import { topMovers } from "@/lib/design/movers";
import { signedMoney, signedPct } from "@/lib/design/format";
import type { PortfolioItem } from "@/types";

interface MoversCardProps {
  items: PortfolioItem[];
  limit?: number;
}

function glyph(v: number): string {
  return v > 0 ? "▲" : "▼";
}

/**
 * "What moved the number" — the companion to the day change in SummaryCard.
 *
 * Rows are ranked by dollar contribution, which is the only ranking that can
 * explain the headline. The previous percent ranking put a $200 position that
 * moved 9% above a $40,000 position that moved 1.2%, directly contradicting
 * the figure it sat beside.
 */
export function MoversCard({ items, limit = 5 }: MoversCardProps) {
  const movers = topMovers(items, limit);

  return (
    <section
      aria-label="What moved the number"
      className="flex h-full flex-col rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6"
    >
      <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
        What moved the number
      </h2>

      {movers.length === 0 ? (
        <p className="mt-4 text-sm text-rd-muted">Nothing moved today.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {movers.map(({ item, contribution }) => (
            <li
              key={item.ticker}
              data-testid="mover-row"
              className="flex items-baseline justify-between gap-3"
            >
              <span className="min-w-0">
                <span className="font-mono text-sm font-semibold text-rd-text">{item.ticker}</span>
                <span className="ml-2 truncate text-xs text-rd-muted">{item.companyName}</span>
              </span>
              <span
                className={`shrink-0 font-mono text-sm tabular-nums ${
                  contribution >= 0 ? "text-rd-gain" : "text-rd-loss"
                }`}
              >
                <span aria-hidden="true">{glyph(contribution)}</span> {signedMoney(contribution)}
                <span className="ml-2 text-rd-muted">{signedPct(item.quote.changePercent)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/components/MoversCard.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/MoversCard.tsx src/__tests__/components/MoversCard.test.tsx
git commit -m "feat(dashboard): movers card explains the headline number

Rows now rank by dollar contribution and print it, so the card beside
today's change agrees with it. Direction carries a glyph as well as a
colour."
```

---

## Task 11: Allocation strip

The donut goes: it needs a legend, the legend needs colours, and the colours collided with P&L semantics. A direct-labelled bar needs neither.

**Files:**
- Create: `src/components/AllocationStrip.tsx`
- Test: `src/__tests__/components/AllocationStrip.test.tsx`

**Additive only** (corrected). The original plan deleted `AllocationCard.tsx` here, but `page.tsx` still imports it until Task 15, so deleting now breaks compile for no benefit. `AllocationCard` is `page.tsx`-only with no own test; its deletion is deferred to Task 16, keeping the tree green. Same reasoning as the Task 8 `Navbar` correction.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { AllocationStrip } from "@/components/AllocationStrip";
import type { PortfolioItem } from "@/types";

function item(sector: string, marketValue: number, ticker = sector.slice(0, 4)): PortfolioItem {
  return {
    ticker,
    companyName: `${ticker} Inc.`,
    sector,
    shares: 1,
    avgCost: 1,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: { price: marketValue, change: 0, changePercent: 0, previousClose: marketValue },
    marketValue,
    totalPL: 0,
    totalPLPercent: 0,
  };
}

const items = [item("Technology", 600), item("Healthcare", 300), item("Energy", 100)];

describe("AllocationStrip", () => {
  it("labels each sector directly rather than through a legend", () => {
    render(<AllocationStrip items={items} />);
    expect(screen.getByText("Technology")).toBeInTheDocument();
    expect(screen.getByText("Healthcare")).toBeInTheDocument();
  });

  it("prints each sector's percentage and value", () => {
    render(<AllocationStrip items={items} />);
    expect(screen.getByText("60.0%")).toBeInTheDocument();
    expect(screen.getByText("$600.00")).toBeInTheDocument();
  });

  it("sizes each segment by its share of the total", () => {
    render(<AllocationStrip items={items} />);
    expect(screen.getByTestId("segment-Technology")).toHaveStyle({ width: "60%" });
  });

  it("renders an empty note rather than a zero-width bar", () => {
    render(<AllocationStrip items={[]} />);
    expect(screen.getByText(/no positions to allocate/i)).toBeInTheDocument();
  });

  // The bar is decorative; the labelled rows below it are the real content.
  it("hides the bar from assistive tech", () => {
    render(<AllocationStrip items={items} />);
    expect(screen.getByTestId("allocation-bar")).toHaveAttribute("aria-hidden", "true");
  });

  it("rolls the tail into Other past the display limit", () => {
    const many = [
      item("Technology", 100),
      item("Healthcare", 90),
      item("Energy", 80),
      item("Utilities", 70),
      item("Industrials", 60),
      item("Real Estate", 50),
      item("Consumer Defensive", 40),
      item("Consumer Cyclical", 30),
    ];
    render(<AllocationStrip items={many} />);
    expect(screen.getByText("Other")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/components/AllocationStrip.test.tsx`
Expected: FAIL — `Cannot find module '@/components/AllocationStrip'`.

- [ ] **Step 3: Write the implementation**

```tsx
import { sectorAllocation } from "@/lib/design/allocation";
import { money } from "@/lib/design/format";
import type { PortfolioItem } from "@/types";

interface AllocationStripProps {
  items: PortfolioItem[];
}

/**
 * Sector allocation as a direct-labelled bar.
 *
 * The donut this replaces required a legend, the legend required its own
 * colours, and those colours sat beside P&L greens and reds carrying unrelated
 * meaning. A labelled bar needs no legend, so the collision disappears with it.
 */
export function AllocationStrip({ items }: AllocationStripProps) {
  const slices = sectorAllocation(items);

  if (slices.length === 0) {
    return (
      <section
        aria-label="Allocation"
        className="rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6"
      >
        <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
          Allocation
        </h2>
        <p className="mt-4 text-sm text-rd-muted">No positions to allocate.</p>
      </section>
    );
  }

  return (
    <section
      aria-label="Allocation"
      className="rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6"
    >
      <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
        Allocation
      </h2>

      <div
        data-testid="allocation-bar"
        aria-hidden="true"
        className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-rd-inset"
      >
        {slices.map((s) => (
          <span
            key={s.sector}
            data-testid={`segment-${s.sector}`}
            style={{ width: `${s.pct}%`, backgroundColor: s.color }}
          />
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {slices.map((s) => (
          <li key={s.sector} className="flex items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate text-sm text-rd-body">{s.sector}</span>
            </span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-rd-muted">
              <span className="text-rd-text">{s.pct.toFixed(1)}%</span> {money(s.value)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Do NOT delete `AllocationCard.tsx`**

It stays until Task 16 — `page.tsx` still imports it until Task 15. This task is additive.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/__tests__/components/AllocationStrip.test.tsx`
Expected: PASS, 6 tests. The whole suite stays green.

- [ ] **Step 6: Commit**

```bash
git add src/components/AllocationStrip.tsx src/__tests__/components/AllocationStrip.test.tsx
git commit -m "feat(dashboard): direct-labelled allocation strip

Replaces the donut. A donut needs a legend, the legend needs its own
colours, and those sat beside P&L greens and reds carrying unrelated
meaning. Labelling the rows directly removes the legend and the
collision with it."
```

---

## Task 12: Failed tickers strip

A slim inline amber bar **above a working map** — never a page takeover. Amber, not red: a data problem must not read as a big loss.

**Files:**
- Create: `src/components/FailedTickersStrip.tsx`
- Test: `src/__tests__/components/FailedTickersStrip.test.tsx`

**Additive only** (corrected): `FailedTickersChip.tsx` is `page.tsx`-only and stays until Task 16, same as `AllocationCard` — deleting now breaks compile for no benefit.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FailedTickersStrip } from "@/components/FailedTickersStrip";
import type { QuoteFailure } from "@/types";

const failures: QuoteFailure[] = [
  { ticker: "ZZZZ", reason: "unlisted" },
  { ticker: "HALT", reason: "no_price" },
];

const noop = () => {};

describe("FailedTickersStrip", () => {
  it("renders nothing when every quote resolved", () => {
    const { container } = render(
      <FailedTickersStrip failures={[]} excludedValue={0} onRetry={noop} onRemove={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("states the count and that the map still covers the rest", () => {
    render(
      <FailedTickersStrip failures={failures} excludedValue={1250} onRetry={noop} onRemove={noop} />,
    );
    expect(screen.getByText(/2 positions/i)).toBeInTheDocument();
    expect(screen.getByText(/rest of the map/i)).toBeInTheDocument();
  });

  it("states the excluded dollar value, so the total is not silently wrong", () => {
    render(
      <FailedTickersStrip failures={failures} excludedValue={1250} onRetry={noop} onRemove={noop} />,
    );
    expect(screen.getByText(/\$1,250\.00/)).toBeInTheDocument();
  });

  it("gives each ticker its own reason", () => {
    render(
      <FailedTickersStrip failures={failures} excludedValue={0} onRetry={noop} onRemove={noop} />,
    );
    expect(screen.getByText("Not found")).toBeInTheDocument();
    expect(screen.getByText("No price")).toBeInTheDocument();
  });

  it("offers Retry and Remove per ticker", async () => {
    const onRetry = jest.fn();
    const onRemove = jest.fn();
    render(
      <FailedTickersStrip
        failures={[failures[0]]}
        excludedValue={0}
        onRetry={onRetry}
        onRemove={onRemove}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /retry ZZZZ/i }));
    expect(onRetry).toHaveBeenCalledWith("ZZZZ");
    await userEvent.click(screen.getByRole("button", { name: /remove ZZZZ/i }));
    expect(onRemove).toHaveBeenCalledWith("ZZZZ");
  });

  // Amber, not red: a data problem must not read as a big loss.
  it("announces itself politely rather than as an alert", () => {
    render(
      <FailedTickersStrip failures={failures} excludedValue={0} onRetry={noop} onRemove={noop} />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("uses singular wording for a single failure", () => {
    render(
      <FailedTickersStrip
        failures={[failures[0]]}
        excludedValue={0}
        onRetry={noop}
        onRemove={noop}
      />,
    );
    expect(screen.getByText(/1 position/i)).toBeInTheDocument();
    expect(screen.queryByText(/1 positions/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/components/FailedTickersStrip.test.tsx`
Expected: FAIL — `Cannot find module '@/components/FailedTickersStrip'`.

- [ ] **Step 3: Write the implementation**

```tsx
"use client";
import { FAILURE_HINTS, FAILURE_LABELS } from "@/lib/quote-failures";
import { money } from "@/lib/design/format";
import type { QuoteFailure } from "@/types";

interface FailedTickersStripProps {
  failures: QuoteFailure[];
  /** Cost basis of the excluded positions, so the total is not silently wrong. */
  excludedValue: number;
  onRetry: (ticker: string) => void;
  onRemove: (ticker: string) => void;
}

/**
 * Slim inline notice above a working map — never a page takeover.
 *
 * Amber rather than red, and `role="status"` rather than `alert`: a few quotes
 * failing is a data problem, and dressing it in loss colouring makes the user
 * read it as money lost.
 */
export function FailedTickersStrip({
  failures,
  excludedValue,
  onRetry,
  onRemove,
}: FailedTickersStripProps) {
  if (failures.length === 0) return null;

  const n = failures.length;

  return (
    <div
      role="status"
      className="mb-3 rounded-lg border border-rd-warning-border bg-rd-warning-surface px-4 py-3"
    >
      <p className="text-xs text-rd-body">
        <span className="font-semibold text-rd-warning">
          {n} position{n === 1 ? "" : "s"} couldn&apos;t be priced
        </span>{" "}
        — the rest of the map is up to date. {money(excludedValue)} of cost basis is excluded
        from the totals above.
      </p>

      <ul className="mt-2.5 flex flex-wrap gap-2">
        {failures.map((f) => (
          <li
            key={f.ticker}
            title={FAILURE_HINTS[f.reason]}
            className="inline-flex items-center gap-2 rounded-md border border-rd-border-control bg-rd-control px-2 py-1"
          >
            <span className="font-mono text-xs font-semibold text-rd-text">{f.ticker}</span>
            <span className="font-mono text-[10px] text-rd-muted">{FAILURE_LABELS[f.reason]}</span>
            <button
              onClick={() => onRetry(f.ticker)}
              aria-label={`Retry ${f.ticker}`}
              className="rd-focusable rounded px-1 text-[11px] text-rd-muted hover:text-rd-text"
            >
              Retry
            </button>
            <button
              onClick={() => onRemove(f.ticker)}
              aria-label={`Remove ${f.ticker}`}
              className="rd-focusable rounded px-1 text-[11px] text-rd-muted hover:text-rd-text"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Do NOT delete `FailedTickersChip.tsx`**

It stays until Task 16 — `page.tsx` still imports it until Task 15. Additive only.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/__tests__/components/FailedTickersStrip.test.tsx`
Expected: PASS, 7 tests. Whole suite stays green.

- [ ] **Step 6: Commit**

```bash
git add src/components/FailedTickersStrip.tsx src/__tests__/components/FailedTickersStrip.test.tsx
git commit -m "feat(dashboard): failed tickers strip with per-ticker reasons

Slim amber notice above a working map, never a page takeover. Amber and
role=status rather than red and alert: a few quotes failing is a data
problem, and loss colouring makes it read as money lost. Each ticker
carries its reason, Retry and Remove."
```

---

## Task 13: Empty state

**Files:**
- Modify: `src/components/EmptyPortfolio.tsx` (full rewrite)
- Test: `src/__tests__/components/EmptyPortfolio.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyPortfolio } from "@/components/EmptyPortfolio";

describe("EmptyPortfolio", () => {
  it("offers both paths in, as real buttons", () => {
    render(<EmptyPortfolio onImportClick={jest.fn()} onAddClick={jest.fn()} />);
    expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add a stock/i })).toBeInTheDocument();
  });

  it("fires the right handler for each", async () => {
    const onImportClick = jest.fn();
    const onAddClick = jest.fn();
    render(<EmptyPortfolio onImportClick={onImportClick} onAddClick={onAddClick} />);
    await userEvent.click(screen.getByRole("button", { name: /import/i }));
    expect(onImportClick).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /add a stock/i }));
    expect(onAddClick).toHaveBeenCalled();
  });

  // The shipped secondary action was unstyled grey text with no affordance:
  // people did not know it was clickable.
  it("gives the secondary action a real border, not bare text", () => {
    render(<EmptyPortfolio onImportClick={jest.fn()} onAddClick={jest.fn()} />);
    expect(screen.getByRole("button", { name: /add a stock/i }).className).toMatch(/border/);
  });

  it("shows a ghost heat map so the user sees what they are about to get", () => {
    render(<EmptyPortfolio onImportClick={jest.fn()} onAddClick={jest.fn()} />);
    const ghost = screen.getByTestId("ghost-map");
    expect(ghost).toHaveAttribute("aria-hidden", "true");
    expect(ghost).toHaveClass("opacity-[0.55]");
  });

  it("gives both actions a 44px minimum touch target", () => {
    render(<EmptyPortfolio onImportClick={jest.fn()} onAddClick={jest.fn()} />);
    expect(screen.getByRole("button", { name: /import/i })).toHaveClass("min-h-[44px]");
    expect(screen.getByRole("button", { name: /add a stock/i })).toHaveClass("min-h-[44px]");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/components/EmptyPortfolio.test.tsx`
Expected: FAIL — no `ghost-map` test id; the secondary action is bare text.

- [ ] **Step 3: Replace `src/components/EmptyPortfolio.tsx` entirely**

```tsx
"use client";

interface EmptyPortfolioProps {
  onImportClick: () => void;
  onAddClick: () => void;
}

/** Fixed tile geometry for the ghost map — shape only, no data implied. */
const GHOST_TILES = [
  { w: "38%", h: "58%" },
  { w: "24%", h: "58%" },
  { w: "38%", h: "42%" },
  { w: "22%", h: "42%" },
  { w: "16%", h: "42%" },
];

/**
 * Empty state.
 *
 * Two real buttons: the shipped secondary was unstyled grey text with no
 * affordance, so people did not know it was clickable. The ghost map at 0.55
 * opacity shows the shape of what import produces — an empty state that only
 * says "nothing here" gives no reason to act.
 */
export function EmptyPortfolio({ onImportClick, onAddClick }: EmptyPortfolioProps) {
  return (
    <section className="rounded-xl border border-dashed border-rd-border-strong bg-rd-card p-8 text-center">
      <h2 className="text-lg font-semibold text-rd-text">No holdings yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-rd-muted">
        Import your Robinhood positions and this becomes a heat map of everything you own.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onImportClick}
          className="rd-focusable inline-flex min-h-[44px] items-center rounded-lg border border-rd-border-strong bg-rd-control px-5 text-sm font-medium text-rd-text hover:border-rd-border-stronger"
        >
          Import holdings
        </button>
        <button
          onClick={onAddClick}
          className="rd-focusable inline-flex min-h-[44px] items-center rounded-lg border border-rd-border-control px-5 text-sm font-medium text-rd-muted hover:text-rd-text"
        >
          Add a stock manually
        </button>
      </div>

      <div
        data-testid="ghost-map"
        aria-hidden="true"
        className="mt-8 flex h-40 w-full flex-wrap gap-1.5 overflow-hidden rounded-lg opacity-[0.55]"
      >
        {GHOST_TILES.map((t, i) => (
          <span
            key={i}
            style={{ width: t.w, height: t.h }}
            className="rounded bg-rd-flat-aggregate"
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/components/EmptyPortfolio.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/EmptyPortfolio.tsx src/__tests__/components/EmptyPortfolio.test.tsx
git commit -m "feat(dashboard): empty state with two real actions and a ghost map

The secondary action was unstyled grey text with no affordance. Both are
now real 44px buttons, and a ghost heat map at 0.55 opacity shows the
shape of what import produces."
```

---

## Task 14: Loading skeleton

Never render `$0.00` or the empty state as a placeholder. A slow connection currently flashes a zeroed portfolio, which is the most trust-destroying frame a money app can show.

**Files:**
- Create: `src/components/DashboardSkeleton.tsx`
- Test: `src/__tests__/components/DashboardSkeleton.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";

describe("DashboardSkeleton", () => {
  // The single most important assertion in this file.
  it("never renders a zero value or the empty-state copy", () => {
    const { container } = render(<DashboardSkeleton />);
    expect(container.textContent).not.toMatch(/\$0\.00/);
    expect(container.textContent).not.toMatch(/no holdings/i);
    expect(container.textContent).not.toMatch(/\$/);
  });

  it("announces that it is loading", () => {
    render(<DashboardSkeleton />);
    expect(screen.getByRole("status")).toHaveAccessibleName(/loading/i);
  });

  it("lays out skeleton tiles at the real map geometry so nothing reflows", () => {
    render(<DashboardSkeleton />);
    expect(screen.getAllByTestId("skeleton-tile").length).toBeGreaterThanOrEqual(5);
  });

  it("reserves the summary and movers row", () => {
    render(<DashboardSkeleton />);
    expect(screen.getByTestId("skeleton-summary")).toBeInTheDocument();
    expect(screen.getByTestId("skeleton-movers")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/components/DashboardSkeleton.test.tsx`
Expected: FAIL — `Cannot find module '@/components/DashboardSkeleton'`.

- [ ] **Step 3: Write the implementation**

```tsx
/** Same proportions the treemap settles into, so arrival does not reflow. */
const SKELETON_TILES = [
  { w: "42%", h: "56%" },
  { w: "30%", h: "56%" },
  { w: "26%", h: "56%" },
  { w: "22%", h: "44%" },
  { w: "20%", h: "44%" },
  { w: "20%", h: "44%" },
  { w: "18%", h: "44%" },
  { w: "18%", h: "44%" },
];

const shimmer = "animate-pulse rounded bg-rd-inset";

/**
 * Loading state.
 *
 * Renders no numbers at all — not even zeros. The shipped dashboard mounted
 * with empty state and rendered `$0.00` plus "No holdings yet" until the first
 * fetch resolved, so a slow connection showed users a wiped-out portfolio.
 */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading portfolio">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div
          data-testid="skeleton-summary"
          className="rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6"
        >
          <div className={`${shimmer} h-3 w-28`} />
          <div className={`${shimmer} mt-3 h-10 w-64`} />
          <div className={`${shimmer} mt-4 h-7 w-48`} />
          <div className={`${shimmer} mt-6 h-11 w-full`} />
        </div>
        <div
          data-testid="skeleton-movers"
          className="rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6"
        >
          <div className={`${shimmer} h-3 w-36`} />
          <div className="mt-4 flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={`${shimmer} h-5 w-full`} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6">
        <div className={`${shimmer} h-3 w-24`} />
        <div className="mt-4 flex h-[320px] flex-wrap gap-1.5 overflow-hidden">
          {SKELETON_TILES.map((t, i) => (
            <div
              key={i}
              data-testid="skeleton-tile"
              style={{ width: t.w, height: t.h }}
              className={shimmer}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/components/DashboardSkeleton.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/DashboardSkeleton.tsx src/__tests__/components/DashboardSkeleton.test.tsx
git commit -m "feat(dashboard): loading skeleton at the real geometry

The dashboard mounted in the empty state and rendered \$0.00 plus 'No
holdings yet' until the first fetch resolved, so a slow connection showed
users a wiped-out portfolio. The skeleton renders no numbers at all."
```

---

## Task 15: Wire the dashboard

**This is the single token-migration commit for this screen** (spec §2). The page moves onto `--rd-*` wholesale; a half-migrated card against `#07090b` looks like a rendering fault rather than a work in progress.

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Rewrite the render tree**

Replace the `return (...)` block of `src/app/page.tsx`. Keep every existing hook, handler and modal exactly as they are — only the tree below changes.

> **DEFECT (found in execution, fixed in `435ba9b`):** the `excludedValue` computation below is **always 0** — `usePortfolioData` filters holdings without a quote out of `items`, so a failed ticker is never in `items` to sum. Computing it here is impossible. It was moved into `usePortfolioData` (which has the raw holdings and the failure list) and is now returned from the hook. Below, destructure `excludedValue` from `usePortfolioData` and delete this local computation.

```tsx
  const totals = portfolioTotals(items);
  // excludedValue now comes from the usePortfolioData destructure — see the
  // defect note above. Do NOT recompute it from `items` here.

  return (
    <AuthGuard>
      <AppShell
        topBar={
          <TopBar
            onImportClick={openImport}
            onAddClick={openAddHolding}
            onSignOut={signOut}
            isDemo={isDemo}
            marketOpen={isMarketOpen()}
            vix={vix}
          />
        }
      >
        {status === "loading" ? (
          <DashboardSkeleton />
        ) : status === "empty" ? (
          <EmptyPortfolio onImportClick={openImport} onAddClick={openAddHolding} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
              <SummaryCard totals={totals} snapshots={snapshots} />
              <MoversCard items={items} />
            </div>

            <div className="mt-4">
              <FailedTickersStrip
                failures={failedTickers}
                excludedValue={excludedValue}
                onRetry={() => fetchPortfolio()}
                onRemove={handleRemoveTicker}
              />
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
              />
            </div>

            <div className="mt-4">
              <AllocationStrip items={items} />
            </div>
          </>
        )}
      </AppShell>

      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onAddSingle={() => {
            setShowImport(false);
            setShowAddHolding(true);
          }}
          onSuccess={() => {
            setShowImport(false);
            fetchPortfolio();
          }}
        />
      )}

      {showAddHolding && (
        <AddHoldingModal
          onClose={() => setShowAddHolding(false)}
          onSuccess={() => {
            setShowAddHolding(false);
            fetchPortfolio();
          }}
        />
      )}
    </AuthGuard>
  );
```

- [ ] **Step 2: Fix the imports**

Remove from `page.tsx`'s imports: `Navbar`, `PortfolioHeroCard`, `MetricCard`, `AllocationCard`, `FailedTickersChip`, and the local `fmtCurrency` / `fmtCurrencySigned` helpers if now unused. Note `Navbar` is only being removed from THIS page's imports — the file itself stays (analytics still uses it); do not `git rm` it here.

Add:

```tsx
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { SummaryCard } from "@/components/SummaryCard";
import { MoversCard } from "@/components/MoversCard";
import { AllocationStrip } from "@/components/AllocationStrip";
import { FailedTickersStrip } from "@/components/FailedTickersStrip";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { EmptyPortfolio } from "@/components/EmptyPortfolio";
import { portfolioTotals } from "@/lib/design/portfolio-totals";
import { useIsDemo } from "@/lib/demo-context";
```

The existing destructure at line 48-53 **aliases two fields** — `failed: failedTickers` and `refresh: fetchPortfolio`. Keep both aliases and add `snapshots`:

```tsx
  const {
    items,
    status,
    snapshots,
    failed: failedTickers,
    refresh: fetchPortfolio,
  } = usePortfolioData(range);
```

Also widen the `useAuth()` destructure at line 37 to `const { getIdToken, signOut } = useAuth();`, and add `const isDemo = useIsDemo();`.

- [ ] **Step 3: Add the remove handler**

The strip's Remove needs a real deletion. Place it beside the other handlers:

```tsx
  // Remove is the correct action for a delisted symbol, so it must actually
  // delete rather than only hide the chip until the next poll re-adds it.
  const handleRemoveTicker = useCallback(
    async (ticker: string) => {
      const token = await getIdToken();
      if (!token) return;
      try {
        const res = await fetch(`/api/portfolio/${ticker}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          toast.error(`Couldn't remove ${ticker}.`);
          return;
        }
        fetchPortfolio();
      } catch {
        toast.error(`Couldn't remove ${ticker}.`);
      }
    },
    [getIdToken, toast, fetchPortfolio],
  );
```

`toast` and `getIdToken` already exist in this component (`useToast()` at line 38, `useAuth()` at line 37) — do not re-declare them.

Confirm `DELETE /api/portfolio/[ticker]` exists before wiring — it is listed in the route tree. If its handler is missing, stop and report rather than inventing one.

- [ ] **Step 4: Verify the build and the whole suite**

Run: `npm run build && npm test && npm run lint && npx tsc --noEmit`
Expected: build succeeds; **all** suites pass. (The tree has been green since Task 8 — this commit does not "recover" it; it swaps the dashboard's chrome and cards over in one token-migration commit.)

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(dashboard): mount the redesigned dashboard

Moves the screen onto the rd-* tokens in one commit, per the spec: the
old theme's depth cues are subtractive against oklch(0.18), so a
half-migrated card at #07090b reads as a rendering fault rather than as
work in progress.

Loading now renders a skeleton instead of a zeroed portfolio."
```

---

## Task 16: Delete the replaced components and verify

**Files:**
- Delete: `src/components/MetricCard.tsx`, `src/components/PortfolioHeroCard.tsx`, `src/components/AllocationCard.tsx`, `src/components/FailedTickersChip.tsx`

All four are replaced by the new dashboard and were deliberately left in place through Tasks 11–15 so the tree stayed green until `page.tsx` stopped importing them (Task 15).

- [ ] **Step 1: Confirm nothing still imports them**

Run: `grep -rl "MetricCard\|PortfolioHeroCard\|AllocationCard\|FailedTickersChip" src/`
Expected: no output (Task 15 removed the last imports from `page.tsx`). If anything matches, fix that import first — do not delete a file another module still references. In particular confirm `AllocationCard`/`FailedTickersChip` are not imported by `analytics/page.tsx`.

- [ ] **Step 2: Delete**

```bash
git rm src/components/MetricCard.tsx src/components/PortfolioHeroCard.tsx src/components/AllocationCard.tsx src/components/FailedTickersChip.tsx
```

- [ ] **Step 3: Full verification**

```bash
npm test && npm run lint && npx tsc --noEmit && npm run build
```
Expected: all green.

- [ ] **Step 4: Smoke-test the production build at both viewports**

This step is not optional. Plan 1 shipped a mobile overflow bug because every check ran at desktop width.

```bash
npm run build && npm start
```

Then, against `http://localhost:3000/demo` — and `/demo/analytics` to confirm the unmigrated screen still renders:

1. **1440px** — summary card, movers, heat map, allocation strip all render; no console errors.
2. **375px** — `document.documentElement.scrollWidth === clientWidth`. Any horizontal overflow is a defect, not a cosmetic issue.
3. **375px** — the mobile tab control is visible, both tabs are ≥44px, and the active tab reflects the route.
4. **375px** — Sign out (or Sign in under `/demo`) is reachable without a hamburger and is ≥44px.
5. Confirm no `$0.00` frame appears on first paint. Throttle the network in devtools to make the loading state observable.
6. Read the browser console and the server log; both must be clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete the components the dashboard redesign replaced

MetricCard, PortfolioHeroCard, AllocationCard and FailedTickersChip have
no remaining importers once the dashboard is rewired."
```

---

## Done when

- The dashboard renders summary, movers, heat map and allocation strip on `--rd-*` tokens.
- Loading shows a skeleton; **no `$0.00` frame exists at any connection speed**.
- Empty shows two real buttons and a ghost map.
- Failed tickers show an amber inline strip with per-ticker reasons and working Retry/Remove.
- There is no hamburger, and Sign out / Sign in are ≥44px controls in the top bar.
- No horizontal overflow at 375px.
- `/analytics` still renders — the legacy palette is intact and only the dashboard has migrated.
- `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run build` are all clean.

## Watch out for

- **The tree stays GREEN throughout** (corrected from the original plan, which deleted `Navbar` in Task 8 and accepted a red suite). `Navbar` is shared with analytics, so it is not deleted in this plan at all — Task 8 is additive and Task 15 only stops the dashboard from importing it. The token-migration-in-one-commit rule still holds: Task 15 swaps the dashboard's whole render tree over at once.
- **Task 4 is a breaking API change.** Three test files move with it. Fix expectations to match what each mock actually throws rather than loosening assertions.
- `MobileTabs` must stay prefix-aware. Without it every tab under `/demo` renders inactive and the control looks broken.
- `NAV_TABS` deliberately omits Holdings. Plan 3 appends it.
- The mobile "top 10 + aggregate strip" heat map behaviour is plan 3's, because the strip routes to Holdings.
- `portfolioTotals` divides the day change by **yesterday's** value. Do not "simplify" it to divide by today's.
- **Never write a Tailwind opacity modifier on an `rd-` colour.** `bg-rd-warning/10` compiles to nothing in Tailwind 3.4 — no background, no warning, no error. Verified against this repo's own Tailwind binary. Add a dedicated token instead. The same trap applies to every `--rd-*` colour, since they are all plain `var()` strings.
- `MoversCard` is a full rewrite, not an edit. The file keeps its name and exports, so a partial edit will leave percent-ranked logic behind the new markup.

---

## Plan 3 inbox

Carried forward deliberately, so nothing is lost between plans:

1. `/holdings` route + `HoldingsTable` rewrite (ten sortable columns, one shared grid template).
2. The dashboard's 10-row capped holdings table, which depends on 1.
3. `MobileHoldingsList`, nav-aware: 6 rows + "Show all" on Dashboard, all rows + total + sort on Holdings.
4. Mobile heat map: top 10 positions only, remainder as a tappable aggregate strip routing to Holdings.
5. `PositionSheet` as the single position entry point, absorbing `ChipDetail` and gaining Edit/Remove.
6. Append `{ href: "/holdings", label: "Holdings" }` to `NAV_TABS` — the third tab the spec's mobile section calls for.
7. Migrate `analytics/page.tsx` onto `AppShell`/`TopBar`, then delete `Navbar.tsx`, `MobileMenu.tsx`, and `MobileMenu.test.tsx` — deferred out of plan 2 because analytics still renders `Navbar`. (Discovered during plan 2 Task 8: `Navbar` was wrongly assumed dashboard-only.)
