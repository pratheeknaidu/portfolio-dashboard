# VIX Market Sentiment Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a VIX-driven market-sentiment pill beside the Market Open/Closed indicator in the navbar, showing the VIX value, a sentiment label, and a contrarian buy/sell action hint.

**Architecture:** A pure `vixSentiment()` mapper holds the band table (single source of truth). `getVix()` fetches `^VIX` through the existing Yahoo layer (with sandbox mock + 60s cache). A `GET /api/market/vix` route (guarded by `verifyRequest`) maps the value through the sentiment function. `page.tsx` fetches it on the existing 60s `isMarketOpen()` interval and passes it as a prop to the presentational `Navbar` → `VixPill`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Jest (`next/jest`, jsdom + node environments), Tailwind, `yahoo-finance2`.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/vix-sentiment.ts` (create) | Pure band-table mapper + all VIX types (`VixSentiment`, `VixStrength`, `VixTone`, `VixApiResponse`) |
| `src/lib/yahoo-finance.ts` (modify) | Add `getVix()`; extend `clearCache()` to clear the VIX cache |
| `src/lib/yahoo-finance-mock.ts` (modify) | Add `getMockVix()` for `SANDBOX_MODE` |
| `src/app/api/market/vix/route.ts` (create) | `GET` endpoint: auth → `getVix()` → `vixSentiment()` → JSON |
| `src/components/VixPill.tsx` (create) | Presentational pill; renders nothing when data null |
| `src/components/Navbar.tsx` (modify) | Accept `vix` prop, render `<VixPill>` beside the market pill |
| `src/app/page.tsx` (modify) | `fetchVix()` on mount + existing interval; pass `vix` to `Navbar` |
| `src/__tests__/lib/vix-sentiment.test.ts` (create) | Boundary tests for the mapper |
| `src/__tests__/lib/yahoo-finance.test.ts` (modify) | Add `getVix` tests |
| `src/__tests__/api/market-vix.test.ts` (create) | Route tests (auth, mapped body, null) |
| `src/__tests__/components/VixPill.test.tsx` (create) | Render tests |

---

## Task 1: Pure `vixSentiment()` mapper

**Files:**
- Create: `src/lib/vix-sentiment.ts`
- Test: `src/__tests__/lib/vix-sentiment.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/vix-sentiment.test.ts
import { vixSentiment } from "@/lib/vix-sentiment";

describe("vixSentiment", () => {
  it.each([
    [8,    "Complacent", "Caution — don't chase",      "none",        "caution"],
    [11.99,"Complacent", "Caution — don't chase",      "none",        "caution"],
    [12,   "Calm",       "Hold",                       "none",        "neutral"],
    [15,   "Steady",     "Neutral",                    "none",        "neutral"],
    [17.99,"Steady",     "Neutral",                    "none",        "neutral"],
    [18,   "Watchful",   "Mild buy · accumulate",      "weak",        "accumulate"],
    [21.99,"Watchful",   "Mild buy · accumulate",      "weak",        "accumulate"],
    [22,   "Unsettled",  "Buy",                        "building",    "accumulate"],
    [27,   "Fearful",    "Strong buy",                 "strong",      "opportunity"],
    [33,   "High fear",  "Aggressive buy",             "very-strong", "opportunity"],
    [45,   "Panic",      "Max buy",                    "strongest",   "opportunity"],
    [80,   "Panic",      "Max buy",                    "strongest",   "opportunity"],
  ])("maps VIX %p correctly", (value, sentiment, action, strength, tone) => {
    const r = vixSentiment(value as number);
    expect(r.sentiment).toBe(sentiment);
    expect(r.action).toBe(action);
    expect(r.strength).toBe(strength);
    expect(r.tone).toBe(tone);
  });

  it("clamps negatives into the lowest (caution) band", () => {
    expect(vixSentiment(-5).tone).toBe("caution");
  });

  it("returns a band label", () => {
    expect(vixSentiment(19).band).toBe("18–22");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/lib/vix-sentiment.test.ts`
Expected: FAIL — "Cannot find module '@/lib/vix-sentiment'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/vix-sentiment.ts
export type VixStrength =
  | "none" | "weak" | "building" | "strong" | "very-strong" | "strongest";

// One value per visual stop so the pill color is fully determined by this
// field — no band-string parsing in the component.
export type VixTone = "caution" | "neutral" | "accumulate" | "opportunity";

export interface VixSentiment {
  band: string;        // e.g. "18–22"
  sentiment: string;   // e.g. "Watchful"
  action: string;      // e.g. "Mild buy · accumulate"
  strength: VixStrength;
  tone: VixTone;
}

// Wire shape returned by GET /api/market/vix and consumed by VixPill.
export interface VixApiResponse {
  value: number | null;
  previousClose?: number;
  band?: string;
  sentiment?: string;
  action?: string;
  strength?: VixStrength;
  tone?: VixTone;
}

interface Band extends VixSentiment {
  lo: number; // inclusive
  hi: number; // exclusive
}

// Contrarian / mean-reversion bands. Boundaries: value >= lo && value < hi.
const BANDS: Band[] = [
  { lo: -Infinity, hi: 12, band: "<12",  sentiment: "Complacent", action: "Caution — don't chase", strength: "none",        tone: "caution"     },
  { lo: 12, hi: 15,        band: "12–15", sentiment: "Calm",      action: "Hold",                  strength: "none",        tone: "neutral"     },
  { lo: 15, hi: 18,        band: "15–18", sentiment: "Steady",    action: "Neutral",               strength: "none",        tone: "neutral"     },
  { lo: 18, hi: 22,        band: "18–22", sentiment: "Watchful",  action: "Mild buy · accumulate", strength: "weak",        tone: "accumulate"  },
  { lo: 22, hi: 27,        band: "22–27", sentiment: "Unsettled", action: "Buy",                   strength: "building",    tone: "accumulate"  },
  { lo: 27, hi: 33,        band: "27–33", sentiment: "Fearful",   action: "Strong buy",            strength: "strong",      tone: "opportunity" },
  { lo: 33, hi: 45,        band: "33–45", sentiment: "High fear", action: "Aggressive buy",        strength: "very-strong", tone: "opportunity" },
  { lo: 45, hi: Infinity,  band: "45+",   sentiment: "Panic",     action: "Max buy",               strength: "strongest",   tone: "opportunity" },
];

export function vixSentiment(value: number): VixSentiment {
  const b =
    BANDS.find((x) => value >= x.lo && value < x.hi) ?? BANDS[0];
  return {
    band: b.band,
    sentiment: b.sentiment,
    action: b.action,
    strength: b.strength,
    tone: b.tone,
  };
}
```

Note: a non-finite `value` (NaN) matches no band; the `?? BANDS[0]` fallback yields the caution band. The route only calls this with a real number, so this is a defensive default.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/lib/vix-sentiment.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/vix-sentiment.ts src/__tests__/lib/vix-sentiment.test.ts
git commit -m "feat(vix): pure VIX sentiment band mapper"
```

---

## Task 2: `getVix()` in the Yahoo layer

**Files:**
- Modify: `src/lib/yahoo-finance.ts`
- Modify: `src/lib/yahoo-finance-mock.ts`
- Test: `src/__tests__/lib/yahoo-finance.test.ts`

- [ ] **Step 1: Write the failing test**

Append this `describe` block to `src/__tests__/lib/yahoo-finance.test.ts` (it reuses the existing `mockQuote` / `clearCache` from the top of that file):

```ts
describe("getVix", () => {
  beforeEach(() => {
    clearCache();
    mockQuote.mockReset();
  });

  it("returns normalized VIX value and previousClose", async () => {
    mockQuote.mockResolvedValue({
      symbol: "^VIX",
      regularMarketPrice: 18.4,
      regularMarketPreviousClose: 17.9,
    });
    const result = await getVix();
    expect(result).toEqual({ value: 18.4, previousClose: 17.9 });
  });

  it("returns null when the quote has no price", async () => {
    mockQuote.mockResolvedValue({ symbol: "^VIX" });
    expect(await getVix()).toBeNull();
  });

  it("returns null when Yahoo throws", async () => {
    mockQuote.mockRejectedValue(new Error("down"));
    expect(await getVix()).toBeNull();
  });
});
```

Add `getVix` to the existing import at the top of the file:

```ts
import { getQuotes, getVix, clearCache } from "@/lib/yahoo-finance";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/lib/yahoo-finance.test.ts -t "getVix"`
Expected: FAIL — `getVix is not a function`.

- [ ] **Step 3a: Add the mock helper**

Append to `src/lib/yahoo-finance-mock.ts`:

```ts
export function getMockVix(): { value: number; previousClose: number } {
  return { value: 18.4, previousClose: 17.9 };
}
```

- [ ] **Step 3b: Implement `getVix` and extend `clearCache`**

In `src/lib/yahoo-finance.ts`, update the mock import (line 3) to also pull in `getMockVix`:

```ts
import { getMockQuotes, getMockVix } from "./yahoo-finance-mock";
```

Replace the existing `clearCache` function with:

```ts
export function clearCache() {
  cache.clear();
  vixCache.clear();
}
```

Add the VIX cache + `VixResult` type + `getVix()` (place after `clearCache`):

```ts
export interface VixResult {
  value: number;
  previousClose: number;
}

const vixCache = new Map<string, { data: VixResult; timestamp: number }>();
const VIX_CACHE_KEY = "__VIX__";

export async function getVix(): Promise<VixResult | null> {
  if (process.env.SANDBOX_MODE === "true") {
    return getMockVix();
  }

  const cached = vixCache.get(VIX_CACHE_KEY);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const q = await yahooFinance.quote("^VIX");
    if (q && typeof q.regularMarketPrice === "number") {
      const data: VixResult = {
        value: q.regularMarketPrice,
        previousClose: q.regularMarketPreviousClose ?? q.regularMarketPrice,
      };
      vixCache.set(VIX_CACHE_KEY, { data, timestamp: Date.now() });
      return data;
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/lib/yahoo-finance.test.ts`
Expected: PASS (existing `getQuotes` tests + new `getVix` tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/yahoo-finance.ts src/lib/yahoo-finance-mock.ts src/__tests__/lib/yahoo-finance.test.ts
git commit -m "feat(vix): getVix fetcher with sandbox mock and cache"
```

---

## Task 3: `GET /api/market/vix` route

**Files:**
- Create: `src/app/api/market/vix/route.ts`
- Test: `src/__tests__/api/market-vix.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/api/market-vix.test.ts
/**
 * @jest-environment node
 */
import { GET } from "@/app/api/market/vix/route";
import { NextRequest, NextResponse } from "next/server";

jest.mock("@/lib/verify-token");
jest.mock("@/lib/firebase-admin", () => ({}));
jest.mock("@/lib/yahoo-finance", () => ({ getVix: jest.fn() }));

import { verifyRequest } from "@/lib/verify-token";
import { getVix } from "@/lib/yahoo-finance";

describe("GET /api/market/vix", () => {
  it("returns 401 when unauthorized", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const req = new NextRequest("http://localhost/api/market/vix");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns value plus mapped sentiment", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "u1" });
    (getVix as jest.Mock).mockResolvedValue({ value: 28.5, previousClose: 25 });

    const req = new NextRequest("http://localhost/api/market/vix", {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.value).toBe(28.5);
    expect(body.sentiment).toBe("Fearful");
    expect(body.action).toBe("Strong buy");
    expect(body.tone).toBe("opportunity");
  });

  it("returns { value: null } when VIX is unavailable", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "u1" });
    (getVix as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/market/vix", {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(body.value).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/api/market-vix.test.ts`
Expected: FAIL — cannot find module `@/app/api/market/vix/route`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/api/market/vix/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getVix } from "@/lib/yahoo-finance";
import { vixSentiment } from "@/lib/vix-sentiment";
import { verifyRequest } from "@/lib/verify-token";

export async function GET(req: NextRequest) {
  const authResult = await verifyRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const vix = await getVix();
    if (!vix) return NextResponse.json({ value: null });

    return NextResponse.json({
      value: vix.value,
      previousClose: vix.previousClose,
      ...vixSentiment(vix.value),
    });
  } catch (err) {
    // VIX is ancillary — degrade to "hidden" rather than erroring the client.
    return NextResponse.json({ value: null, message: String(err) });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/api/market-vix.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/market/vix/route.ts src/__tests__/api/market-vix.test.ts
git commit -m "feat(vix): GET /api/market/vix route"
```

---

## Task 4: `VixPill` component

**Files:**
- Create: `src/components/VixPill.tsx`
- Test: `src/__tests__/components/VixPill.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/VixPill.test.tsx
import { render, screen } from "@testing-library/react";
import { VixPill } from "@/components/VixPill";

describe("VixPill", () => {
  it("renders nothing when data is null", () => {
    const { container } = render(<VixPill data={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when value is null", () => {
    const { container } = render(<VixPill data={{ value: null }} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the VIX value and sentiment label", () => {
    render(
      <VixPill
        data={{
          value: 28.5,
          sentiment: "Fearful",
          action: "Strong buy",
          tone: "opportunity",
          strength: "strong",
        }}
      />,
    );
    expect(screen.getByText("VIX 28.5")).toBeInTheDocument();
    expect(screen.getByText("Fearful")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/components/VixPill.test.tsx`
Expected: FAIL — cannot find module `@/components/VixPill`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/VixPill.tsx
"use client";
import type { VixApiResponse, VixTone } from "@/lib/vix-sentiment";

const TONE_STYLES: Record<VixTone, string> = {
  caution:     "bg-amber-500/10 text-amber-400 border-amber-500/30",
  neutral:     "bg-surface-elevated/60 text-muted-foreground border-border/60",
  accumulate:  "bg-positive/10 text-positive border-positive/30",
  opportunity: "bg-positive/20 text-positive border-positive/50",
};

const DISCLAIMER =
  "Heuristic based on VIX, the market's expected 30-day volatility. " +
  "Not financial advice — VIX reflects market mood, not your portfolio.";

export function VixPill({ data }: { data: VixApiResponse | null }) {
  if (!data || data.value == null) return null;

  const tone: VixTone = data.tone ?? "neutral";
  const title = `VIX ${data.value.toFixed(1)} · ${data.sentiment} — ${data.action}. ${DISCLAIMER}`;

  return (
    <span
      title={title}
      className={`hidden md:inline-flex items-center gap-2 h-10 px-3.5 rounded-full text-xs font-medium tracking-wide border ${TONE_STYLES[tone]}`}
    >
      <span className="font-semibold">VIX {data.value.toFixed(1)}</span>
      <span className="opacity-50">·</span>
      <span>{data.sentiment}</span>
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/components/VixPill.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/VixPill.tsx src/__tests__/components/VixPill.test.tsx
git commit -m "feat(vix): VixPill presentational component"
```

---

## Task 5: Wire VIX into the navbar and page

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `src/app/page.tsx`

No new unit test — this is composition of already-tested units; verified via full suite + manual sandbox check in Task 6.

- [ ] **Step 1: Add the `vix` prop to `Navbar`**

In `src/components/Navbar.tsx`, add imports near the top (after the existing `MobileMenu` import):

```tsx
import { VixPill } from "@/components/VixPill";
import type { VixApiResponse } from "@/lib/vix-sentiment";
```

Change the props interface and signature:

```tsx
interface NavbarProps {
  onImportClick: () => void;
  vix?: VixApiResponse | null;
}

export function Navbar({ onImportClick, vix }: NavbarProps) {
```

Inside the right-hand controls — the `<div className="flex items-center gap-2.5">` — add the pill immediately **before** the existing Market Open/Closed `<span>` (the one with `marketOpen ? "Market Open" : "Market Closed"`):

```tsx
<VixPill data={vix ?? null} />
```

- [ ] **Step 2: Fetch VIX in `page.tsx`**

In `src/app/page.tsx`, add this import after the existing component/type imports (e.g. just below the `import type { Holding, ... } from "@/types";` line):

```tsx
import type { VixApiResponse } from "@/lib/vix-sentiment";
```

Add state alongside the other `useState` hooks (near `failedTickers`):

```tsx
const [vix, setVix] = useState<VixApiResponse | null>(null);
```

Add a `fetchVix` callback right after the `fetchPortfolio` `useCallback` (before the `useEffect` that calls it):

```tsx
const fetchVix = useCallback(async () => {
  const token = await getIdToken();
  if (!token) return;
  try {
    const res = await fetch("/api/market/vix", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data: VixApiResponse = await res.json();
    setVix(data);
  } catch (err) {
    console.error("fetchVix failed:", err);
  }
}, [getIdToken]);
```

- [ ] **Step 3: Call `fetchVix` on mount + the existing interval**

Replace the existing mount `useEffect` (the one calling `fetchPortfolio()` on a 60s interval) with:

```tsx
useEffect(() => {
  fetchPortfolio();
  fetchVix();
  const interval = setInterval(() => {
    if (isMarketOpen()) {
      fetchPortfolio();
      fetchVix();
    }
  }, 60_000);
  return () => clearInterval(interval);
}, [fetchPortfolio, fetchVix]);
```

- [ ] **Step 4: Pass `vix` to `Navbar`**

Change the `<Navbar onImportClick={() => setShowImport(true)} />` line to:

```tsx
<Navbar onImportClick={() => setShowImport(true)} vix={vix} />
```

- [ ] **Step 5: Run the full suite + lint to confirm nothing broke**

Run: `npm test && npm run lint`
Expected: all tests PASS, lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/Navbar.tsx src/app/page.tsx
git commit -m "feat(vix): wire VIX pill into navbar via page fetch"
```

---

## Task 6: Verify end-to-end + build

**Files:** none (verification only)

- [ ] **Step 1: Full unit suite**

Run: `npm test`
Expected: all suites PASS (including the 4 new/extended test files).

- [ ] **Step 2: Lint + production build**

Run: `npm run lint && npm run build`
Expected: lint clean; build succeeds (route `/api/market/vix` appears in the build output).

- [ ] **Step 3: Manual sandbox check**

Run: `npm run sandbox`
Then in the browser: sign in via the sandbox button and confirm a pill reading **"VIX 18.4 · Watchful"** (amber-free, green `accumulate` tone) renders to the left of the Market Open/Closed pill on desktop width. Resize below `md` and confirm the pill hides (matches the market pill's responsive behavior).

- [ ] **Step 4: Final commit (if any manual tweaks were needed)**

```bash
git add -A
git commit -m "chore(vix): verification pass"
```

(Skip if nothing changed.)

---

## Notes for the implementer

- **Auth convention:** every API route's first two lines must be the
  `verifyRequest` / `instanceof NextResponse` guard. Task 3 follows it — don't drop it.
- **Sandbox mock:** `getVix()` short-circuits on `SANDBOX_MODE=true`, so `npm run sandbox` never hits the network. The mock returns `18.4` → "Watchful / Mild buy · accumulate".
- **Graceful degradation:** a missing/failed VIX must never block portfolio rendering. The route returns `{ value: null }` and `VixPill` renders nothing — there is intentionally no error toast.
- **The Navbar stays presentational:** all fetching lives in `page.tsx`. Do not add data fetching to `Navbar`.
```
