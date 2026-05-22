# Analyst Sentiment + Valuation Cards on `/analytics` — Design Spec

**Date:** 2026-05-22
**Status:** Approved, ready for implementation

## Goal

Surface two new portfolio-wide views on `/analytics`:

1. **Analyst Sentiment** — group every holding into Strong Buy / Buy / Hold / Sell / Strong Sell, sorted within each bucket by signal strength.
2. **Valuation** — group every holding into Deep Value / Undervalued / Fairly Priced / Overvalued based on a combined Yahoo Fair Value (primary) + analyst target price (fallback) signal.

These cards make it possible to answer two questions at a glance: *what does Wall Street think of what I own?* and *which of my holdings are stretched vs. cheap right now?*

## Out of scope

- Sparklines, target-price-vs-current charts, or in-card history.
- Custom (user-defined) fair value models, DCF inputs, or override prices.
- Alerting / notifications when a holding crosses a bucket boundary.
- Per-holding click-through to a detail page (chips are read-only in v1).
- ETF / fund analyst coverage substitutes (e.g. holdings-weighted ratings).

## Approach summary

| Decision | Chosen | Alternatives rejected |
|----------|--------|-----------------------|
| Placement | New 2-column row on `/analytics` between Sector/Performance row and Holdings table | New `/analysis` page; bento cards on `/`; replacing Holdings table |
| Visual style | Bucketed ticker chips, one column per bucket | Stacked horizontal bar; compact grouped table |
| Chip sort | By signal strength within bucket (strongest first) | By position size; alphabetical |
| Card 1 source | `quoteSummary.financialData.recommendationKey` (5-level) + `recommendationMean` for sort | `insights.recommendation.rating` (3-level only) |
| Card 2 primary | `insights.instrumentInfo.valuation.description` enum | Parsing `valuation.discount` string directly |
| Card 2 fallback | `quoteSummary.financialData.targetMeanPrice` upside vs current price | `targetMedianPrice`; per-analyst-report target |
| Bucket count (Card 2) | 4 (Deep Value / Undervalued / Fairly Priced / Overvalued) | 3 (Yahoo native); 5 (symmetric mirror of Card 1) |
| No-coverage handling | Muted single-line strip at bottom of each card | Dedicated "N/A" column; hide silently; drop the holding |
| Bucketing location | Client-side from raw `ValuationData` | Server-side; precomputed in Firestore |

## Data layer

### New helper: `src/lib/yahoo-finance-valuations.ts`

Exports `getValuations(tickers: string[]): Promise<Record<string, ValuationData>>`.

```ts
export type ValuationData = {
  // Card 1 fields
  recommendationKey?: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell" | "underperform";
  recommendationMean?: number;            // 1.0 strongest buy → 5.0 strongest sell

  // Card 2 fields
  fairValueDescription?: "Undervalued" | "Near Fair Value" | "Overvalued";
  fairValueDiscountPct?: number;          // signed %; positive = below fair value; null if Yahoo's string was missing or unparseable
  fairValueProvider?: string;             // e.g. "Trading Central" — for chip provenance display
  targetMeanPrice?: number;
  upsideToTargetPct?: number;             // (target - current) / current * 100; depends on current price being known
  valuationSource: "fair_value" | "analyst_target" | "both" | "none";
};
```

**Behavior:**

- For each ticker, fire `yahooFinance.insights(ticker)` and `yahooFinance.quoteSummary(ticker, { modules: ['financialData'] })` via `Promise.allSettled` — one bad symbol doesn't poison the batch (same pattern as `getQuotes`).
- Parse `insights.instrumentInfo.valuation.discount` from its string form (`"-17%"`, `"+47%"`, `"-3%"`) into a signed number. Treat missing or unparseable values as `undefined`; the bucket assignment uses `description` anyway.
- Compute `upsideToTargetPct` only when both `targetMeanPrice` and current price are known. Current price comes from the same `quoteSummary` call (`financialData.currentPrice`) — no extra round trip.
- `valuationSource` is `"fair_value"` if `description` is present, `"analyst_target"` if only target upside is, `"both"` if both, `"none"` otherwise.

**Cache:** 60-second in-memory cache keyed by `${sortedTickers}_valuations`. Same shape as `getQuotes`. `clearCache()` exported for tests. Rationale for matching the quote cache TTL: keeps the dashboard refetch cadence uniform; valuation data doesn't actually change minute-to-minute, so this is wasteful in steady-state but trivial in cost (a few hundred cache hits per session, all served locally).

**Sandbox:** when `process.env.SANDBOX_MODE === "true"`, short-circuit to a new `getMockValuations(tickers)` from `src/lib/yahoo-finance-valuations-mock.ts`. Deterministic-by-ticker-hash (same approach as `getMockQuotes`), with a fixed mix of buckets so the sandbox UI exercises all states.

### New route: `src/app/api/valuations/route.ts`

`GET /api/valuations?tickers=AAPL,MSFT,...`

- First line: `const auth = await verifyRequest(req); if (auth instanceof NextResponse) return auth;` (existing convention).
- Returns `Record<ticker, ValuationData>` as JSON.
- Errors that should reach the user: `{ error: string }` with 400. Server failures log + return generic 500.
- Caps `tickers` at the same `MAX_HOLDINGS = 200` ceiling the import pipeline uses.

## Frontend

### `src/app/analytics/page.tsx`

Add a third fetch alongside the existing `/api/portfolio` + `/api/quotes` calls inside `fetchData`. Result is held in component state as `valuations: Record<string, ValuationData>` and passed to the two new card components. Refetched on the same cadence (current cadence is "on mount only" for `/analytics`, which is fine — valuation data is slow-moving).

Layout change — insert a new 2-column grid between the existing Sector/Performance row and the Holdings table:

```tsx
<div className="grid grid-cols-2 gap-6">
  <AnalystSentimentCard items={items} valuations={valuations} />
  <ValuationCard items={items} valuations={valuations} />
</div>
```

Each card uses the existing card shell (`bg-surface-card rounded-lg p-6 border border-surface-border`) and `<h2 className="text-lg font-semibold text-white mb-4">`.

### New component: `src/components/AnalystSentimentCard.tsx`

Props: `{ items: PortfolioItem[]; valuations: Record<string, ValuationData> }`.

**Bucket assignment** by `recommendationKey`:

| Yahoo key | Bucket |
|---|---|
| `strong_buy` | Strong Buy |
| `buy` | Buy |
| `hold` | Hold |
| `sell` | Sell |
| `strong_sell`, `underperform` | Strong Sell |
| `none`, missing, null, empty string | (No coverage strip) |

**Layout:** 5 equal-width columns (CSS grid `grid-cols-5 gap-2`). Each column has a header (`<h3>` with bucket name + parenthesized count) and a vertical stack of ticker chips.

**Chip:** a small rounded pill with the ticker symbol. Background color tints by bucket position (greenish for Strong Buy → red for Strong Sell), keeping the palette consistent with the existing emerald theme. Hover tooltip shows `recommendationMean` to 2 decimal places and `numberOfAnalystOpinions` if available.

**Within-bucket sort:** ascending by `recommendationMean` (so the strongest signal in each bucket sits at the top of the column). Holdings with the same `recommendationMean` fall back to ticker alphabetical.

**No coverage strip:** if any holdings have no `recommendationKey`, render a muted single-line strip below the columns: `No coverage: SPY, QQQ, VOO`. No icons, no expandable section — keep it small. If *all* holdings lack coverage (e.g. an ETF-only portfolio), the column grid still renders empty (column headers visible, all counts `(0)`) and the strip lists every ticker — the cards never disappear from the page.

### New component: `src/components/ValuationCard.tsx`

Props: identical to `AnalystSentimentCard`.

**Bucket assignment** — two-step fallback chain per holding:

1. **If `fairValueDescription` is present**, bucket by enum:
   - `Undervalued` → "Undervalued"
   - `Near Fair Value` → "Fairly Priced"
   - `Overvalued` → "Overvalued"
   (Yahoo's enum does not have a "Deep Value" tier; that bucket is reachable only via path 2.)
2. **Else if `upsideToTargetPct` is present**, bucket by numeric threshold:
   - `> +25%` → "Deep Value"
   - `+10%` to `+25%` → "Undervalued"
   - `−10%` to `+10%` → "Fairly Priced"
   - `< −10%` → "Overvalued"
3. **Else** → No coverage strip.

**Layout:** 4 equal-width columns (`grid-cols-4 gap-2`), same chip + header treatment as Card 1.

**Within-bucket sort:** descending by *effective upside %* — `fairValueDiscountPct ?? upsideToTargetPct`. The most undervalued chips sit at the top of each column. Note that `fairValueDiscountPct` may be missing even when `description` is present (e.g. SNOW returns `description: "Overvalued"` but no `discount` string); in that case, fall back to `upsideToTargetPct` for sort, and if both are missing the chip sorts last (alphabetical tiebreaker).

**Chip subtext (always show both numbers when both exist):**
- Both sources: chip displays ticker on top, `FV: −17% · Tgt: +7.9%` below in a smaller muted font.
- Fair value only: `FV: −17%`.
- Target only: `Tgt: +7.9%`.
- Hover tooltip: full breakdown including the `fairValueProvider` (e.g. "Trading Central") and `numberOfAnalystOpinions` when relevant.

**No coverage strip:** identical pattern to Card 1.

### Bucket color palette

Both cards use a 5-stop semantic palette aligned with the existing P&L heatmap green/red:

| Position | Tint |
|---|---|
| Strong Buy / Deep Value | strongest green |
| Buy / Undervalued | mid green |
| Hold / Fairly Priced | neutral gray |
| Sell / Overvalued | mid red |
| Strong Sell | strongest red |

Card 2's "Deep Value" gets the same strongest-green stop as Card 1's "Strong Buy" so the two cards read as visually parallel even though they have different bucket counts.

## Testing

### Unit (`src/__tests__/lib/yahoo-finance-valuations.test.ts`)

- Fairvalue `discount` string parsing: `"-17%"` → `-17`, `"+47%"` → `47`, `"16%"` → `16`, `""` → `undefined`, malformed → `undefined`.
- `valuationSource` correctness across all four combinations (FV+target, FV only, target only, neither).
- `Promise.allSettled` — one ticker throwing inside `insights()` does not crash the batch; the bad ticker simply absent from the result map.
- Cache TTL: second call within 60s hits cache; after 60s refetches.

### Unit (`src/__tests__/components/AnalystSentimentCard.test.tsx`, `ValuationCard.test.tsx`)

- Bucket assignment for every key/enum value.
- Within-bucket sort order (e.g. `recommendationMean: [1.3, 1.95, 1.31]` → render order `1.3, 1.31, 1.95`).
- No-coverage strip renders when, and only when, any holding has no qualifying source.
- Card 2 fallback chain: ticker with FV description and target → bucket from description; ticker with target only → bucket from numeric threshold; ticker with neither → no-coverage strip.
- Card 2 chip subtext: dual-number rendering when both fields present.

### Unit (`src/__tests__/api/valuations.test.ts`)

- Existing `__mocks__/yahoo-finance2.ts` + `__mocks__/firebase-admin.ts` auto-mocks already in place.
- Auth: missing/invalid token → 401 via `verifyRequest`.
- Happy path: returns `Record<ticker, ValuationData>` shape.
- Tickers cap: > 200 tickers → 400.

### Manual / sandbox verification

`npm run sandbox` should render both cards with deterministic content. The mock should cover at least one ticker in every bucket on both cards and at least one ticker that lands in the no-coverage strip, so the UI exercises every visual state without a real Yahoo call.

## Data quirks discovered during coverage probe (2026-05-22)

These informed the design and are documented here so implementers don't re-discover them:

1. **`description` is more reliable than `discount`.** Probe found PLTR returning `description: "Overvalued"` with `discount: "+16%"` (sign would normally mean undervalued). Trust the enum, treat the number as advisory.
2. **`discount` is sometimes missing even when `description` is present.** SNOW and RKLB returned `description: "Overvalued"` with no `discount` string at all. Don't assume non-null one ↔ non-null other.
3. **Yahoo's fair-value provider is currently "Trading Central"**, not Morningstar. The spec uses generic "Yahoo Fair Value" in UI labels in case the provider changes.
4. **ETFs return nothing.** SPY and QQQ both had empty `recommendationKey` and empty `valuation` blocks. This is the dominant case for the no-coverage strip.
5. **Fair value and analyst target frequently disagree.** Probe showed JNJ at FV −17% vs target +7.9%, PLTR at FV "Overvalued" vs target +34%. This is intentional UX — Card 1 shows sentiment, Card 2 shows valuation; the divergence is the actionable signal.

## Implementation order

1. `yahoo-finance-valuations.ts` helper + tests (with mocked yahoo-finance2).
2. `yahoo-finance-valuations-mock.ts` for sandbox.
3. `/api/valuations` route + route test.
4. `AnalystSentimentCard` component + test.
5. `ValuationCard` component + test.
6. Wire both into `analytics/page.tsx` and verify against `npm run sandbox`.
7. Smoke-test against real Yahoo via `npm run dev` with the probe basket.
