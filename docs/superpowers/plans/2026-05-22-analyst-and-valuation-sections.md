# Analyst Sentiment + Valuation Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two bucketed-chip cards to `/analytics` — Analyst Sentiment (Strong Buy → Strong Sell) and Valuation (Deep Value → Overvalued) — powered by a new Yahoo Finance valuations helper and `/api/valuations` route.

**Architecture:** A new `getValuations(tickers)` server helper wraps `yahooFinance.insights()` + `yahooFinance.quoteSummary(symbol, { modules: ['financialData'] })` with `Promise.allSettled` + 60s in-memory cache + `SANDBOX_MODE` short-circuit. A new `/api/valuations` route exposes it under the existing `verifyRequest` auth pattern. Client-side, `/analytics/page.tsx` fetches the data alongside `/api/portfolio` and `/api/quotes`, then passes it to two new components that handle bucketing + sorting + rendering. **All bucketing happens client-side** so threshold tweaks don't require a redeploy.

**Tech Stack:** Next.js 14 App Router, TypeScript, `yahoo-finance2`, React (client components), Tailwind (existing `--positive` / `--negative` oklch tokens), Jest + Testing Library, `firebase-admin` (via lazy Proxy in `src/lib/firebase-admin.ts`).

**Spec reference:** [docs/superpowers/specs/2026-05-22-analyst-and-valuation-sections-design.md](../specs/2026-05-22-analyst-and-valuation-sections-design.md)

---

## Pre-flight

Confirm baseline before starting:

- [ ] Run `npm test` and confirm all suites pass on `feat/dashboard-redesign`.
- [ ] Run `npm run lint` and confirm clean.
- [ ] Verify branch: `git branch --show-current` → `feat/dashboard-redesign`.

If any of the above fails, stop and surface the failure — the plan assumes a green baseline.

---

### Task 1: Add `ValuationData` types

**Files:**
- Modify: `src/types/index.ts`

Pure type addition — no test required (types are checked by `tsc` via `next build` / IDE).

- [ ] **Step 1: Append the type to `src/types/index.ts`**

Add at the bottom of the file (after the existing `AnalyticsRange` type):

```ts
export type RecommendationKey =
  | "strong_buy"
  | "buy"
  | "hold"
  | "sell"
  | "strong_sell"
  | "underperform";

export interface ValuationData {
  // Card 1 (Analyst Sentiment)
  recommendationKey?: RecommendationKey;
  recommendationMean?: number;       // 1.0 strongest buy → 5.0 strongest sell
  numberOfAnalystOpinions?: number;  // surfaced in tooltip only

  // Card 2 (Valuation)
  fairValueDescription?: "Undervalued" | "Near Fair Value" | "Overvalued";
  fairValueDiscountPct?: number;     // signed %; positive = below fair value
  fairValueProvider?: string;        // e.g. "Trading Central"
  targetMeanPrice?: number;
  currentPrice?: number;             // included so client can verify upside calc
  upsideToTargetPct?: number;        // (target - current) / current * 100

  valuationSource: "fair_value" | "analyst_target" | "both" | "none";
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS, no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add ValuationData type for analyst + valuation cards"
```

---

### Task 2: `parseFairValueDiscount` parser + tests

**Files:**
- Create: `src/lib/yahoo-finance-valuations.ts` (stub)
- Create: `src/__tests__/lib/yahoo-finance-valuations.test.ts`

The parser is the simplest piece — start here so the file exists for later tasks.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/yahoo-finance-valuations.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { parseFairValueDiscount } from "@/lib/yahoo-finance-valuations";

describe("parseFairValueDiscount", () => {
  it("parses signed percent strings", () => {
    expect(parseFairValueDiscount("-17%")).toBe(-17);
    expect(parseFairValueDiscount("+47%")).toBe(47);
    expect(parseFairValueDiscount("16%")).toBe(16);
    expect(parseFairValueDiscount("0%")).toBe(0);
  });

  it("handles whitespace and decimal values", () => {
    expect(parseFairValueDiscount(" -7.5% ")).toBe(-7.5);
  });

  it("returns undefined for empty or malformed input", () => {
    expect(parseFairValueDiscount("")).toBeUndefined();
    expect(parseFairValueDiscount(undefined)).toBeUndefined();
    expect(parseFairValueDiscount("not a number")).toBeUndefined();
    expect(parseFairValueDiscount("%")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/yahoo-finance-valuations.test.ts`
Expected: FAIL — cannot resolve `@/lib/yahoo-finance-valuations`.

- [ ] **Step 3: Create the stub file with the parser**

Create `src/lib/yahoo-finance-valuations.ts`:

```ts
export function parseFairValueDiscount(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const match = trimmed.match(/^([+-]?\d+(?:\.\d+)?)\s*%$/);
  if (!match) return undefined;
  const n = parseFloat(match[1]);
  return Number.isFinite(n) ? n : undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/yahoo-finance-valuations.test.ts`
Expected: PASS — 3 specs in `parseFairValueDiscount`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/yahoo-finance-valuations.ts src/__tests__/lib/yahoo-finance-valuations.test.ts
git commit -m "feat(valuations): add parseFairValueDiscount with tests"
```

---

### Task 3: `getValuations` core (no cache, no sandbox)

**Files:**
- Modify: `src/lib/yahoo-finance-valuations.ts`
- Modify: `src/__tests__/lib/yahoo-finance-valuations.test.ts`

Implement the per-ticker fetch + normalization. Cache and sandbox come in later tasks to keep diffs small.

- [ ] **Step 1: Write the failing tests**

At the **top** of `src/__tests__/lib/yahoo-finance-valuations.test.ts` (above the existing import), add the yahoo-finance2 mock — mirrors the pattern in `src/__tests__/lib/yahoo-finance.test.ts`:

```ts
jest.mock("yahoo-finance2", () => {
  const insights = jest.fn();
  const quoteSummary = jest.fn();
  return {
    __esModule: true,
    default: jest.fn(() => ({ insights, quoteSummary })),
  };
});

import YahooFinance from "yahoo-finance2";
```

Then below the existing `parseFairValueDiscount` describe block, append:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { insights: mockInsights, quoteSummary: mockQuoteSummary } = new (YahooFinance as any)() as {
  insights: jest.Mock;
  quoteSummary: jest.Mock;
};

// Helper builders so tests stay readable.
function buildInsights(opts: { description?: string; discount?: string; provider?: string } = {}) {
  return {
    symbol: "AAPL",
    instrumentInfo: {
      valuation: {
        description: opts.description,
        discount: opts.discount,
        provider: opts.provider ?? "Trading Central",
      },
    },
  };
}

function buildFinancialData(opts: {
  recommendationKey?: string;
  recommendationMean?: number;
  targetMeanPrice?: number;
  currentPrice?: number;
  numberOfAnalystOpinions?: number;
} = {}) {
  return {
    financialData: {
      recommendationKey: opts.recommendationKey,
      recommendationMean: opts.recommendationMean,
      targetMeanPrice: opts.targetMeanPrice,
      currentPrice: opts.currentPrice,
      numberOfAnalystOpinions: opts.numberOfAnalystOpinions,
    },
  };
}

describe("getValuations", () => {
  beforeEach(() => {
    const { clearCache } = jest.requireActual("@/lib/yahoo-finance-valuations") as typeof import("@/lib/yahoo-finance-valuations");
    clearCache();
    mockInsights.mockReset();
    mockQuoteSummary.mockReset();
  });

  it("merges insights + quoteSummary into a normalized ValuationData", async () => {
    const { getValuations } = await import("@/lib/yahoo-finance-valuations");
    mockInsights.mockResolvedValue(buildInsights({ description: "Undervalued", discount: "+47%" }));
    mockQuoteSummary.mockResolvedValue(buildFinancialData({
      recommendationKey: "strong_buy",
      recommendationMean: 1.29,
      targetMeanPrice: 278.03,
      currentPrice: 215.33,
      numberOfAnalystOpinions: 51,
    }));

    const result = await getValuations(["NVDA"]);

    expect(result.NVDA).toEqual({
      recommendationKey: "strong_buy",
      recommendationMean: 1.29,
      numberOfAnalystOpinions: 51,
      fairValueDescription: "Undervalued",
      fairValueDiscountPct: 47,
      fairValueProvider: "Trading Central",
      targetMeanPrice: 278.03,
      currentPrice: 215.33,
      upsideToTargetPct: expect.closeTo(29.12, 1),
      valuationSource: "both",
    });
  });

  it("sets valuationSource = 'fair_value' when only the description is present", async () => {
    const { getValuations } = await import("@/lib/yahoo-finance-valuations");
    mockInsights.mockResolvedValue(buildInsights({ description: "Overvalued" }));
    mockQuoteSummary.mockResolvedValue(buildFinancialData({ recommendationKey: "buy", recommendationMean: 2.0 }));

    const result = await getValuations(["X"]);
    expect(result.X.valuationSource).toBe("fair_value");
    expect(result.X.upsideToTargetPct).toBeUndefined();
  });

  it("sets valuationSource = 'analyst_target' when only target is present", async () => {
    const { getValuations } = await import("@/lib/yahoo-finance-valuations");
    mockInsights.mockResolvedValue({ symbol: "Y", instrumentInfo: {} });
    mockQuoteSummary.mockResolvedValue(buildFinancialData({ targetMeanPrice: 110, currentPrice: 100 }));

    const result = await getValuations(["Y"]);
    expect(result.Y.valuationSource).toBe("analyst_target");
    expect(result.Y.upsideToTargetPct).toBeCloseTo(10, 5);
    expect(result.Y.fairValueDescription).toBeUndefined();
  });

  it("returns no entry when both API calls succeed with empty payloads", async () => {
    const { getValuations } = await import("@/lib/yahoo-finance-valuations");
    mockInsights.mockResolvedValue({ symbol: "SPY", instrumentInfo: {} });
    mockQuoteSummary.mockResolvedValue({ financialData: {} });

    const result = await getValuations(["SPY"]);
    // Mirrors getQuotes behaviour: tickers with no usable data are simply
    // absent from the result map — the UI treats "missing" as "no coverage".
    expect(result.SPY).toBeUndefined();
  });

  it("does not poison the batch when one ticker's insights call rejects", async () => {
    const { getValuations } = await import("@/lib/yahoo-finance-valuations");
    mockInsights.mockImplementation((t: string) =>
      t === "BAD" ? Promise.reject(new Error("Invalid")) : Promise.resolve(buildInsights({ description: "Undervalued" }))
    );
    mockQuoteSummary.mockImplementation((t: string) =>
      Promise.resolve(buildFinancialData({ recommendationKey: "buy", recommendationMean: 2 }))
    );

    const result = await getValuations(["AAPL", "BAD", "MSFT"]);
    expect(result.AAPL.fairValueDescription).toBe("Undervalued");
    expect(result.MSFT.fairValueDescription).toBe("Undervalued");
    // BAD's insights failed but quoteSummary succeeded → still gets a (partial) entry
    expect(result.BAD.fairValueDescription).toBeUndefined();
    expect(result.BAD.recommendationKey).toBe("buy");
  });

  it("returns no entry when BOTH insights and quoteSummary reject for a ticker", async () => {
    const { getValuations } = await import("@/lib/yahoo-finance-valuations");
    mockInsights.mockRejectedValue(new Error("down"));
    mockQuoteSummary.mockRejectedValue(new Error("down"));

    const result = await getValuations(["GHOST"]);
    expect(result.GHOST).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/lib/yahoo-finance-valuations.test.ts`
Expected: FAIL — `getValuations is not exported` (or similar) for all 6 specs.

- [ ] **Step 3: Implement `getValuations` and `clearCache`**

Replace the contents of `src/lib/yahoo-finance-valuations.ts` with:

```ts
import YahooFinance from "yahoo-finance2";
import type { RecommendationKey, ValuationData } from "@/types";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const cache = new Map<string, { data: Record<string, ValuationData>; timestamp: number }>();

export function clearCache() {
  cache.clear();
}

export function parseFairValueDiscount(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const match = trimmed.match(/^([+-]?\d+(?:\.\d+)?)\s*%$/);
  if (!match) return undefined;
  const n = parseFloat(match[1]);
  return Number.isFinite(n) ? n : undefined;
}

const FV_DESCRIPTIONS = ["Undervalued", "Near Fair Value", "Overvalued"] as const;
type FvDescription = (typeof FV_DESCRIPTIONS)[number];

function normalizeFvDescription(raw: unknown): FvDescription | undefined {
  if (typeof raw !== "string") return undefined;
  return (FV_DESCRIPTIONS as readonly string[]).includes(raw) ? (raw as FvDescription) : undefined;
}

const REC_KEYS: RecommendationKey[] = ["strong_buy", "buy", "hold", "sell", "strong_sell", "underperform"];

function normalizeRecKey(raw: unknown): RecommendationKey | undefined {
  if (typeof raw !== "string") return undefined;
  return REC_KEYS.includes(raw as RecommendationKey) ? (raw as RecommendationKey) : undefined;
}

async function fetchOne(ticker: string): Promise<ValuationData | undefined> {
  const [insightsRes, summaryRes] = await Promise.allSettled([
    yahooFinance.insights(ticker),
    yahooFinance.quoteSummary(ticker, { modules: ["financialData"] }),
  ]);

  const data: ValuationData = { valuationSource: "none" };
  let touched = false;

  if (insightsRes.status === "fulfilled") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (insightsRes.value as any)?.instrumentInfo?.valuation;
    if (val) {
      const desc = normalizeFvDescription(val.description);
      if (desc) {
        data.fairValueDescription = desc;
        touched = true;
      }
      const discount = parseFairValueDiscount(val.discount);
      if (discount !== undefined) {
        data.fairValueDiscountPct = discount;
        touched = true;
      }
      if (typeof val.provider === "string") {
        data.fairValueProvider = val.provider;
        touched = true;
      }
    }
  }

  if (summaryRes.status === "fulfilled") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = (summaryRes.value as any)?.financialData;
    if (fd) {
      const key = normalizeRecKey(fd.recommendationKey);
      if (key) {
        data.recommendationKey = key;
        touched = true;
      }
      if (typeof fd.recommendationMean === "number") {
        data.recommendationMean = fd.recommendationMean;
        touched = true;
      }
      if (typeof fd.numberOfAnalystOpinions === "number") {
        data.numberOfAnalystOpinions = fd.numberOfAnalystOpinions;
        touched = true;
      }
      if (typeof fd.targetMeanPrice === "number") {
        data.targetMeanPrice = fd.targetMeanPrice;
        touched = true;
      }
      if (typeof fd.currentPrice === "number") {
        data.currentPrice = fd.currentPrice;
        touched = true;
      }
      if (data.targetMeanPrice !== undefined && data.currentPrice && data.currentPrice > 0) {
        data.upsideToTargetPct = ((data.targetMeanPrice - data.currentPrice) / data.currentPrice) * 100;
      }
    }
  }

  if (!touched) return undefined;

  const hasFv = data.fairValueDescription !== undefined;
  const hasTarget = data.upsideToTargetPct !== undefined;
  if (hasFv && hasTarget) data.valuationSource = "both";
  else if (hasFv) data.valuationSource = "fair_value";
  else if (hasTarget) data.valuationSource = "analyst_target";
  else data.valuationSource = "none";

  return data;
}

export async function getValuations(tickers: string[]): Promise<Record<string, ValuationData>> {
  const results: Record<string, ValuationData> = {};

  await Promise.allSettled(
    tickers.map(async (ticker) => {
      try {
        const data = await fetchOne(ticker);
        if (data) results[ticker] = data;
      } catch {
        // Defensive — fetchOne already swallows per-call rejections.
      }
    })
  );

  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/lib/yahoo-finance-valuations.test.ts`
Expected: PASS — all 6 specs in `getValuations` plus the 3 in `parseFairValueDiscount`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/yahoo-finance-valuations.ts src/__tests__/lib/yahoo-finance-valuations.test.ts
git commit -m "feat(valuations): add getValuations helper with Promise.allSettled fetch"
```

---

### Task 4: 60-second in-memory cache

**Files:**
- Modify: `src/lib/yahoo-finance-valuations.ts`
- Modify: `src/__tests__/lib/yahoo-finance-valuations.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/lib/yahoo-finance-valuations.test.ts`:

```ts
describe("getValuations caching", () => {
  beforeEach(async () => {
    const { clearCache } = jest.requireActual("@/lib/yahoo-finance-valuations") as typeof import("@/lib/yahoo-finance-valuations");
    clearCache();
    mockInsights.mockReset();
    mockQuoteSummary.mockReset();
  });

  it("returns cached data within the 60s TTL", async () => {
    const { getValuations } = await import("@/lib/yahoo-finance-valuations");
    mockInsights.mockResolvedValue(buildInsights({ description: "Undervalued" }));
    mockQuoteSummary.mockResolvedValue(buildFinancialData({ recommendationKey: "buy", recommendationMean: 2 }));

    await getValuations(["AAPL"]);
    await getValuations(["AAPL"]);

    expect(mockInsights).toHaveBeenCalledTimes(1);
    expect(mockQuoteSummary).toHaveBeenCalledTimes(1);
  });

  it("refetches when the ticker set changes", async () => {
    const { getValuations } = await import("@/lib/yahoo-finance-valuations");
    mockInsights.mockResolvedValue(buildInsights({ description: "Undervalued" }));
    mockQuoteSummary.mockResolvedValue(buildFinancialData({ recommendationKey: "buy" }));

    await getValuations(["AAPL"]);
    await getValuations(["MSFT"]);

    expect(mockInsights).toHaveBeenCalledTimes(2);
  });

  it("refetches after the TTL elapses", async () => {
    jest.useFakeTimers();
    try {
      const { getValuations } = await import("@/lib/yahoo-finance-valuations");
      mockInsights.mockResolvedValue(buildInsights({ description: "Undervalued" }));
      mockQuoteSummary.mockResolvedValue(buildFinancialData({ recommendationKey: "buy" }));

      await getValuations(["AAPL"]);
      jest.advanceTimersByTime(61_000);
      await getValuations(["AAPL"]);

      expect(mockInsights).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/lib/yahoo-finance-valuations.test.ts -t "caching"`
Expected: FAIL — `mockInsights` was called 2x where we expected 1x (cache not yet wired).

- [ ] **Step 3: Wire the cache through `getValuations`**

In `src/lib/yahoo-finance-valuations.ts`, define a TTL constant near the top:

```ts
const CACHE_TTL = 60_000;
```

Replace the body of `getValuations` with:

```ts
export async function getValuations(tickers: string[]): Promise<Record<string, ValuationData>> {
  const cacheKey = [...tickers].sort().join(",") + "_valuations";
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const results: Record<string, ValuationData> = {};
  await Promise.allSettled(
    tickers.map(async (ticker) => {
      try {
        const data = await fetchOne(ticker);
        if (data) results[ticker] = data;
      } catch {
        // Defensive — fetchOne already swallows per-call rejections.
      }
    })
  );

  cache.set(cacheKey, { data: results, timestamp: Date.now() });
  return results;
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx jest src/__tests__/lib/yahoo-finance-valuations.test.ts`
Expected: PASS — all caching specs + previous specs.

- [ ] **Step 5: Commit**

```bash
git add src/lib/yahoo-finance-valuations.ts src/__tests__/lib/yahoo-finance-valuations.test.ts
git commit -m "feat(valuations): add 60s in-memory cache for getValuations"
```

---

### Task 5: Sandbox mock + `SANDBOX_MODE` short-circuit

**Files:**
- Create: `src/lib/yahoo-finance-valuations-mock.ts`
- Modify: `src/lib/yahoo-finance-valuations.ts`
- Modify: `src/__tests__/lib/yahoo-finance-valuations.test.ts`

Deterministic mock so `npm run sandbox` exercises every bucket. The mock must produce at least one ticker in every Card 1 bucket, every Card 2 bucket, and at least one no-coverage ticker.

- [ ] **Step 1: Create the mock**

Create `src/lib/yahoo-finance-valuations-mock.ts`:

```ts
import type { RecommendationKey, ValuationData } from "@/types";

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Tickers that should land in the no-coverage strip in the sandbox.
// Includes the ETFs the real Yahoo API also returns nothing for.
const NO_COVERAGE = new Set(["SPY", "QQQ", "VOO", "VTI", "IWM"]);

const REC_BUCKETS: RecommendationKey[] = ["strong_buy", "buy", "hold", "sell", "strong_sell"];
const FV_BUCKETS = ["Undervalued", "Near Fair Value", "Overvalued"] as const;

export function getMockValuations(tickers: string[]): Record<string, ValuationData> {
  const result: Record<string, ValuationData> = {};

  for (const ticker of tickers) {
    if (NO_COVERAGE.has(ticker)) continue; // omit entirely → "no coverage" on the client

    const h = hashString(ticker);
    const recKey = REC_BUCKETS[h % REC_BUCKETS.length];
    // recommendationMean roughly centered on the bucket midpoint with a deterministic offset.
    const meanCenter = REC_BUCKETS.indexOf(recKey) + 1;            // 1..5
    const meanOffset = ((h % 100) / 100 - 0.5) * 0.6;              // ±0.3
    const recommendationMean = +(meanCenter + meanOffset).toFixed(2);

    const fvDesc = FV_BUCKETS[h % FV_BUCKETS.length];
    // Discount % roughly: Undervalued +5..+50, Near 0 ±10, Overvalued -5..-30.
    let fvDisc: number;
    if (fvDesc === "Undervalued") fvDisc = 5 + (h % 46);
    else if (fvDesc === "Overvalued") fvDisc = -(5 + (h % 26));
    else fvDisc = ((h % 21) - 10);

    const currentPrice = 30 + (h % 470);
    // Targets land roughly in line with fvDisc magnitude but always sign-positive for "Undervalued" etc.
    const upsidePct = fvDesc === "Undervalued" ? 10 + (h % 30) : fvDesc === "Overvalued" ? -(5 + (h % 25)) : (h % 21) - 10;
    const targetMeanPrice = +(currentPrice * (1 + upsidePct / 100)).toFixed(2);

    result[ticker] = {
      recommendationKey: recKey,
      recommendationMean,
      numberOfAnalystOpinions: 5 + (h % 40),
      fairValueDescription: fvDesc,
      fairValueDiscountPct: fvDisc,
      fairValueProvider: "Trading Central (mock)",
      targetMeanPrice,
      currentPrice,
      upsideToTargetPct: +upsidePct.toFixed(2),
      valuationSource: "both",
    };
  }

  return result;
}
```

- [ ] **Step 2: Write the failing test for the SANDBOX_MODE short-circuit**

Append to `src/__tests__/lib/yahoo-finance-valuations.test.ts`:

```ts
describe("SANDBOX_MODE short-circuit", () => {
  const PREV = process.env.SANDBOX_MODE;
  afterEach(() => {
    if (PREV === undefined) delete process.env.SANDBOX_MODE;
    else process.env.SANDBOX_MODE = PREV;
    const { clearCache } = jest.requireActual("@/lib/yahoo-finance-valuations") as typeof import("@/lib/yahoo-finance-valuations");
    clearCache();
  });

  it("returns mock data without hitting yahoo-finance2 when SANDBOX_MODE=true", async () => {
    process.env.SANDBOX_MODE = "true";
    const { getValuations } = await import("@/lib/yahoo-finance-valuations");
    const result = await getValuations(["AAPL", "MSFT", "SPY"]);

    expect(mockInsights).not.toHaveBeenCalled();
    expect(mockQuoteSummary).not.toHaveBeenCalled();
    expect(result.AAPL).toBeDefined();
    expect(result.MSFT).toBeDefined();
    expect(result.SPY).toBeUndefined();  // SPY is in NO_COVERAGE
    expect(result.AAPL.valuationSource).toBe("both");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/yahoo-finance-valuations.test.ts -t "SANDBOX_MODE"`
Expected: FAIL — `mockInsights` was called (short-circuit not wired yet).

- [ ] **Step 4: Add the short-circuit to `getValuations`**

At the top of `src/lib/yahoo-finance-valuations.ts`, add the import:

```ts
import { getMockValuations } from "./yahoo-finance-valuations-mock";
```

Then add the short-circuit as the **first line** inside `getValuations`:

```ts
export async function getValuations(tickers: string[]): Promise<Record<string, ValuationData>> {
  if (process.env.SANDBOX_MODE === "true") {
    return getMockValuations(tickers);
  }

  const cacheKey = [...tickers].sort().join(",") + "_valuations";
  // ...rest unchanged
}
```

- [ ] **Step 5: Run all valuations tests to verify they pass**

Run: `npx jest src/__tests__/lib/yahoo-finance-valuations.test.ts`
Expected: PASS — all specs across `parseFairValueDiscount`, `getValuations`, caching, and SANDBOX_MODE.

- [ ] **Step 6: Commit**

```bash
git add src/lib/yahoo-finance-valuations-mock.ts src/lib/yahoo-finance-valuations.ts src/__tests__/lib/yahoo-finance-valuations.test.ts
git commit -m "feat(valuations): add sandbox mock and SANDBOX_MODE short-circuit"
```

---

### Task 6: `/api/valuations` route + tests

**Files:**
- Create: `src/app/api/valuations/route.ts`
- Create: `src/__tests__/api/valuations.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/api/valuations.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { GET } from "@/app/api/valuations/route";
import { NextRequest, NextResponse } from "next/server";

jest.mock("@/lib/verify-token");
jest.mock("@/lib/firebase-admin", () => ({}));
jest.mock("@/lib/yahoo-finance-valuations", () => ({
  getValuations: jest.fn(),
}));

import { verifyRequest } from "@/lib/verify-token";
import { getValuations } from "@/lib/yahoo-finance-valuations";

describe("GET /api/valuations", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when verifyRequest rejects", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const req = new NextRequest("http://localhost/api/valuations?tickers=AAPL");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when tickers param is missing", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });
    const req = new NextRequest("http://localhost/api/valuations", {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when tickers exceeds MAX_HOLDINGS", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });
    const many = Array.from({ length: 201 }, (_, i) => `T${i}`).join(",");
    const req = new NextRequest(`http://localhost/api/valuations?tickers=${many}`, {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/too many/i);
  });

  it("returns valuations on the happy path", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });
    (getValuations as jest.Mock).mockResolvedValue({
      AAPL: { valuationSource: "both", recommendationKey: "buy" },
    });
    const req = new NextRequest("http://localhost/api/valuations?tickers=aapl", {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.AAPL.recommendationKey).toBe("buy");
    // Verify ticker was uppercased before calling the helper
    expect(getValuations).toHaveBeenCalledWith(["AAPL"]);
  });

  it("returns 502 when the upstream helper throws", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });
    (getValuations as jest.Mock).mockRejectedValue(new Error("Yahoo down"));
    const req = new NextRequest("http://localhost/api/valuations?tickers=AAPL", {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/api/valuations.test.ts`
Expected: FAIL — cannot resolve `@/app/api/valuations/route`.

- [ ] **Step 3: Implement the route**

Create `src/app/api/valuations/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getValuations } from "@/lib/yahoo-finance-valuations";
import { verifyRequest } from "@/lib/verify-token";
import { MAX_HOLDINGS } from "@/lib/import";

export async function GET(req: NextRequest) {
  const authResult = await verifyRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const raw = req.nextUrl.searchParams.get("tickers");
  if (!raw) {
    return NextResponse.json({ error: "tickers param required" }, { status: 400 });
  }

  const tickers = raw.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (tickers.length === 0) {
    return NextResponse.json({ error: "tickers param required" }, { status: 400 });
  }
  if (tickers.length > MAX_HOLDINGS) {
    return NextResponse.json({ error: `too many tickers (max ${MAX_HOLDINGS})` }, { status: 400 });
  }

  try {
    const valuations = await getValuations(tickers);
    return NextResponse.json(valuations);
  } catch (err) {
    console.error("getValuations failed:", err);
    return NextResponse.json({ error: "Failed to fetch valuations" }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/api/valuations.test.ts`
Expected: PASS — all 5 specs.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/valuations/route.ts src/__tests__/api/valuations.test.ts
git commit -m "feat(api): add /api/valuations route"
```

---

### Task 7: `AnalystSentimentCard` component + tests

**Files:**
- Create: `src/components/AnalystSentimentCard.tsx`
- Create: `src/__tests__/components/AnalystSentimentCard.test.tsx`

The card renders 5 bucket columns + a no-coverage strip. Bucket assignment + sort happen client-side from the raw `ValuationData` map.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/components/AnalystSentimentCard.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { AnalystSentimentCard } from "@/components/AnalystSentimentCard";
import type { PortfolioItem, ValuationData } from "@/types";

function item(ticker: string): PortfolioItem {
  return {
    ticker,
    companyName: ticker,
    sector: "Tech",
    shares: 1,
    avgCost: 100,
    addedAt: "2026-01-01T00:00:00.000Z",
    quote: { price: 100, change: 0, changePercent: 0, previousClose: 100 },
    marketValue: 100,
    totalPL: 0,
    totalPLPercent: 0,
  };
}

describe("AnalystSentimentCard", () => {
  it("renders all 5 bucket headers even when buckets are empty", () => {
    render(<AnalystSentimentCard items={[]} valuations={{}} />);
    expect(screen.getByText(/Strong Buy/)).toBeInTheDocument();
    expect(screen.getByText(/^Buy/)).toBeInTheDocument();
    expect(screen.getByText(/^Hold/)).toBeInTheDocument();
    expect(screen.getByText(/^Sell/)).toBeInTheDocument();
    expect(screen.getByText(/Strong Sell/)).toBeInTheDocument();
  });

  it("places each holding into the bucket for its recommendationKey", () => {
    const items = [item("AAPL"), item("MSFT"), item("JPM"), item("XYZ")];
    const valuations: Record<string, ValuationData> = {
      AAPL: { valuationSource: "none", recommendationKey: "buy", recommendationMean: 2 },
      MSFT: { valuationSource: "none", recommendationKey: "strong_buy", recommendationMean: 1.3 },
      JPM:  { valuationSource: "none", recommendationKey: "hold", recommendationMean: 3 },
      XYZ:  { valuationSource: "none", recommendationKey: "underperform", recommendationMean: 4.6 },
    };
    render(<AnalystSentimentCard items={items} valuations={valuations} />);
    expect(within(screen.getByTestId("bucket-strong_buy")).getByText("MSFT")).toBeInTheDocument();
    expect(within(screen.getByTestId("bucket-buy")).getByText("AAPL")).toBeInTheDocument();
    expect(within(screen.getByTestId("bucket-hold")).getByText("JPM")).toBeInTheDocument();
    expect(within(screen.getByTestId("bucket-strong_sell")).getByText("XYZ")).toBeInTheDocument();
  });

  it("sorts chips within a bucket by recommendationMean ascending", () => {
    const items = [item("A"), item("B"), item("C")];
    const valuations: Record<string, ValuationData> = {
      A: { valuationSource: "none", recommendationKey: "buy", recommendationMean: 2.4 },
      B: { valuationSource: "none", recommendationKey: "buy", recommendationMean: 1.6 },
      C: { valuationSource: "none", recommendationKey: "buy", recommendationMean: 2.0 },
    };
    render(<AnalystSentimentCard items={items} valuations={valuations} />);
    const bucket = screen.getByTestId("bucket-buy");
    const chips = within(bucket).getAllByTestId(/^chip-/);
    expect(chips.map((c) => c.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("B"), expect.stringContaining("C"), expect.stringContaining("A")])
    );
    expect(chips[0]).toHaveTextContent("B");
    expect(chips[1]).toHaveTextContent("C");
    expect(chips[2]).toHaveTextContent("A");
  });

  it("renders a No coverage strip listing tickers without recommendationKey", () => {
    const items = [item("SPY"), item("AAPL")];
    const valuations: Record<string, ValuationData> = {
      AAPL: { valuationSource: "none", recommendationKey: "buy", recommendationMean: 2 },
    };
    render(<AnalystSentimentCard items={items} valuations={valuations} />);
    const strip = screen.getByTestId("no-coverage-strip");
    expect(strip).toHaveTextContent("SPY");
    expect(strip).not.toHaveTextContent(/^AAPL$/);
  });

  it("does not render the No coverage strip when every holding has a key", () => {
    const items = [item("AAPL")];
    const valuations: Record<string, ValuationData> = {
      AAPL: { valuationSource: "none", recommendationKey: "buy", recommendationMean: 2 },
    };
    render(<AnalystSentimentCard items={items} valuations={valuations} />);
    expect(screen.queryByTestId("no-coverage-strip")).not.toBeInTheDocument();
  });

  it("shows bucket counts in the headers", () => {
    const items = [item("A"), item("B")];
    const valuations: Record<string, ValuationData> = {
      A: { valuationSource: "none", recommendationKey: "buy", recommendationMean: 2 },
      B: { valuationSource: "none", recommendationKey: "buy", recommendationMean: 1.8 },
    };
    render(<AnalystSentimentCard items={items} valuations={valuations} />);
    expect(screen.getByTestId("bucket-buy")).toHaveTextContent("Buy (2)");
  });

  it("treats 'underperform' as Strong Sell", () => {
    const items = [item("X")];
    const valuations: Record<string, ValuationData> = {
      X: { valuationSource: "none", recommendationKey: "underperform", recommendationMean: 4.5 },
    };
    render(<AnalystSentimentCard items={items} valuations={valuations} />);
    expect(within(screen.getByTestId("bucket-strong_sell")).getByText("X")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/components/AnalystSentimentCard.test.tsx`
Expected: FAIL — cannot resolve `@/components/AnalystSentimentCard`.

- [ ] **Step 3: Implement the component**

Create `src/components/AnalystSentimentCard.tsx`:

```tsx
"use client";
import type { PortfolioItem, RecommendationKey, ValuationData } from "@/types";

interface Props {
  items: PortfolioItem[];
  valuations: Record<string, ValuationData>;
}

type BucketId = "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";

const BUCKETS: { id: BucketId; label: string; chipClass: string }[] = [
  { id: "strong_buy",  label: "Strong Buy",  chipClass: "bg-positive/30 text-positive border-positive/40" },
  { id: "buy",         label: "Buy",         chipClass: "bg-positive/15 text-positive/90 border-positive/25" },
  { id: "hold",        label: "Hold",        chipClass: "bg-surface-border text-gray-300 border-surface-border" },
  { id: "sell",        label: "Sell",        chipClass: "bg-negative/15 text-negative/90 border-negative/25" },
  { id: "strong_sell", label: "Strong Sell", chipClass: "bg-negative/30 text-negative border-negative/40" },
];

function bucketFor(key: RecommendationKey | undefined): BucketId | undefined {
  if (!key) return undefined;
  if (key === "underperform") return "strong_sell";
  return key;
}

export function AnalystSentimentCard({ items, valuations }: Props) {
  const bucketed: Record<BucketId, { item: PortfolioItem; v: ValuationData }[]> = {
    strong_buy: [], buy: [], hold: [], sell: [], strong_sell: [],
  };
  const noCoverage: string[] = [];

  for (const item of items) {
    const v = valuations[item.ticker];
    const b = bucketFor(v?.recommendationKey);
    if (b) bucketed[b].push({ item, v });
    else noCoverage.push(item.ticker);
  }

  for (const id of Object.keys(bucketed) as BucketId[]) {
    bucketed[id].sort((a, b) => {
      const am = a.v.recommendationMean ?? Number.POSITIVE_INFINITY;
      const bm = b.v.recommendationMean ?? Number.POSITIVE_INFINITY;
      if (am !== bm) return am - bm;
      return a.item.ticker.localeCompare(b.item.ticker);
    });
  }

  return (
    <section className="bg-surface-card rounded-lg p-6 border border-surface-border">
      <h2 className="text-lg font-semibold text-white mb-4">Analyst Sentiment</h2>
      <div className="grid grid-cols-5 gap-2">
        {BUCKETS.map(({ id, label, chipClass }) => (
          <div key={id} data-testid={`bucket-${id}`} className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              {label} ({bucketed[id].length})
            </h3>
            <div className="flex flex-col gap-1.5">
              {bucketed[id].map(({ item, v }) => (
                <span
                  key={item.ticker}
                  data-testid={`chip-${item.ticker}`}
                  title={
                    v.recommendationMean !== undefined
                      ? `Rec mean ${v.recommendationMean.toFixed(2)}${v.numberOfAnalystOpinions ? ` · ${v.numberOfAnalystOpinions} analysts` : ""}`
                      : item.ticker
                  }
                  className={`text-xs font-semibold px-2 py-1 rounded border ${chipClass} text-center`}
                >
                  {item.ticker}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {noCoverage.length > 0 && (
        <div data-testid="no-coverage-strip" className="mt-4 text-xs text-gray-500">
          No coverage: {noCoverage.join(", ")}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/components/AnalystSentimentCard.test.tsx`
Expected: PASS — all 7 specs.

- [ ] **Step 5: Commit**

```bash
git add src/components/AnalystSentimentCard.tsx src/__tests__/components/AnalystSentimentCard.test.tsx
git commit -m "feat(ui): add AnalystSentimentCard with bucketed ticker chips"
```

---

### Task 8: `ValuationCard` component + tests

**Files:**
- Create: `src/components/ValuationCard.tsx`
- Create: `src/__tests__/components/ValuationCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/components/ValuationCard.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { ValuationCard } from "@/components/ValuationCard";
import type { PortfolioItem, ValuationData } from "@/types";

function item(ticker: string): PortfolioItem {
  return {
    ticker, companyName: ticker, sector: "Tech",
    shares: 1, avgCost: 100, addedAt: "2026-01-01T00:00:00.000Z",
    quote: { price: 100, change: 0, changePercent: 0, previousClose: 100 },
    marketValue: 100, totalPL: 0, totalPLPercent: 0,
  };
}

describe("ValuationCard", () => {
  it("renders all 4 bucket headers", () => {
    render(<ValuationCard items={[]} valuations={{}} />);
    expect(screen.getByTestId("vbucket-deep_value")).toHaveTextContent(/Deep Value/);
    expect(screen.getByTestId("vbucket-undervalued")).toHaveTextContent(/Undervalued/);
    expect(screen.getByTestId("vbucket-fair")).toHaveTextContent(/Fairly Priced/);
    expect(screen.getByTestId("vbucket-overvalued")).toHaveTextContent(/Overvalued/);
  });

  it("buckets by fairValueDescription when present (path 1)", () => {
    const items = [item("NVDA"), item("MSFT"), item("AAPL")];
    const valuations: Record<string, ValuationData> = {
      NVDA: { valuationSource: "fair_value", fairValueDescription: "Undervalued", fairValueDiscountPct: 47 },
      MSFT: { valuationSource: "fair_value", fairValueDescription: "Near Fair Value", fairValueDiscountPct: 9 },
      AAPL: { valuationSource: "fair_value", fairValueDescription: "Overvalued",  fairValueDiscountPct: -7 },
    };
    render(<ValuationCard items={items} valuations={valuations} />);
    expect(within(screen.getByTestId("vbucket-undervalued")).getByText("NVDA")).toBeInTheDocument();
    expect(within(screen.getByTestId("vbucket-fair")).getByText("MSFT")).toBeInTheDocument();
    expect(within(screen.getByTestId("vbucket-overvalued")).getByText("AAPL")).toBeInTheDocument();
  });

  it("falls back to upsideToTargetPct thresholds when no fairValueDescription (path 2)", () => {
    const items = [item("DEEP"), item("UPSIDE"), item("FLAT"), item("DOWN")];
    const valuations: Record<string, ValuationData> = {
      DEEP:   { valuationSource: "analyst_target", upsideToTargetPct: 30 },
      UPSIDE: { valuationSource: "analyst_target", upsideToTargetPct: 15 },
      FLAT:   { valuationSource: "analyst_target", upsideToTargetPct: 5 },
      DOWN:   { valuationSource: "analyst_target", upsideToTargetPct: -15 },
    };
    render(<ValuationCard items={items} valuations={valuations} />);
    expect(within(screen.getByTestId("vbucket-deep_value")).getByText("DEEP")).toBeInTheDocument();
    expect(within(screen.getByTestId("vbucket-undervalued")).getByText("UPSIDE")).toBeInTheDocument();
    expect(within(screen.getByTestId("vbucket-fair")).getByText("FLAT")).toBeInTheDocument();
    expect(within(screen.getByTestId("vbucket-overvalued")).getByText("DOWN")).toBeInTheDocument();
  });

  it("path 1 takes precedence over path 2 when both are available", () => {
    const items = [item("PLTR")];
    const valuations: Record<string, ValuationData> = {
      PLTR: { valuationSource: "both", fairValueDescription: "Overvalued", upsideToTargetPct: 34 },
    };
    render(<ValuationCard items={items} valuations={valuations} />);
    expect(within(screen.getByTestId("vbucket-overvalued")).getByText("PLTR")).toBeInTheDocument();
    expect(within(screen.getByTestId("vbucket-deep_value")).queryByText("PLTR")).not.toBeInTheDocument();
  });

  it("puts tickers with no signal at all into the No coverage strip", () => {
    const items = [item("SPY"), item("AAPL")];
    const valuations: Record<string, ValuationData> = {
      AAPL: { valuationSource: "fair_value", fairValueDescription: "Undervalued" },
    };
    render(<ValuationCard items={items} valuations={valuations} />);
    expect(screen.getByTestId("no-coverage-strip")).toHaveTextContent("SPY");
  });

  it("renders both numbers in chip subtext when both FV discount and upside are present", () => {
    const items = [item("JNJ")];
    const valuations: Record<string, ValuationData> = {
      JNJ: {
        valuationSource: "both",
        fairValueDescription: "Overvalued",
        fairValueDiscountPct: -17,
        upsideToTargetPct: 7.9,
      },
    };
    render(<ValuationCard items={items} valuations={valuations} />);
    const chip = screen.getByTestId("chip-JNJ");
    expect(chip).toHaveTextContent(/FV:\s*-17%/);
    expect(chip).toHaveTextContent(/Tgt:\s*\+7\.9%/);
  });

  it("sorts within bucket descending by effective upside (FV first, target as fallback)", () => {
    const items = [item("A"), item("B"), item("C")];
    const valuations: Record<string, ValuationData> = {
      A: { valuationSource: "fair_value", fairValueDescription: "Undervalued", fairValueDiscountPct: 12 },
      B: { valuationSource: "both",       fairValueDescription: "Undervalued", fairValueDiscountPct: 25, upsideToTargetPct: 5 },
      C: { valuationSource: "analyst_target", upsideToTargetPct: 18 }, // path 2 → also lands in "Undervalued" (10–25%)
    };
    render(<ValuationCard items={items} valuations={valuations} />);
    const bucket = screen.getByTestId("vbucket-undervalued");
    const chips = within(bucket).getAllByTestId(/^chip-/);
    expect(chips[0]).toHaveTextContent("B"); // 25%
    expect(chips[1]).toHaveTextContent("C"); // 18%
    expect(chips[2]).toHaveTextContent("A"); // 12%
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/components/ValuationCard.test.tsx`
Expected: FAIL — cannot resolve `@/components/ValuationCard`.

- [ ] **Step 3: Implement the component**

Create `src/components/ValuationCard.tsx`:

```tsx
"use client";
import type { PortfolioItem, ValuationData } from "@/types";

interface Props {
  items: PortfolioItem[];
  valuations: Record<string, ValuationData>;
}

type VBucketId = "deep_value" | "undervalued" | "fair" | "overvalued";

const BUCKETS: { id: VBucketId; label: string; chipClass: string }[] = [
  { id: "deep_value",  label: "Deep Value",    chipClass: "bg-positive/30 text-positive border-positive/40" },
  { id: "undervalued", label: "Undervalued",   chipClass: "bg-positive/15 text-positive/90 border-positive/25" },
  { id: "fair",        label: "Fairly Priced", chipClass: "bg-surface-border text-gray-300 border-surface-border" },
  { id: "overvalued",  label: "Overvalued",    chipClass: "bg-negative/20 text-negative/90 border-negative/30" },
];

function bucketFor(v: ValuationData | undefined): VBucketId | undefined {
  if (!v) return undefined;
  // Path 1: trust the Yahoo enum when present.
  switch (v.fairValueDescription) {
    case "Undervalued":     return "undervalued";
    case "Near Fair Value": return "fair";
    case "Overvalued":      return "overvalued";
  }
  // Path 2: fall back to numeric upside thresholds.
  const up = v.upsideToTargetPct;
  if (up === undefined) return undefined;
  if (up > 25) return "deep_value";
  if (up >= 10) return "undervalued";
  if (up >= -10) return "fair";
  return "overvalued";
}

function effectiveUpside(v: ValuationData): number {
  if (v.fairValueDiscountPct !== undefined) return v.fairValueDiscountPct;
  if (v.upsideToTargetPct !== undefined) return v.upsideToTargetPct;
  return Number.NEGATIVE_INFINITY; // missing data sorts to bottom of bucket
}

function formatPct(n: number): string {
  const rounded = Math.abs(n) >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

export function ValuationCard({ items, valuations }: Props) {
  const bucketed: Record<VBucketId, { item: PortfolioItem; v: ValuationData }[]> = {
    deep_value: [], undervalued: [], fair: [], overvalued: [],
  };
  const noCoverage: string[] = [];

  for (const item of items) {
    const v = valuations[item.ticker];
    const b = bucketFor(v);
    if (b && v) bucketed[b].push({ item, v });
    else noCoverage.push(item.ticker);
  }

  for (const id of Object.keys(bucketed) as VBucketId[]) {
    bucketed[id].sort((a, b) => {
      const diff = effectiveUpside(b.v) - effectiveUpside(a.v);
      if (diff !== 0) return diff;
      return a.item.ticker.localeCompare(b.item.ticker);
    });
  }

  return (
    <section className="bg-surface-card rounded-lg p-6 border border-surface-border">
      <h2 className="text-lg font-semibold text-white mb-4">Valuation</h2>
      <div className="grid grid-cols-4 gap-2">
        {BUCKETS.map(({ id, label, chipClass }) => (
          <div key={id} data-testid={`vbucket-${id}`} className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              {label} ({bucketed[id].length})
            </h3>
            <div className="flex flex-col gap-1.5">
              {bucketed[id].map(({ item, v }) => {
                const fvPart = v.fairValueDiscountPct !== undefined ? `FV: ${formatPct(v.fairValueDiscountPct)}` : null;
                const tgtPart = v.upsideToTargetPct !== undefined ? `Tgt: ${formatPct(v.upsideToTargetPct)}` : null;
                const subtext = [fvPart, tgtPart].filter(Boolean).join(" · ");
                const tooltip = [
                  v.fairValueDescription && `Yahoo: ${v.fairValueDescription}${v.fairValueProvider ? ` (${v.fairValueProvider})` : ""}`,
                  v.targetMeanPrice !== undefined && `Target: $${v.targetMeanPrice.toFixed(2)}`,
                  v.numberOfAnalystOpinions && `${v.numberOfAnalystOpinions} analysts`,
                ].filter(Boolean).join(" · ");
                return (
                  <span
                    key={item.ticker}
                    data-testid={`chip-${item.ticker}`}
                    title={tooltip || item.ticker}
                    className={`text-xs px-2 py-1 rounded border ${chipClass} text-center flex flex-col gap-0.5`}
                  >
                    <span className="font-semibold">{item.ticker}</span>
                    {subtext && <span className="text-[10px] opacity-75 font-normal">{subtext}</span>}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {noCoverage.length > 0 && (
        <div data-testid="no-coverage-strip" className="mt-4 text-xs text-gray-500">
          No coverage: {noCoverage.join(", ")}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/components/ValuationCard.test.tsx`
Expected: PASS — all 7 specs.

- [ ] **Step 5: Commit**

```bash
git add src/components/ValuationCard.tsx src/__tests__/components/ValuationCard.test.tsx
git commit -m "feat(ui): add ValuationCard with FV+target fallback chain"
```

---

### Task 9: Wire both cards into `/analytics`

**Files:**
- Modify: `src/app/analytics/page.tsx`

No unit test for this — covered by visual smoke in the next task.

- [ ] **Step 1: Add the imports**

In `src/app/analytics/page.tsx`, add two imports next to the existing component imports:

```tsx
import { AnalystSentimentCard } from "@/components/AnalystSentimentCard";
import { ValuationCard } from "@/components/ValuationCard";
```

And extend the existing type import:

```tsx
import type { Holding, Quote, PortfolioItem, Snapshot, ValuationData } from "@/types";
```

- [ ] **Step 2: Add valuations state + fetch**

Add the state declaration alongside the existing `useState` calls (after `items`):

```tsx
const [valuations, setValuations] = useState<Record<string, ValuationData>>({});
```

Then inside `fetchData`, **after** the `setItems(...)` block (still inside the `if (Array.isArray(holdings) && holdings.length > 0)` branch), append:

```tsx
const valuationsRes = await fetch(`/api/valuations?tickers=${tickers}`, { headers });
if (valuationsRes.ok) {
  setValuations(await valuationsRes.json());
} else {
  setValuations({});
}
```

In the `else { setItems([]); }` branch, also reset valuations:

```tsx
} else {
  setItems([]);
  setValuations({});
}
```

- [ ] **Step 3: Insert the new 2-column row**

In the JSX, between the existing first `<div className="grid grid-cols-2 gap-6">...</div>` (Sector + Performance) and the `<section>` containing the Holdings table, insert:

```tsx
<div className="grid grid-cols-2 gap-6">
  <AnalystSentimentCard items={items} valuations={valuations} />
  <ValuationCard items={items} valuations={valuations} />
</div>
```

- [ ] **Step 4: Verify the page compiles**

Run: `npx tsc --noEmit`
Expected: PASS, no errors.

Run: `npm run lint -- src/app/analytics/page.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/analytics/page.tsx
git commit -m "feat(analytics): wire AnalystSentimentCard + ValuationCard into /analytics"
```

---

### Task 10: Full test suite + lint pass

**Files:** none modified

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`
Expected: PASS — all suites green, including the three new files. Confirm the count of test files increased by 3 vs. the pre-flight baseline.

- [ ] **Step 2: Run lint over the whole project**

Run: `npm run lint`
Expected: PASS — no new warnings or errors.

- [ ] **Step 3: Production build smoke**

Run: `npm run build`
Expected: PASS — Next.js build completes; route table now lists `/api/valuations`.

If any of these fail, fix in place and re-run. Do **not** create a "fix" commit on top of a previous task; instead `git commit --amend` the task that introduced the regression so history stays clean (per project commit conventions, one logical change per commit).

---

### Task 11: Sandbox + dev visual verification

**Files:** none modified — this is end-to-end verification of the implementation against running services.

- [ ] **Step 1: Run the sandbox**

Run: `npm run sandbox`
Wait for the dev server to come up at http://localhost:3000.

- [ ] **Step 2: Visually verify `/analytics` in sandbox**

Open http://localhost:3000/analytics. Sign in via the sandbox sign-in button. Verify:

- Both new cards appear in a 2-column row between the Sector/Performance row and the Holdings table.
- **AnalystSentimentCard**: 5 columns with at least one ticker in each bucket (the mock spreads tickers across all 5 buckets by hash).
- **ValuationCard**: 4 columns with at least one ticker in each. Chip subtext reads `FV: <signed %> · Tgt: <signed %>` since the mock always sets `valuationSource: "both"`.
- Card 1 chips within a bucket are visibly sorted (read top-to-bottom in roughly Strong→weaker order). Card 2 chips read top-to-bottom from most-undervalued to most-overvalued by absolute discount.
- Hovering a chip shows the tooltip (rec mean + analyst count for Card 1; FV provider + target $ for Card 2).
- Card 1 shows a "No coverage" strip listing any seeded ETFs (the mock's `NO_COVERAGE` set: SPY, QQQ, VOO, VTI, IWM — match against the seed portfolio).

Stop the sandbox with Ctrl-C when verified.

- [ ] **Step 3: Smoke test against real Yahoo**

Run: `npm run dev`
Open http://localhost:3000/analytics, sign in with your real account. Verify:

- The two cards render with real data (some buckets may be empty if your portfolio is concentrated).
- ETF holdings (if any) appear in the no-coverage strip.
- Hover tooltip on a Card 2 chip mentions "Trading Central" (the actual provider currently).
- No unhandled exceptions in the browser console or `npm run dev` server output.

Stop the dev server when done.

- [ ] **Step 4: Final commit (if any leftover changes)**

Run: `git status`
Expected: clean working tree. If any incidental files changed (e.g. lockfile, formatting), commit them with:

```bash
git add -A
git commit -m "chore: incidental changes from sandbox/dev verification"
```

---

## Done criteria

- All 11 tasks above checked off.
- `npm test` and `npm run lint` and `npm run build` all green.
- Both cards render correctly in sandbox AND in dev against real Yahoo.
- Git history on `feat/dashboard-redesign` has one focused commit per task (≈10 new commits since the spec was committed).
