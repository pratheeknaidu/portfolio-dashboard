# Design: real market data for the public `/demo`

**Date:** 2026-07-31
**Status:** approved (brainstorm) → ready for implementation plan
**Branch:** `feat/demo-real-data`

## Goal

Make the public `/demo` experience show **real market data** — live quotes, real
analyst/valuation data, and a real performance history — instead of the current
deterministic mock fixture, while keeping the demo public (no auth), safe under
traffic, and deterministic under `SANDBOX_MODE` and in tests.

## Motivation

`/demo` is the app's public showcase. Today every number on it is fabricated
(`getMockQuotes`, hash-seeded valuations, a synthetic 90-day snapshot series), so
a visitor is looking at invented prices and P&L. Real data makes the demo
credible and shows the product doing its actual job on live markets.

## Background — current state

- **Holdings:** `DEMO_HOLDINGS` in `src/lib/demo-data.ts` — 20 fixed positions
  (real tickers, curated shares / avg-cost). This is the "story" and **stays fixed**.
- **Quotes:** `buildDemoItems()` merges `DEMO_HOLDINGS` with `getMockQuotes()`
  entirely client-side. No network.
- **Valuations:** `getDemoValuations()` — hash-seeded fake analyst data.
- **History:** `DEMO_SNAPSHOTS` — 90 weekdays of synthetic drift + sine waves.
- **Routing:** `/demo/*` wraps its subtree in `<DemoProvider>`; `useIsDemo()` is
  `true` below it. The demo branch of `usePortfolioData` and the Analytics
  valuations fetch read the fixtures directly, so the demo is fully offline.
- **Real accounts, for contrast:** quotes via `/api/quotes` → `getQuotes` (real
  Yahoo); valuations via `/api/valuations` → `getValuations` (real Yahoo);
  **history is *accumulated*, not fetched** — `POST /api/snapshot` writes one
  snapshot per Eastern day (`users/{uid}/snapshots/{date}`, idempotent), so a
  new account's chart starts empty and fills in over time.

Every server data lib already short-circuits to mocks under `SANDBOX_MODE`
(`getQuotes` line 72, `getValuations` line 120), which is what keeps the sandbox
and the test suite deterministic. History (`yahooFinance.chart`) has **no** mock
path today, because the demo never fetched history.

## Scope

**In scope**

- Real quotes, real valuations, and a real performance history on `/demo`,
  `/demo/holdings`, `/demo/analytics`.
- Three unauthenticated, demo-locked, server-cached endpoints.
- Two-layer caching (Data Cache + edge) and a fixture fallback.
- Rewiring the demo data path to consume the endpoints.

**Out of scope**

- Plan 5 (heat-map / mover interaction unification) — separate branch, resumes
  after this ships.
- Any change to authenticated-account behaviour or the existing `/api/*` routes.
- Persisting demo state (the history is computed statelessly — see below).
- Making `DEMO_HOLDINGS` editable or per-visitor.

## Design

### Three demo endpoints

New routes under `src/app/api/demo/`, each **unauthenticated** (no `verifyRequest`),
each ignoring all query params and serving **only** the fixed `DEMO_HOLDINGS`
tickers (a hard allowlist, so none can be abused as a general Yahoo proxy):

| Route | Returns | Upstream | Revalidate |
|---|---|---|---|
| `GET /api/demo/quotes` | `{ quotes, failed }` for the demo tickers | `getQuotes()` | ~60s |
| `GET /api/demo/valuations` | `Record<ticker, ValuationData>` | `getValuations()` | ~6h |
| `GET /api/demo/history` | `Snapshot[]` (≈90 weekdays) | `yahooFinance.chart()` per ticker | ~daily |

`/api/demo/history` computes the series statelessly: for each of the last ~90
weekdays `d`, `totalValue(d) = Σ shares_i × close_i(d)` across the demo holdings,
from each ticker's `chart()` history. This is exactly the series a real account
holding these positions **would** have accumulated — real data, no stored state,
no empty cold-start.

### Two-layer caching (the scale story)

The demo tickers are fixed, so the cache key does not depend on the visitor —
upstream Yahoo load is therefore **O(1) in traffic**, bounded by the revalidation
windows (quotes ~1/min, valuations ~4/day, history ~1/day) no matter how many
people are on the page.

1. **Next Data Cache** (`unstable_cache`) wraps each upstream call — **not** a
   module-level `Map`. On Vercel's many serverless instances a per-instance
   memory cache would allow one Yahoo fetch per cold instance; the Data Cache
   dedupes **across** instances and gives **stale-while-revalidate**, so an
   expired entry is served stale while exactly **one** background refresh runs
   (no cache stampede under a synchronized spike).
2. **Edge response cache** via `Cache-Control: public, s-maxage=<window>,
   stale-while-revalidate=<window>` on each route, so the majority of visitor
   requests are served from Vercel's CDN without running a function at all.
   Function invocations then track cache *misses* (a few per minute), not raw
   pageviews.

### Determinism and fallback

- **`SANDBOX_MODE` / tests:** `getQuotes` and `getValuations` already return
  mocks under `SANDBOX_MODE`, so `/api/demo/quotes` and `/api/demo/valuations`
  are automatically deterministic there. `/api/demo/history` adds an equivalent
  guard: under `SANDBOX_MODE` (or when `chart()` yields nothing) it returns the
  existing synthetic series from the `DEMO_SNAPSHOTS` generator.
- **Yahoo outage / rate-limit fallback:** every endpoint degrades to the current
  fixture rather than erroring — quotes → `getMockQuotes(DEMO_TICKERS)`,
  valuations → `getDemoValuations()`, history → synthetic snapshots. The public
  demo must never hard-fail. Fallback responses carry a short cache window so a
  transient outage doesn't pin stale mock data for long.

### Client rewiring

- `usePortfolioData`'s `isDemo` branch fetches `/api/demo/quotes` (merging real
  quotes with `DEMO_HOLDINGS` for shares/avg-cost, using the same merge as the
  authenticated path) and `/api/demo/history`, instead of `buildDemoItems()` /
  `DEMO_SNAPSHOTS`.
- The Analytics valuations fetch (`src/app/analytics/page.tsx`) uses
  `/api/demo/valuations` in demo mode instead of `getDemoValuations()`.
- `DEMO_HOLDINGS` stays the source of truth for positions. `getMockQuotes`,
  `getDemoValuations`, and the `DEMO_SNAPSHOTS` generator remain — now as the
  sandbox/test/fallback layer rather than the primary demo source.
- A single `DEMO_TICKERS` constant (derived from `DEMO_HOLDINGS`) is the shared
  allowlist used by all three endpoints.

### Request flow (production, cache miss)

```
Visitor → /demo (client) → GET /api/demo/quotes
  → edge cache miss → function → unstable_cache miss
  → getQuotes(DEMO_TICKERS) → Yahoo
  → cache fills (Data Cache + edge) → JSON to client
  → client merges quotes with DEMO_HOLDINGS → PortfolioItem[]
Subsequent visitors within the window → edge hit (no function, no Yahoo)
```

## Error handling

- Upstream throw / empty result → fixture fallback (never a 5xx to the visitor).
- Per-ticker failures inside `getQuotes` already surface via `failed[]`; the demo
  merge drops failed tickers exactly as the authenticated path does.
- History with partial `chart()` data: days missing a close for any ticker are
  skipped (a gap is better than a fabricated point); if too few days survive, fall
  back to the synthetic series so the chart still reads well.

## Testing

- **`/api/demo/quotes`**: returns only demo tickers; ignores an injected
  `?tickers=` param (allowlist); shape matches `/api/quotes`; falls back to mock
  on upstream throw. (Uses the `yahoo-finance2` auto-mock.)
- **`/api/demo/valuations`**: demo tickers only; fallback on throw.
- **`/api/demo/history`**: computes `Σ shares × close` per day from mocked chart
  data; skips gap days; falls back to synthetic under `SANDBOX_MODE` / on throw;
  returns weekday-only dates.
- **`usePortfolioData` demo branch**: fetches the demo endpoints (mock `fetch`)
  and merges into `PortfolioItem[]`; on fetch failure the UI still renders.
- **Analytics demo valuations**: fetches `/api/demo/valuations`.
- **Allowlist safety**: an endpoint given a param for a non-demo ticker never
  fetches or returns it.
- Existing demo-page tests continue to pass (they mock `usePortfolioData` or the
  fixture, unaffected by the endpoint swap).

## Scale

- 500–1000 users/day is far inside the envelope: <1 concurrent visitor on
  average. Yahoo load is flat (decoupled by the shared cache); Vercel sees
  low-tens-of-thousands of invocations/day, mostly edge hits — well within the
  Hobby tier.
- Ceiling is Vercel invocation/bandwidth quota, not Yahoo; edge caching keeps it
  low. The only real upstream risk is Yahoo IP rate-limiting, covered by the
  fixture fallback.

## Open questions

None — all design forks resolved during brainstorming (everything real; cached
demo-only endpoints; stateless history from real closes; fixture fallback;
two-layer caching; determinism preserved).
