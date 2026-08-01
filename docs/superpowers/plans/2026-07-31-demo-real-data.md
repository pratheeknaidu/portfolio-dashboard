# Demo Real Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public `/demo` show real quotes, real valuations, and a real performance history via three unauthenticated, demo-ticker-locked, server-cached endpoints, with a fixture fallback and deterministic behaviour under `SANDBOX_MODE`.

**Architecture:** Three thin `GET` routes under `src/app/api/demo/` wrap `unstable_cache`-memoised data functions (Next Data Cache for cross-instance dedup + stale-while-revalidate) and set `Cache-Control` for edge caching. The data functions reuse `getQuotes`/`getValuations`/`yahooFinance.chart` — all locked to the fixed `DEMO_TICKERS` — and fall back to the existing mock fixture on any upstream failure. The client demo branch fetches these endpoints instead of building fixtures inline.

**Tech Stack:** Next.js 14 App Router (route handlers, `unstable_cache`), TypeScript, `yahoo-finance2`, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-31-demo-real-data-design.md`

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `src/lib/design/merge-quotes.ts` | Pure `mergeHoldingsWithQuotes(holdings, quotes, range)` → `PortfolioItem[]` (the one merge, shared by authed path, demo fixture, and demo fetch) |
| `src/lib/demo-history.ts` | Pure `portfolioHistory(holdings, closes)` → `Snapshot[]` (Σ shares×close per common date) |
| `src/lib/demo-market-data.ts` | Server-side `demoQuotes(range)`, `demoValuations()`, `demoHistory()` — upstream-or-fixture, allowlist-locked |
| `src/app/api/demo/quotes/route.ts` | Cached, edge-cacheable demo quotes (honours `range`, locks tickers) |
| `src/app/api/demo/valuations/route.ts` | Cached, edge-cacheable demo valuations |
| `src/app/api/demo/history/route.ts` | Cached, edge-cacheable demo history |

**Modify:**

| File | Change |
|---|---|
| `src/lib/demo-data.ts` | Add `DEMO_TICKERS` and `DEMO_YAHOO_SYMBOL`; refactor `buildDemoItems` onto the shared merge |
| `src/lib/use-portfolio-data.ts` | Authed path uses the shared merge; demo branch fetches the demo endpoints |
| `src/app/analytics/page.tsx` | Demo valuations come from `/api/demo/valuations` |
| `__mocks__/yahoo-finance2.ts` | Add `chart: jest.fn()` to the auto-mock |

**Note on the allowlist:** the demo endpoints never read a `tickers` param — the data functions always use `DEMO_TICKERS`, so they cannot be turned into a general Yahoo proxy. `/api/demo/quotes` honours only a validated `range` (a colouring window, not a security surface).

---

## Task 1: Shared holdings×quotes merge

**Files:**
- Create: `src/lib/design/merge-quotes.ts`
- Test: `src/__tests__/lib/design/merge-quotes.test.ts`
- Modify: `src/lib/use-portfolio-data.ts`, `src/lib/demo-data.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { mergeHoldingsWithQuotes } from "@/lib/design/merge-quotes";
import type { Holding, Quote } from "@/types";

const h = (over: Partial<Holding> = {}): Holding => ({
  ticker: "AAPL", companyName: "Apple Inc.", sector: "Technology",
  shares: 10, avgCost: 100, addedAt: "2026-01-02T00:00:00.000Z", ...over,
});
const q = (over: Partial<Quote> = {}): Quote => ({
  price: 150, change: 2, changePercent: 1.35, previousClose: 148, ...over,
});

describe("mergeHoldingsWithQuotes", () => {
  it("computes market value, P&L, and P&L percent from shares and cost", () => {
    const [item] = mergeHoldingsWithQuotes([h()], { AAPL: q() }, "1D");
    expect(item.marketValue).toBe(1500);
    expect(item.totalPL).toBe(500);
    expect(item.totalPLPercent).toBeCloseTo(50, 5);
  });

  it("drops holdings with no quote", () => {
    expect(mergeHoldingsWithQuotes([h()], {}, "1D")).toEqual([]);
  });

  it("in ALL range, rewrites change to lifetime move off cost basis", () => {
    const [item] = mergeHoldingsWithQuotes([h({ avgCost: 100 })], { AAPL: q({ price: 150 }) }, "ALL");
    expect(item.quote.change).toBe(50);
    expect(item.quote.changePercent).toBeCloseTo(50, 5);
  });

  it("in non-ALL range, leaves the quote's own change untouched", () => {
    const [item] = mergeHoldingsWithQuotes([h()], { AAPL: q({ change: 2, changePercent: 1.35 }) }, "1D");
    expect(item.quote.change).toBe(2);
    expect(item.quote.changePercent).toBe(1.35);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/__tests__/lib/design/merge-quotes.test.ts`
Expected: FAIL — `Cannot find module '@/lib/design/merge-quotes'`.

- [ ] **Step 3: Implement the helper**

Create `src/lib/design/merge-quotes.ts`:

```ts
import type { Holding, PortfolioItem, Quote, TimeRange } from "@/types";

/**
 * Merge holdings with their quotes into the PortfolioItem shape the UI renders.
 * The single copy of this logic: the authenticated fetch, the offline demo
 * fixture, and the live demo fetch all go through here so they cannot drift.
 *
 * In the "ALL" range the tile's `change` is the lifetime move off cost basis,
 * not the day move, so the treemap and the range pill agree.
 */
export function mergeHoldingsWithQuotes(
  holdings: Holding[],
  quotes: Record<string, Quote>,
  range: TimeRange,
): PortfolioItem[] {
  return holdings
    .filter((h) => quotes[h.ticker])
    .map((h) => {
      const q = quotes[h.ticker];
      const marketValue = h.shares * q.price;
      const costBasis = h.shares * h.avgCost;
      const totalPL = marketValue - costBasis;
      const totalPLPercent = (totalPL / costBasis) * 100;
      const quote: Quote =
        range === "ALL"
          ? { ...q, change: q.price - h.avgCost, changePercent: totalPLPercent }
          : q;
      return { ...h, quote, marketValue, totalPL, totalPLPercent };
    });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/__tests__/lib/design/merge-quotes.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Refactor the two existing call sites onto the helper**

In `src/lib/use-portfolio-data.ts`, add the import near the top:

```ts
import { mergeHoldingsWithQuotes } from "@/lib/design/merge-quotes";
```

Replace the inline merge block (the `const merged: PortfolioItem[] = holdings.filter(...).map(...)` assignment, currently lines ~109-124) with:

```ts
      const merged = mergeHoldingsWithQuotes(holdings, quotes, range);
```

In `src/lib/demo-data.ts`, add the import:

```ts
import { mergeHoldingsWithQuotes } from "@/lib/design/merge-quotes";
```

Replace the body of `buildDemoItems` after the `quotes` line with:

```ts
export function buildDemoItems(range: TimeRange = "1D"): PortfolioItem[] {
  const tickers = DEMO_HOLDINGS.map((h) => h.ticker);
  const quotes = getMockQuotes(tickers, range === "ALL" ? "1D" : range);
  return mergeHoldingsWithQuotes(DEMO_HOLDINGS, quotes, range);
}
```

- [ ] **Step 6: Run the full suite to verify no regression**

Run: `npm test && npx tsc --noEmit`
Expected: all green (the existing `use-portfolio-data` and `demo-data` tests still pass — behaviour is unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/lib/design/merge-quotes.ts src/__tests__/lib/design/merge-quotes.test.ts src/lib/use-portfolio-data.ts src/lib/demo-data.ts
git commit -m "refactor: extract the shared holdings-with-quotes merge

One copy of the market-value/P&L merge, used by the authenticated fetch
and the demo fixture, so the live demo fetch can reuse it too."
```

---

## Task 2: Demo tickers, symbol map, and pure history math

**Files:**
- Modify: `src/lib/demo-data.ts`
- Create: `src/lib/demo-history.ts`
- Test: `src/__tests__/lib/demo-history.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { portfolioHistory, type TickerCloses } from "@/lib/demo-history";
import type { Holding } from "@/types";

const h = (ticker: string, shares: number): Holding => ({
  ticker, companyName: `${ticker} Inc.`, sector: "Technology",
  shares, avgCost: 100, addedAt: "2026-01-02T00:00:00.000Z",
});

describe("portfolioHistory", () => {
  it("sums shares x close per date across holdings", () => {
    const closes: TickerCloses = {
      AAA: [{ date: "2026-07-01", close: 10 }, { date: "2026-07-02", close: 12 }],
      BBB: [{ date: "2026-07-01", close: 20 }, { date: "2026-07-02", close: 25 }],
    };
    const series = portfolioHistory([h("AAA", 2), h("BBB", 1)], closes);
    // 2026-07-01: 2*10 + 1*20 = 40; 2026-07-02: 2*12 + 1*25 = 49
    expect(series).toEqual([
      { date: "2026-07-01", totalValue: 40, holdings: {} },
      { date: "2026-07-02", totalValue: 49, holdings: {} },
    ]);
  });

  it("includes only dates every holding has a close for (no partial totals)", () => {
    const closes: TickerCloses = {
      AAA: [{ date: "2026-07-01", close: 10 }, { date: "2026-07-02", close: 12 }],
      BBB: [{ date: "2026-07-01", close: 20 }],
    };
    const series = portfolioHistory([h("AAA", 1), h("BBB", 1)], closes);
    expect(series.map((s) => s.date)).toEqual(["2026-07-01"]);
  });

  it("returns dates ascending regardless of input order", () => {
    const closes: TickerCloses = {
      AAA: [{ date: "2026-07-03", close: 3 }, { date: "2026-07-01", close: 1 }],
    };
    const series = portfolioHistory([h("AAA", 1)], closes);
    expect(series.map((s) => s.date)).toEqual(["2026-07-01", "2026-07-03"]);
  });

  it("returns empty for no holdings or missing closes", () => {
    expect(portfolioHistory([], {})).toEqual([]);
    expect(portfolioHistory([h("AAA", 1)], {})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/__tests__/lib/demo-history.test.ts`
Expected: FAIL — `Cannot find module '@/lib/demo-history'`.

- [ ] **Step 3: Implement**

Create `src/lib/demo-history.ts`:

```ts
import type { Holding, Snapshot } from "@/types";

export interface TickerCloses {
  [ticker: string]: { date: string; close: number }[];
}

/**
 * Portfolio value per day = Σ shares × close, over the dates for which EVERY
 * holding has a close (so a total is never partial). This reconstructs, from
 * real historical prices, exactly the series a real account holding these fixed
 * positions would have accumulated day by day.
 */
export function portfolioHistory(holdings: Holding[], closes: TickerCloses): Snapshot[] {
  if (holdings.length === 0) return [];

  const byTicker = new Map<string, Map<string, number>>();
  for (const h of holdings) {
    const m = new Map<string, number>();
    for (const c of closes[h.ticker] ?? []) m.set(c.date, c.close);
    byTicker.set(h.ticker, m);
  }

  const spine = byTicker.get(holdings[0].ticker);
  if (!spine || spine.size === 0) return [];

  const dates = [...spine.keys()]
    .filter((date) => holdings.every((h) => byTicker.get(h.ticker)!.has(date)))
    .sort();

  return dates.map((date) => ({
    date,
    totalValue: Math.round(
      holdings.reduce((sum, h) => sum + h.shares * byTicker.get(h.ticker)!.get(date)!, 0),
    ),
    holdings: {},
  }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/__tests__/lib/demo-history.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add `DEMO_TICKERS` and `DEMO_YAHOO_SYMBOL` to `src/lib/demo-data.ts`**

Directly after the `DEMO_HOLDINGS` array declaration, add:

```ts
/** Allowlist for the demo endpoints — the only tickers they will ever fetch. */
export const DEMO_TICKERS: string[] = DEMO_HOLDINGS.map((h) => h.ticker);

/**
 * Yahoo symbols for demo tickers whose display ticker is not the Yahoo symbol.
 * The demo set is fixed, so the one class-share exception is hard-mapped rather
 * than resolved at runtime. Anything not listed uses its ticker as-is.
 */
export const DEMO_YAHOO_SYMBOL: Record<string, string> = { BRK: "BRK-B" };
```

- [ ] **Step 6: Verify types**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/demo-history.ts src/__tests__/lib/demo-history.test.ts src/lib/demo-data.ts
git commit -m "feat(demo): ticker allowlist and pure portfolio-history math

DEMO_TICKERS locks what the demo endpoints may fetch; portfolioHistory
sums shares x historical close per common date into the snapshot series."
```

---

## Task 3: Demo market-data functions (upstream-or-fixture)

**Files:**
- Create: `src/lib/demo-market-data.ts`
- Modify: `__mocks__/yahoo-finance2.ts`
- Test: `src/__tests__/lib/demo-market-data.test.ts`

- [ ] **Step 1: Add `chart` to the yahoo-finance2 auto-mock**

In `__mocks__/yahoo-finance2.ts`, add a `chart: jest.fn()` entry alongside the existing `quote`/`quoteSummary` mocks (so `demoHistory` can control chart output in tests). Example (match the file's existing export shape):

```ts
const yahooFinance = {
  quote: jest.fn(),
  quoteSummary: jest.fn(),
  chart: jest.fn(),
  // ...any other existing entries unchanged
};
```

- [ ] **Step 2: Write the failing test**

```ts
import { demoQuotes, demoValuations, demoHistory } from "@/lib/demo-market-data";
import { DEMO_TICKERS } from "@/lib/demo-data";
import { getQuotes } from "@/lib/yahoo-finance";
import { getValuations } from "@/lib/yahoo-finance-valuations";
import yahooFinance from "yahoo-finance2";

jest.mock("@/lib/yahoo-finance", () => ({ getQuotes: jest.fn() }));
jest.mock("@/lib/yahoo-finance-valuations", () => ({ getValuations: jest.fn() }));

const mockGetQuotes = getQuotes as jest.Mock;
const mockGetValuations = getValuations as jest.Mock;
const mockChart = yahooFinance.chart as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.SANDBOX_MODE;
});

describe("demoQuotes", () => {
  it("fetches only the demo tickers", async () => {
    mockGetQuotes.mockResolvedValue({ quotes: { AAPL: {} }, failed: [] });
    await demoQuotes("1D");
    expect(mockGetQuotes).toHaveBeenCalledWith(DEMO_TICKERS, "1D");
  });

  it("falls back to mock quotes when the upstream throws", async () => {
    mockGetQuotes.mockRejectedValue(new Error("yahoo down"));
    const res = await demoQuotes("1D");
    expect(Object.keys(res.quotes).length).toBe(DEMO_TICKERS.length);
    expect(res.failed).toEqual([]);
  });
});

describe("demoValuations", () => {
  it("falls back to the fixture when the upstream throws", async () => {
    mockGetValuations.mockRejectedValue(new Error("yahoo down"));
    const res = await demoValuations();
    expect(Object.keys(res).length).toBe(DEMO_TICKERS.length);
  });
});

describe("demoHistory", () => {
  it("returns the synthetic fixture under SANDBOX_MODE without calling chart", async () => {
    process.env.SANDBOX_MODE = "true";
    const res = await demoHistory();
    expect(mockChart).not.toHaveBeenCalled();
    expect(res.length).toBeGreaterThan(0);
  });

  it("computes the series from chart closes when upstream succeeds", async () => {
    // Must be >= MIN_HISTORY_POINTS (5) dates, or demoHistory falls back to the
    // fixture. Every ticker returns the same closes, so all dates survive.
    const dates = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-06", "2026-07-07"];
    mockChart.mockResolvedValue({
      quotes: dates.map((d, i) => ({ date: new Date(d), close: 10 + i })),
    });
    const res = await demoHistory();
    expect(res.map((s) => s.date)).toEqual(dates);
    expect(res[0].totalValue).toBeGreaterThan(0);
  });

  it("falls back to the fixture when chart throws", async () => {
    mockChart.mockRejectedValue(new Error("yahoo down"));
    const res = await demoHistory();
    expect(res.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- src/__tests__/lib/demo-market-data.test.ts`
Expected: FAIL — `Cannot find module '@/lib/demo-market-data'`.

- [ ] **Step 4: Implement**

Create `src/lib/demo-market-data.ts`:

```ts
import yahooFinance from "yahoo-finance2";
import { getQuotes, type QuotesResult } from "@/lib/yahoo-finance";
import { getValuations } from "@/lib/yahoo-finance-valuations";
import { getMockQuotes } from "@/lib/yahoo-finance-mock";
import {
  DEMO_HOLDINGS,
  DEMO_TICKERS,
  DEMO_YAHOO_SYMBOL,
  DEMO_SNAPSHOTS,
  getDemoValuations,
} from "@/lib/demo-data";
import { portfolioHistory, type TickerCloses } from "@/lib/demo-history";
import type { Snapshot, TimeRange, ValuationData } from "@/types";

/** ~90 trading days of history; fetch a wider calendar window to cover it. */
const HISTORY_LOOKBACK_DAYS = 130;
const MIN_HISTORY_POINTS = 5;

/** Live quotes for the fixed demo set, or the mock fixture on any failure. */
export async function demoQuotes(range: TimeRange): Promise<QuotesResult> {
  try {
    return await getQuotes(DEMO_TICKERS, range);
  } catch {
    return { quotes: getMockQuotes(DEMO_TICKERS, range), failed: [] };
  }
}

/** Live valuations for the fixed demo set, or the fixture on any failure. */
export async function demoValuations(): Promise<Record<string, ValuationData>> {
  try {
    return await getValuations(DEMO_TICKERS);
  } catch {
    return getDemoValuations();
  }
}

/**
 * Real ~90-day performance history: Σ shares × historical close per day. Under
 * SANDBOX_MODE (and on any upstream failure or too-sparse result) it returns
 * the synthetic fixture, so sandbox/tests stay deterministic and the public
 * demo never renders an empty chart.
 */
export async function demoHistory(): Promise<Snapshot[]> {
  if (process.env.SANDBOX_MODE === "true") return DEMO_SNAPSHOTS;
  try {
    const period1 = new Date(Date.now() - HISTORY_LOOKBACK_DAYS * 86_400_000);
    const closes: TickerCloses = {};
    await Promise.all(
      DEMO_HOLDINGS.map(async (h) => {
        const symbol = DEMO_YAHOO_SYMBOL[h.ticker] ?? h.ticker;
        const chart = await yahooFinance.chart(symbol, { period1 });
        closes[h.ticker] = chart.quotes
          .filter((q) => q.close != null && q.date != null)
          .map((q) => ({
            date: new Date(q.date).toISOString().split("T")[0],
            close: q.close as number,
          }));
      }),
    );
    const series = portfolioHistory(DEMO_HOLDINGS, closes);
    return series.length >= MIN_HISTORY_POINTS ? series : DEMO_SNAPSHOTS;
  } catch {
    return DEMO_SNAPSHOTS;
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- src/__tests__/lib/demo-market-data.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/demo-market-data.ts __mocks__/yahoo-finance2.ts src/__tests__/lib/demo-market-data.test.ts
git commit -m "feat(demo): market-data functions with fixture fallback

demoQuotes/demoValuations/demoHistory serve the fixed demo set from real
Yahoo, falling back to the mock fixture on any failure and under
SANDBOX_MODE so sandbox and tests stay deterministic."
```

---

## Task 4: Demo quotes and valuations routes

**Files:**
- Create: `src/app/api/demo/quotes/route.ts`, `src/app/api/demo/valuations/route.ts`
- Test: `src/__tests__/api/demo-quotes.test.ts`, `src/__tests__/api/demo-valuations.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/__tests__/api/demo-quotes.test.ts`:

```ts
import { GET } from "@/app/api/demo/quotes/route";
import { demoQuotes } from "@/lib/demo-market-data";
import { NextRequest } from "next/server";

// unstable_cache passes through in tests so we exercise the handler directly.
jest.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
jest.mock("@/lib/demo-market-data", () => ({ demoQuotes: jest.fn() }));

const mockDemoQuotes = demoQuotes as jest.Mock;
const req = (url: string) => new NextRequest(new URL(url, "http://localhost"));

beforeEach(() => {
  jest.clearAllMocks();
  mockDemoQuotes.mockResolvedValue({ quotes: { AAPL: { price: 1 } }, failed: [] });
});

describe("GET /api/demo/quotes", () => {
  it("returns the demo quotes as JSON with an edge cache header", async () => {
    const res = await GET(req("/api/demo/quotes"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ quotes: { AAPL: { price: 1 } }, failed: [] });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
  });

  it("passes a valid range through to the data function", async () => {
    await GET(req("/api/demo/quotes?range=1M"));
    expect(mockDemoQuotes).toHaveBeenCalledWith("1M");
  });

  it("defaults an invalid range to 1D", async () => {
    await GET(req("/api/demo/quotes?range=bogus"));
    expect(mockDemoQuotes).toHaveBeenCalledWith("1D");
  });

  it("ignores a tickers param entirely (allowlist is enforced in the data fn)", async () => {
    await GET(req("/api/demo/quotes?tickers=EVIL"));
    // The handler never forwards tickers; demoQuotes is called with only a range.
    expect(mockDemoQuotes).toHaveBeenCalledWith("1D");
  });
});
```

`src/__tests__/api/demo-valuations.test.ts`:

```ts
import { GET } from "@/app/api/demo/valuations/route";
import { demoValuations } from "@/lib/demo-market-data";

jest.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
jest.mock("@/lib/demo-market-data", () => ({ demoValuations: jest.fn() }));

const mockDemoValuations = demoValuations as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockDemoValuations.mockResolvedValue({ AAPL: { recommendationKey: "buy" } });
});

describe("GET /api/demo/valuations", () => {
  it("returns the demo valuations as JSON with an edge cache header", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ AAPL: { recommendationKey: "buy" } });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=21600");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- src/__tests__/api/demo-quotes.test.ts src/__tests__/api/demo-valuations.test.ts`
Expected: FAIL — cannot find the route modules.

- [ ] **Step 3: Implement the routes**

Create `src/app/api/demo/quotes/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { demoQuotes } from "@/lib/demo-market-data";
import type { TimeRange } from "@/types";

const RANGES = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"];

// Data Cache: one shared upstream fetch per range per 60s across all instances,
// with stale-while-revalidate (the argument `range` is part of the cache key).
const cachedDemoQuotes = unstable_cache(
  (range: TimeRange) => demoQuotes(range),
  ["demo-quotes"],
  { revalidate: 60 },
);

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("range") ?? "1D";
  const range = (RANGES.includes(raw) ? raw : "1D") as TimeRange;
  const data = await cachedDemoQuotes(range);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" },
  });
}
```

Create `src/app/api/demo/valuations/route.ts`:

```ts
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { demoValuations } from "@/lib/demo-market-data";

const cachedDemoValuations = unstable_cache(demoValuations, ["demo-valuations"], {
  revalidate: 21_600, // 6h — valuations move slowly
});

export async function GET() {
  const data = await cachedDemoValuations();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
  });
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test -- src/__tests__/api/demo-quotes.test.ts src/__tests__/api/demo-valuations.test.ts`
Expected: PASS (4 + 1 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/demo/quotes src/app/api/demo/valuations src/__tests__/api/demo-quotes.test.ts src/__tests__/api/demo-valuations.test.ts
git commit -m "feat(demo): cached quotes and valuations endpoints

Unauthenticated, demo-locked routes wrapping the data functions in
unstable_cache with edge Cache-Control. Quotes honour a validated range;
neither reads a tickers param."
```

---

## Task 5: Demo history route

**Files:**
- Create: `src/app/api/demo/history/route.ts`
- Test: `src/__tests__/api/demo-history.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { GET } from "@/app/api/demo/history/route";
import { demoHistory } from "@/lib/demo-market-data";

jest.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
jest.mock("@/lib/demo-market-data", () => ({ demoHistory: jest.fn() }));

const mockDemoHistory = demoHistory as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockDemoHistory.mockResolvedValue([{ date: "2026-07-01", totalValue: 1000, holdings: {} }]);
});

describe("GET /api/demo/history", () => {
  it("returns the snapshot series as JSON with an edge cache header", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ date: "2026-07-01", totalValue: 1000, holdings: {} }]);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=86400");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/__tests__/api/demo-history.test.ts`
Expected: FAIL — cannot find the route module.

- [ ] **Step 3: Implement**

Create `src/app/api/demo/history/route.ts`:

```ts
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { demoHistory } from "@/lib/demo-market-data";

const cachedDemoHistory = unstable_cache(demoHistory, ["demo-history"], {
  revalidate: 86_400, // daily — the series only gains one point per trading day
});

export async function GET() {
  const data = await cachedDemoHistory();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" },
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/__tests__/api/demo-history.test.ts`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/demo/history src/__tests__/api/demo-history.test.ts
git commit -m "feat(demo): cached history endpoint

Serves the real ~90-day performance series, revalidated daily, edge-cached."
```

---

## Task 6: Rewire the client demo branch to the endpoints

**Files:**
- Modify: `src/lib/use-portfolio-data.ts`
- Test: `src/__tests__/lib/use-portfolio-data.test.tsx`

Read the existing test first for its harness (mocked auth/toast/demo-context/market-hours/demo-data, a `stubFetch` that routes by URL, `renderHook`/`waitFor`). Mirror it.

- [ ] **Step 1: Update the demo-mode test**

In `src/__tests__/lib/use-portfolio-data.test.tsx`, the current demo test asserts the hook does NOT fetch. Replace that test (the one stubbing `{}` and asserting `fetchMock` was not called) with one that asserts the demo branch fetches the demo endpoints and merges. Add, using the file's existing `stubFetch`/`render` helpers and the `isDemo` toggle:

```ts
it("in demo mode, fetches the demo endpoints and merges real quotes", async () => {
  isDemo = true;
  const fetchMock = jest.fn(async (url: string) => {
    if (url.startsWith("/api/demo/quotes")) {
      return { ok: true, json: async () => ({ quotes: { AAPL: quote({ price: 110 }) }, failed: [] }) };
    }
    if (url.startsWith("/api/demo/history")) {
      return { ok: true, json: async () => [{ date: "2026-07-01", totalValue: 1234, holdings: {} }] };
    }
    return { ok: false, json: async () => ({}) };
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  // DEMO_HOLDINGS is mocked in this file's jest.mock("@/lib/demo-data", ...);
  // ensure that mock also exports DEMO_HOLDINGS with an AAPL holding and
  // mergeHoldingsWithQuotes is the real implementation (not mocked).
  const { result } = render("1D");
  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(result.current.items[0].ticker).toBe("AAPL");
  expect(result.current.snapshots[0].totalValue).toBe(1234);
});
```

Extend this file's `jest.mock("@/lib/demo-data", ...)` factory to also export `DEMO_HOLDINGS` (an array with one `AAPL` holding matching the `holding()` fixture) so the merge produces an item. Keep `buildDemoItems` and `DEMO_SNAPSHOTS` exports for the fallback path.

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/__tests__/lib/use-portfolio-data.test.tsx`
Expected: FAIL — demo branch still calls `buildDemoItems`, never fetches.

- [ ] **Step 3: Implement the demo branch**

In `src/lib/use-portfolio-data.ts`, add `DEMO_HOLDINGS` to the demo-data import:

```ts
import { buildDemoItems, DEMO_HOLDINGS, DEMO_SNAPSHOTS } from "@/lib/demo-data";
```

Replace the demo branch inside `refresh` (the `if (isDemo) { ... }` block) with:

```ts
    if (isDemo) {
      try {
        const [qRes, hRes] = await Promise.all([
          fetch(`/api/demo/quotes?range=${range}`),
          fetch(`/api/demo/history`),
        ]);
        const { quotes } = await qRes.json();
        const items = mergeHoldingsWithQuotes(DEMO_HOLDINGS, quotes, range);
        setItems(items);
        setSnapshots(hRes.ok ? await hRes.json() : []);
        setFailed([]);
        setExcludedValue(0);
        setStatus(items.length === 0 ? "empty" : "ready");
      } catch {
        // The endpoints already fall back to the fixture server-side; this
        // second net covers a network error reaching our own API, so the demo
        // still renders offline.
        setItems(buildDemoItems(range));
        setSnapshots(DEMO_SNAPSHOTS);
        setFailed([]);
        setExcludedValue(0);
        setStatus("ready");
      }
      return;
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/__tests__/lib/use-portfolio-data.test.tsx`
Expected: PASS (the new demo test plus the unchanged authed-path tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/use-portfolio-data.ts src/__tests__/lib/use-portfolio-data.test.tsx
git commit -m "feat(demo): fetch live quotes and history in the demo branch

The demo branch now pulls /api/demo/quotes and /api/demo/history and
merges via the shared helper, falling back to the offline fixture only if
the request to our own API fails."
```

---

## Task 7: Rewire the Analytics demo valuations fetch

**Files:**
- Modify: `src/app/analytics/page.tsx`
- Test: `src/__tests__/app/analytics-demo-valuations.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, waitFor } from "@testing-library/react";
import AnalyticsPage from "@/app/analytics/page";
import type { PortfolioItem } from "@/types";

const items: PortfolioItem[] = [{
  ticker: "AAA", companyName: "AAA Inc.", sector: "Technology", shares: 10, avgCost: 100,
  addedAt: "2026-01-02T00:00:00.000Z",
  quote: { price: 110, change: 1, changePercent: 0.9, previousClose: 109 },
  marketValue: 1100, totalPL: 100, totalPLPercent: 10,
}];

jest.mock("@/lib/use-portfolio-data", () => ({
  usePortfolioData: () => ({ items, failed: [], status: "ready", snapshots: [], excludedValue: 0, refresh: jest.fn() }),
}));
jest.mock("@/lib/demo-context", () => ({ useIsDemo: () => true }));
jest.mock("@/components/AuthGuard", () => ({ AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ getIdToken: async () => "t", signOut: jest.fn() }) }));
jest.mock("@/lib/toast-context", () => ({ useToast: () => ({ error: jest.fn(), info: jest.fn(), success: jest.fn(), show: jest.fn(), dismiss: jest.fn(), toasts: [] }) }));
jest.mock("next/navigation", () => ({ usePathname: () => "/demo/analytics" }));
jest.mock("@/components/AnalystSentimentCard", () => ({ AnalystSentimentCard: () => <div data-testid="analyst" /> }));
jest.mock("@/components/ValuationCard", () => ({ ValuationCard: () => <div data-testid="valuation" /> }));
jest.mock("@/components/PerformanceCard", () => ({ PerformanceCard: () => <div data-testid="performance" /> }));

describe("AnalyticsPage demo valuations", () => {
  it("fetches /api/demo/valuations in demo mode", async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ AAA: { recommendationKey: "buy" } }) }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<AnalyticsPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/demo/valuations"));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/__tests__/app/analytics-demo-valuations.test.tsx`
Expected: FAIL — demo mode currently calls `getDemoValuations()` and never fetches.

- [ ] **Step 3: Implement**

In `src/app/analytics/page.tsx`, replace the `if (isDemo)` branch inside `fetchValuations` with a fetch of the demo endpoint, keeping the fixture as the fallback:

```ts
    if (isDemo) {
      try {
        const res = await fetch(`/api/demo/valuations`);
        setValuations(res.ok ? await res.json() : getDemoValuations());
      } catch {
        setValuations(getDemoValuations());
      }
      return;
    }
```

`getDemoValuations` is already imported; keep the import.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/__tests__/app/analytics-demo-valuations.test.tsx`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/app/analytics/page.tsx src/__tests__/app/analytics-demo-valuations.test.tsx
git commit -m "feat(demo): fetch live valuations on the demo Analytics screen

Demo mode pulls /api/demo/valuations, falling back to the fixture on
failure; the authenticated path is unchanged."
```

---

## Task 8: Verify the whole feature

**Files:** none (verification only).

- [ ] **Step 1: Full green**

Run: `npm test && npm run lint && npx tsc --noEmit && npm run build`
Expected: all pass; the build lists `/api/demo/quotes`, `/api/demo/valuations`, `/api/demo/history` as routes.

- [ ] **Step 2: Sandbox determinism check**

Run: `SANDBOX_MODE=true npm test` is already covered, but confirm the demo endpoints are deterministic under sandbox by running the demo-market-data suite with the flag:

Run: `SANDBOX_MODE=true npm test -- src/__tests__/lib/demo-market-data.test.ts`
Expected: PASS — `demoQuotes`/`demoValuations` return mocks, `demoHistory` returns the synthetic fixture, no network.

- [ ] **Step 3: Production-build smoke test (dev server OFF)**

Build, start the production server with the dev server off, and load `/demo`, `/demo/holdings`, `/demo/analytics`:
1. Network panel shows `/api/demo/quotes`, `/api/demo/history`, `/api/demo/valuations` returning 200 with a `Cache-Control` header carrying `s-maxage`.
2. The heat map, holdings values, and Analytics cards render with real (non-fixture) numbers when the machine has network; if Yahoo is unreachable the demo still renders (fixture fallback), never an error state.
3. A second load within 60s is served from cache (no new upstream Yahoo call — the response is near-instant and identical).
4. Console and server logs clean on every screen.

- [ ] **Step 4: Commit any fixes the smoke test surfaces, then stop.**

---

## Done when

- `/demo` shows real quotes, real valuations, and a real ~90-day history, with the curated holdings unchanged.
- The three endpoints are unauthenticated, locked to `DEMO_TICKERS`, cached (Data Cache + edge), and fall back to the fixture on failure.
- `SANDBOX_MODE` and the whole test suite stay deterministic.
- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` all clean.

## Watch out for

- **`BRK` needs its Yahoo symbol** (`BRK-B`) — `DEMO_YAHOO_SYMBOL` handles it; a bare `BRK` chart call would fail and (via the all-tickers-present rule) could collapse the history to the fixture.
- **`unstable_cache` in tests** — mock `next/cache` to pass through (`{ unstable_cache: (fn) => fn }`) so route tests exercise the handler directly.
- **The allowlist is enforced in the data functions**, not the routes — the routes never read a `tickers` param. Keep it that way.
- **Fixture fallback must never throw** — every endpoint has to degrade to the fixture rather than 5xx, because the public demo must always render.
- **Don't touch the authenticated paths' behaviour** — Task 1's refactor is behaviour-preserving; the existing route/hook tests are the guard.
