# VIX Market Sentiment Indicator — Design

**Date:** 2026-06-02
**Branch:** `feat/vix-sentiment`
**Status:** Approved (semantics) — pending spec review

## Summary

Add a market-sentiment indicator driven by the CBOE Volatility Index (`^VIX`) to
the top navigation bar, beside the existing Market Open / Market Closed pill. The
indicator shows the current VIX value, a sentiment label, and a contrarian
buy/sell action hint colored by a tight band scheme. It is a behavioral heuristic,
not financial advice — a disclaimer ships in the tooltip.

## Motivation

The app is shared with a small group of friends who use it to watch their
portfolios. Several want a quick, glanceable read on overall market mood as an
input to their own buy/sell timing. VIX is the standard "fear gauge" and — usefully
— Yahoo already exposes it as the `^VIX` symbol, so it rides the existing quote
infrastructure with no new data provider.

## Signal semantics (contrarian framing)

The indicator uses a **contrarian / mean-reversion** interpretation: elevated VIX
(fear) historically marks above-average forward-return entry points, while very low
VIX (complacency) is treated with caution. Action strength is proportional to the
historical edge — the calm middle is honestly labeled low-confidence rather than
given fabricated precision.

| VIX band | Sentiment   | Action                     | Strength  |
|----------|-------------|----------------------------|-----------|
| `< 12`   | Complacent  | Caution — don't chase      | —         |
| `12–15`  | Calm        | Hold                       | —         |
| `15–18`  | Steady      | Neutral                    | —         |
| `18–22`  | Watchful    | Mild buy · accumulate      | weak      |
| `22–27`  | Unsettled   | Buy                        | building  |
| `27–33`  | Fearful     | Strong buy                 | strong    |
| `33–45`  | High fear   | Aggressive buy             | very strong |
| `45+`    | Panic       | Max buy                    | strongest |

Band boundaries are inclusive on the lower bound, exclusive on the upper
(`value >= lo && value < hi`); the `45+` band is open-ended; `< 12` is the floor.

Color gradient runs: complacency grey → steady green → amber (mid) → confident
"opportunity" green at the high-fear end, so the pill visually reads as a buy zone
exactly when raw instinct says panic.

**Disclaimer (tooltip):** "Heuristic based on VIX, the market's expected 30-day
volatility. Not financial advice — VIX reflects market mood, not your portfolio."

## Architecture

Four small, independently testable units. The Navbar stays a presentational
component; all data fetching stays in the page, matching the existing pattern.

### 1. `src/lib/vix-sentiment.ts` — pure mapper

```ts
export type VixStrength = "none" | "weak" | "building" | "strong" | "very-strong" | "strongest";

// Color family. One value per visual stop so the pill color is fully
// determined by this field — no band-string parsing in the component.
export type VixTone = "caution" | "neutral" | "accumulate" | "opportunity";

export interface VixSentiment {
  band: string;        // e.g. "18–22"
  sentiment: string;   // e.g. "Watchful"
  action: string;      // e.g. "Mild buy · accumulate"
  strength: VixStrength;
  tone: VixTone;
}

export function vixSentiment(value: number): VixSentiment;
```

Pure function, no I/O. The single source of truth for the band table above.
Exhaustively unit-tested at every boundary.

Band → tone/strength mapping (authoritative):

| VIX band | tone          | strength      |
|----------|---------------|---------------|
| `< 12`   | `caution`     | `none`        |
| `12–15`  | `neutral`     | `none`        |
| `15–18`  | `neutral`     | `none`        |
| `18–22`  | `accumulate`  | `weak`        |
| `22–27`  | `accumulate`  | `building`    |
| `27–33`  | `opportunity` | `strong`      |
| `33–45`  | `opportunity` | `very-strong` |
| `45+`    | `opportunity` | `strongest`   |

Color family per tone: `caution` → grey, `neutral` → amber, `accumulate` →
green, `opportunity` → saturated/confident green. `strength` modulates intensity
within the family (e.g. `opportunity`+`strongest` is the most saturated). This
removes the earlier grey→green→amber→green ambiguity: amber is the calm/neutral
middle, green strengthens monotonically as fear (and the contrarian buy case)
rises.

### 2. `src/lib/yahoo-finance.ts` — add `getVix()`

```ts
export interface VixResult {
  value: number;        // current ^VIX level
  previousClose: number;
}
export async function getVix(): Promise<VixResult | null>;
```

- Reuses the existing `yahooFinance` client and the 60s cache pattern (own cache
  key `__VIX__`).
- Honors `SANDBOX_MODE=true` → returns a deterministic mock (e.g. fixed `18.4`)
  via the mock module, so sandbox/offline runs never hit the network.
- Returns `null` on failure; callers degrade gracefully (pill hidden).

### 3. `src/app/api/market/vix/route.ts` — endpoint

`GET /api/market/vix`

- First line: `const auth = await verifyRequest(req); if (auth instanceof NextResponse) return auth;`
  (preserves the project-wide auth convention even though VIX is public data).
- Calls `getVix()`, maps through `vixSentiment()`, returns:
  ```json
  { "value": 18.4, "previousClose": 17.9, "sentiment": "Watchful",
    "action": "Mild buy · accumulate", "strength": "weak", "tone": "accumulate", "band": "18–22" }
  ```
- On `getVix()` returning null: respond `200 { "value": null }` so the client can
  cleanly hide the pill rather than show an error.

### 4. `src/components/VixPill.tsx` — presentational

```tsx
export function VixPill({ data }: { data: VixApiResponse | null }) // null → render nothing
```

- Mirrors the Market Open/Closed pill shape (height, rounded-full, border, text
  sizing) for visual consistency.
- Color family from `tone`; saturation/emphasis nudged by `strength`.
- Content: `VIX 18.4 · Watchful` with the action as a secondary line or on hover;
  full disclaimer in the tooltip.
- Hidden on mobile at the same breakpoint as the existing pill (`hidden md:inline-flex`)
  to avoid crowding the mobile navbar.

## Data flow

```
page.tsx (client, inside AuthGuard)
  └─ fetchVix()  ── GET /api/market/vix (Bearer token)
        └─ route → verifyRequest → getVix() → vixSentiment() → JSON
  └─ holds vix in state, passes <Navbar vix={vix} />
        └─ Navbar passes through to <VixPill data={vix} />
```

- `page.tsx` fetches VIX on mount and on the **existing** 60s interval, gated by
  `isMarketOpen()` exactly like `fetchPortfolio` — no new timer.
- `Navbar` gains one optional prop `vix?: VixApiResponse | null`; when absent or
  null the pill renders nothing (Navbar remains usable on pages that don't fetch it).

## Error handling

- Yahoo failure → `getVix()` returns null → endpoint returns `{ value: null }` →
  pill hidden. No toast (VIX is ancillary; a failed fetch shouldn't nag).
- Network error in `fetchVix` → caught, logged to console, pill stays at last
  value or hidden. Never blocks portfolio rendering.

## Testing

- **`vix-sentiment.test.ts`** (unit): assert every band boundary maps to the
  correct sentiment/action/strength/tone, including exact edges (11.99, 12, 22, 45)
  and absurd inputs (0, negative, 200).
- **`api/market/vix` route test**: mocked `getVix` (auto-mock infra already exists)
  → asserts shape, auth rejection path (401 when `verifyRequest` returns a
  NextResponse), and the null-value passthrough.
- **`VixPill` component test**: renders correct label/color for a representative
  value; renders nothing for `null`.
- Existing Yahoo auto-mock (`__mocks__/yahoo-finance2.ts`) extended to answer
  `^VIX` so the route test and any integration path stay offline.

## Out of scope (YAGNI)

- VIX term-structure / futures curve (backwardation signals).
- Momentum-trend blending (VIX rate-of-change).
- Historical VIX charting or persistence to Firestore snapshots.
- Per-user configurable bands or alerting.

## Open questions

None blocking. Placement (beside the open/closed pill), framing (contrarian),
bands (table above), and cadence (existing 60s `isMarketOpen` interval) are all
settled.
