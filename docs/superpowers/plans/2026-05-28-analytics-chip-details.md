# Analytics Chip Detail Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Analyst Sentiment and Valuation chips open a rich, mobile-friendly detail panel (click/tap-to-pin) reusing the treemap's tooltip/sheet shell, including a Yahoo-style analyst price-target range bar.

**Architecture:** Extract a generic `DetailPanel` shell out of `TreemapTooltip` (positioning + desktop-tooltip/mobile-Sheet switch). A shared `useDetailSelection` hook owns pin/dismiss state. A new `ChipDetail` body renders analytics content. Both cards turn chips into buttons that open the panel.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind, Jest + Testing Library, yahoo-finance2.

---

### Task 1: Add analyst price-target range to the data layer

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/yahoo-finance-valuations.ts`
- Modify: `src/lib/yahoo-finance-valuations-mock.ts`
- Test: `src/__tests__/lib/yahoo-finance-valuations.test.ts`

- [ ] **Step 1: Add the failing test**

Open `src/__tests__/lib/yahoo-finance-valuations.test.ts` and add this test inside the top-level `describe`. (The file already mocks `yahoo-finance2`; follow the existing pattern in the file for how `insights`/`quoteSummary` are mocked — locate the existing test that stubs `quoteSummary` returning `financialData` and copy its mock setup, adding `targetLowPrice`/`targetHighPrice`.)

```ts
it("passes through targetLowPrice and targetHighPrice from financialData", async () => {
  // Mirror the existing financialData mock setup in this file, adding the two fields:
  mockQuoteSummary.mockResolvedValue({
    financialData: {
      recommendationKey: "buy",
      recommendationMean: 2.0,
      numberOfAnalystOpinions: 30,
      targetMeanPrice: 200,
      targetLowPrice: 150,
      targetHighPrice: 260,
      currentPrice: 180,
    },
  });
  mockInsights.mockResolvedValue({});
  clearCache();

  const result = await getValuations(["AAPL"]);
  expect(result.AAPL.targetLowPrice).toBe(150);
  expect(result.AAPL.targetHighPrice).toBe(260);
});
```

If the existing file uses different mock variable names (e.g. `yahooFinance.quoteSummary` spy), adapt the two `mock*` references to match — do not introduce a new mocking style.

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test -- src/__tests__/lib/yahoo-finance-valuations.test.ts -t "targetLowPrice"`
Expected: FAIL — `result.AAPL.targetLowPrice` is `undefined`.

- [ ] **Step 3: Add the type fields**

In `src/types/index.ts`, inside `interface ValuationData`, after the `targetMeanPrice?: number;` line add:

```ts
  targetLowPrice?: number;
  targetHighPrice?: number;
```

- [ ] **Step 4: Populate them in the fetcher**

In `src/lib/yahoo-finance-valuations.ts`, inside `fetchOne`, in the `if (fd) {` block, immediately after the `targetMeanPrice` assignment block (around line 88), add:

```ts
      if (typeof fd.targetLowPrice === "number") {
        data.targetLowPrice = fd.targetLowPrice;
        touched = true;
      }
      if (typeof fd.targetHighPrice === "number") {
        data.targetHighPrice = fd.targetHighPrice;
        touched = true;
      }
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `npm test -- src/__tests__/lib/yahoo-finance-valuations.test.ts -t "targetLowPrice"`
Expected: PASS.

- [ ] **Step 6: Add range to the sandbox mock**

In `src/lib/yahoo-finance-valuations-mock.ts`, both result objects build `targetMeanPrice`. In **each** of the two `result[ticker] = { ... }` literals, add a low/high band bracketing the mean:

```ts
      targetLowPrice: +(targetMeanPrice * 0.85).toFixed(2),
      targetHighPrice: +(targetMeanPrice * 1.2).toFixed(2),
```

Place these two lines right after the `targetMeanPrice,` property in each literal.

- [ ] **Step 7: Run the full valuations lib + api tests**

Run: `npm test -- src/__tests__/lib/yahoo-finance-valuations.test.ts src/__tests__/api/valuations.test.ts`
Expected: PASS (no regressions).

- [ ] **Step 8: Commit**

```bash
git add src/types/index.ts src/lib/yahoo-finance-valuations.ts src/lib/yahoo-finance-valuations-mock.ts src/__tests__/lib/yahoo-finance-valuations.test.ts
git commit -m "feat(valuations): fetch analyst target low/high price range"
```

---

### Task 2: Extract `DetailPanel` shell from `TreemapTooltip`

**Files:**
- Create: `src/components/ui/DetailPanel.tsx`
- Modify: `src/components/TreemapTooltip.tsx`
- Test: existing `src/__tests__/components/TreemapTooltip.test.tsx` (must stay green; no new test needed — extraction is behavior-preserving)

- [ ] **Step 1: Create `DetailPanel.tsx`**

Create `src/components/ui/DetailPanel.tsx` with the positioning + mobile-Sheet logic lifted verbatim from `TreemapTooltip.tsx`:

```tsx
"use client";
import { ReactNode } from "react";
import { useIsMobile } from "@/lib/use-is-mobile";
import { Sheet } from "@/components/ui/Sheet";

export interface TileRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PANEL_W = 256;
const PANEL_H = 220;
const GAP = 8;

function position(rect: TileRect | null) {
  if (!rect) return { top: 0, left: 0 };
  const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080;

  let top = rect.top - PANEL_H - GAP;
  if (top < GAP) top = rect.top + rect.height + GAP;
  if (top + PANEL_H > vh - GAP) top = Math.max(GAP, vh - PANEL_H - GAP);

  let left = rect.left + rect.width / 2 - PANEL_W / 2;
  left = Math.max(GAP, Math.min(left, vw - PANEL_W - GAP));

  return { top, left };
}

interface DetailPanelProps {
  rect: TileRect | null;
  onClose: () => void;
  children: ReactNode;
}

export function DetailPanel({ rect, onClose, children }: DetailPanelProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open onClose={onClose}>
        <div className="p-5">{children}</div>
      </Sheet>
    );
  }

  const { top, left } = position(rect);
  return (
    <div
      className="bento-card fixed z-50 p-5 text-sm pointer-events-none transition-[top,left] duration-100 ease-out"
      style={{ top, left, width: PANEL_W }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `TreemapTooltip.tsx` to use the shell**

Replace the whole file body so it imports `DetailPanel`/`TileRect` from the new shell, re-exports `TileRect` (so `page.tsx` and `Treemap.tsx` keep importing it from here), keeps `fmt` + `TileBody` unchanged, and renders through `DetailPanel`:

```tsx
"use client";
import { DetailPanel, type TileRect } from "@/components/ui/DetailPanel";
import type { PortfolioItem } from "@/types";

export type { TileRect };

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function TileBody({ item }: { item: PortfolioItem }) {
  // ... KEEP the existing TileBody JSX exactly as it is in the current file ...
}

interface Props {
  item: PortfolioItem | null;
  tileRect: TileRect | null;
  onClose?: () => void;
}

export function TreemapTooltip({ item, tileRect, onClose }: Props) {
  if (!item) return null;
  return (
    <DetailPanel rect={tileRect} onClose={onClose ?? (() => {})}>
      <TileBody item={item} />
    </DetailPanel>
  );
}
```

When you do this, copy the **existing** `TileBody` function body from the current `TreemapTooltip.tsx` verbatim (the `dayChange` line + the grid). Do not retype it from memory.

- [ ] **Step 3: Run the tooltip + treemap tests**

Run: `npm test -- src/__tests__/components/TreemapTooltip.test.tsx src/__tests__/components/Treemap.test.tsx src/__tests__/components/TreemapTile.test.tsx`
Expected: PASS (desktop renders floating card, mobile renders Sheet with `role="dialog"`, `onClose` fires on overlay tap).

- [ ] **Step 4: Typecheck the importers**

Run: `npx tsc --noEmit`
Expected: no errors (confirms `page.tsx` / `Treemap.tsx` still resolve `TileRect` from `TreemapTooltip`).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/DetailPanel.tsx src/components/TreemapTooltip.tsx
git commit -m "refactor(ui): extract DetailPanel shell from TreemapTooltip"
```

---

### Task 3: `useDetailSelection` hook

**Files:**
- Create: `src/lib/use-detail-selection.ts`
- Test: `src/__tests__/lib/use-detail-selection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/use-detail-selection.test.ts`:

```ts
import { renderHook, act } from "@testing-library/react";
import { useDetailSelection } from "@/lib/use-detail-selection";

const rect = { top: 0, left: 0, width: 10, height: 10 };

describe("useDetailSelection", () => {
  it("selects an item and stores its rect", () => {
    const { result } = renderHook(() => useDetailSelection<{ id: string }>());
    const item = { id: "A" };
    act(() => result.current.select(item, rect));
    expect(result.current.selected).toBe(item);
    expect(result.current.rect).toBe(rect);
  });

  it("toggles off when the same item is re-selected", () => {
    const { result } = renderHook(() => useDetailSelection<{ id: string }>());
    const item = { id: "A" };
    act(() => result.current.select(item, rect));
    act(() => result.current.select(item, rect));
    expect(result.current.selected).toBeNull();
  });

  it("dismiss clears selection", () => {
    const { result } = renderHook(() => useDetailSelection<{ id: string }>());
    act(() => result.current.select({ id: "A" }, rect));
    act(() => result.current.dismiss());
    expect(result.current.selected).toBeNull();
  });

  it("dismisses on Escape", () => {
    const { result } = renderHook(() => useDetailSelection<{ id: string }>());
    act(() => result.current.select({ id: "A" }, rect));
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.selected).toBeNull();
  });

  it("dismisses on outside click after the deferral tick", () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useDetailSelection<{ id: string }>());
    act(() => result.current.select({ id: "A" }, rect));
    act(() => {
      jest.runOnlyPendingTimers(); // let the deferred click listener attach
      document.dispatchEvent(new MouseEvent("click"));
    });
    expect(result.current.selected).toBeNull();
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test -- src/__tests__/lib/use-detail-selection.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `src/lib/use-detail-selection.ts`:

```ts
"use client";
import { useCallback, useEffect, useState } from "react";
import type { TileRect } from "@/components/ui/DetailPanel";

export function useDetailSelection<T>() {
  const [selected, setSelected] = useState<T | null>(null);
  const [rect, setRect] = useState<TileRect | null>(null);

  const select = useCallback((item: T, r: TileRect) => {
    setSelected((prev) => {
      if (prev === item) {
        setRect(null);
        return null;
      }
      setRect(r);
      return item;
    });
  }, []);

  const dismiss = useCallback(() => {
    setSelected(null);
    setRect(null);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    const handleClickOutside = () => dismiss();
    document.addEventListener("keydown", handleEsc);
    const timer = window.setTimeout(
      () => document.addEventListener("click", handleClickOutside),
      0,
    );
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.removeEventListener("click", handleClickOutside);
      window.clearTimeout(timer);
    };
  }, [selected, dismiss]);

  return { selected, rect, select, dismiss };
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npm test -- src/__tests__/lib/use-detail-selection.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/use-detail-selection.ts src/__tests__/lib/use-detail-selection.test.ts
git commit -m "feat: add useDetailSelection pin/dismiss hook"
```

---

### Task 4: `ChipDetail` body component

**Files:**
- Create: `src/components/ChipDetail.tsx`
- Test: `src/__tests__/components/ChipDetail.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/components/ChipDetail.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { ChipDetail } from "@/components/ChipDetail";
import type { PortfolioItem, ValuationData } from "@/types";

function item(over: Partial<PortfolioItem> = {}): PortfolioItem {
  return {
    ticker: "AAPL", companyName: "Apple Inc.", sector: "Technology",
    shares: 10, avgCost: 150, addedAt: "",
    quote: { price: 180, change: 2, changePercent: 1.1, previousClose: 178 },
    marketValue: 1800, totalPL: 300, totalPLPercent: 20,
    ...over,
  };
}

describe("ChipDetail", () => {
  it("renders header, sector and analyst sentiment", () => {
    const v: ValuationData = {
      valuationSource: "both",
      recommendationKey: "buy",
      recommendationMean: 2.1,
      numberOfAnalystOpinions: 30,
      targetMeanPrice: 210, targetLowPrice: 150, targetHighPrice: 260,
      upsideToTargetPct: 16.7,
    };
    render(<ChipDetail item={item()} v={v} />);
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
    expect(screen.getByText(/Technology/)).toBeInTheDocument();
    expect(screen.getByText(/Buy/)).toBeInTheDocument();
    expect(screen.getByText(/2\.1/)).toBeInTheDocument();
    expect(screen.getByText(/30 analysts/)).toBeInTheDocument();
  });

  it("renders the price target range bar with low and high labels", () => {
    const v: ValuationData = {
      valuationSource: "analyst_target",
      targetMeanPrice: 210, targetLowPrice: 150, targetHighPrice: 260,
      upsideToTargetPct: 16.7,
    };
    render(<ChipDetail item={item()} v={v} />);
    expect(screen.getByTestId("target-range-bar")).toBeInTheDocument();
    expect(screen.getByText("$150")).toBeInTheDocument();
    expect(screen.getByText("$260")).toBeInTheDocument();
  });

  it("shows a fallback when no price targets are present", () => {
    const v: ValuationData = { valuationSource: "fair_value", fairValueDescription: "Undervalued" };
    render(<ChipDetail item={item()} v={v} />);
    expect(screen.queryByTestId("target-range-bar")).not.toBeInTheDocument();
    expect(screen.getByText(/No price targets/i)).toBeInTheDocument();
  });

  it("positions the current-price marker within the range", () => {
    const v: ValuationData = {
      valuationSource: "analyst_target",
      targetMeanPrice: 210, targetLowPrice: 150, targetHighPrice: 250,
    };
    render(<ChipDetail item={item({ quote: { price: 200, change: 0, changePercent: 0, previousClose: 200 } })} v={v} />);
    // price 200 in [150,250] => 50%
    const marker = screen.getByTestId("current-marker");
    expect(marker).toHaveStyle({ left: "50%" });
  });

  it("renders your-position rows", () => {
    const v: ValuationData = { valuationSource: "none" };
    render(<ChipDetail item={item()} v={v} />);
    expect(screen.getByText("Market Value")).toBeInTheDocument();
    expect(screen.getByText(/\$1,800/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test -- src/__tests__/components/ChipDetail.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ChipDetail.tsx`**

Create `src/components/ChipDetail.tsx`:

```tsx
"use client";
import type { PortfolioItem, RecommendationKey, ValuationData } from "@/types";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
function fmtWhole(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const REC_LABEL: Record<RecommendationKey, string> = {
  strong_buy: "Strong Buy",
  buy: "Buy",
  hold: "Hold",
  sell: "Sell",
  strong_sell: "Strong Sell",
  underperform: "Underperform",
};

function pct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function ChipDetail({ item, v }: { item: PortfolioItem; v: ValuationData }) {
  const dayChange = item.quote.change * item.shares;
  const hasRange = v.targetLowPrice !== undefined && v.targetHighPrice !== undefined;
  const recLabel = v.recommendationKey ? REC_LABEL[v.recommendationKey] : "—";

  let markerPct = 0;
  if (hasRange) {
    const lo = v.targetLowPrice as number;
    const hi = v.targetHighPrice as number;
    const span = hi - lo;
    markerPct = span <= 0 ? 50 : Math.max(0, Math.min(1, (item.quote.price - lo) / span)) * 100;
  }

  return (
    <div className="text-sm">
      <div className="font-display text-base font-semibold text-foreground">
        {item.companyName}
      </div>
      <div className="text-xs text-muted-foreground mb-3 mt-0.5">
        <span className="font-mono">{item.ticker}</span>
        <span className="mx-1.5 opacity-40">·</span>
        {item.sector}
      </div>

      {/* Price */}
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-mono text-foreground">{fmt(item.quote.price)}</span>
        <span className={`font-mono text-xs ${dayChange >= 0 ? "text-positive" : "text-negative"}`}>
          {fmt(dayChange)} ({item.quote.changePercent.toFixed(2)}%)
        </span>
      </div>

      {/* Analyst sentiment */}
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Analyst Rating</div>
      <div className="flex items-baseline justify-between mb-3 text-xs">
        <span className="text-foreground font-medium">{recLabel}</span>
        <span className="font-mono text-muted-foreground">
          {v.recommendationMean !== undefined ? v.recommendationMean.toFixed(1) : "—"}
          {v.numberOfAnalystOpinions ? ` · ${v.numberOfAnalystOpinions} analysts` : ""}
        </span>
      </div>

      {/* Price target range */}
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Price Target</div>
      {hasRange ? (
        <div className="mb-3">
          <div data-testid="target-range-bar" className="relative h-1.5 rounded-full bg-surface-border my-2">
            <div
              data-testid="current-marker"
              className="absolute -top-1 w-1 h-3.5 rounded bg-foreground"
              style={{ left: `${markerPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>{fmtWhole(v.targetLowPrice as number)}</span>
            {v.targetMeanPrice !== undefined && (
              <span className="text-foreground">avg {fmtWhole(v.targetMeanPrice)}</span>
            )}
            <span>{fmtWhole(v.targetHighPrice as number)}</span>
          </div>
          {v.upsideToTargetPct !== undefined && (
            <div className={`text-[11px] mt-1 text-right font-mono ${v.upsideToTargetPct >= 0 ? "text-positive" : "text-negative"}`}>
              {pct(v.upsideToTargetPct)} to avg
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground mb-3">No price targets</div>
      )}

      {/* Fair value */}
      {v.fairValueDescription && (
        <div className="flex items-baseline justify-between mb-3 text-xs">
          <span className="text-muted-foreground">Fair Value</span>
          <span className="text-foreground">
            {v.fairValueDescription}
            {v.fairValueDiscountPct !== undefined ? ` (${pct(v.fairValueDiscountPct)})` : ""}
          </span>
        </div>
      )}

      {/* Your position */}
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 mt-3">Your Position</div>
      <div className="grid grid-cols-2 gap-y-1.5 text-xs">
        <span className="text-muted-foreground">Shares</span>
        <span className="text-right font-mono text-foreground">{item.shares}</span>
        <span className="text-muted-foreground">Market Value</span>
        <span className="text-right font-mono text-foreground">{fmt(item.marketValue)}</span>
        <span className="text-muted-foreground">Total P&L</span>
        <span className={`text-right font-mono ${item.totalPL >= 0 ? "text-positive" : "text-negative"}`}>
          {fmt(item.totalPL)} ({item.totalPLPercent.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npm test -- src/__tests__/components/ChipDetail.test.tsx`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add src/components/ChipDetail.tsx src/__tests__/components/ChipDetail.test.tsx
git commit -m "feat: add ChipDetail panel body with analyst target range"
```

---

### Task 5: Wire `AnalystSentimentCard` chips to the panel

**Files:**
- Modify: `src/components/AnalystSentimentCard.tsx`
- Test: `src/__tests__/components/AnalystSentimentCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/components/AnalystSentimentCard.test.tsx` (the file already stubs `matchMedia` for other suites in the repo; if this file lacks a `matchMedia` stub, add the same `beforeAll` stub used in `TreemapTooltip.test.tsx` so `useIsMobile` doesn't throw):

```tsx
import { fireEvent } from "@testing-library/react";

it("opens a detail panel when a chip is clicked", () => {
  const items = [{
    ticker: "AAPL", companyName: "Apple Inc.", sector: "Technology",
    shares: 10, avgCost: 150, addedAt: "",
    quote: { price: 180, change: 2, changePercent: 1.1, previousClose: 178 },
    marketValue: 1800, totalPL: 300, totalPLPercent: 20,
  }];
  const valuations = {
    AAPL: { valuationSource: "analyst_target" as const, recommendationKey: "buy" as const, recommendationMean: 2.0, numberOfAnalystOpinions: 30, targetMeanPrice: 210, targetLowPrice: 150, targetHighPrice: 260 },
  };
  render(<AnalystSentimentCard items={items} valuations={valuations} />);
  expect(screen.queryByText("Apple Inc.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByTestId("chip-AAPL"));
  expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test -- src/__tests__/components/AnalystSentimentCard.test.tsx -t "detail panel"`
Expected: FAIL — "Apple Inc." never appears (chip is a static span).

- [ ] **Step 3: Wire the hook + panel**

In `src/components/AnalystSentimentCard.tsx`:

Add imports at top:

```tsx
import { useDetailSelection } from "@/lib/use-detail-selection";
import { DetailPanel } from "@/components/ui/DetailPanel";
import { ChipDetail } from "@/components/ChipDetail";
```

Inside the component, before the `return`, add:

```tsx
  const { selected, rect, select } = useDetailSelection<PortfolioItem>();
```

Replace the chip `<span ...>{item.ticker}</span>` (the element with `data-testid={`chip-${item.ticker}`}`) with a button. Remove the `title=` attribute entirely:

```tsx
                <button
                  type="button"
                  key={item.ticker}
                  data-testid={`chip-${item.ticker}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    select(item, e.currentTarget.getBoundingClientRect());
                  }}
                  className={`text-xs font-semibold px-2 py-1 rounded border ${chipClass} text-center cursor-pointer`}
                >
                  {item.ticker}
                </button>
```

Before the closing `</section>`, after the no-coverage strip block, render the panel:

```tsx
      {selected && valuations[selected.ticker] && (
        <DetailPanel rect={rect} onClose={() => select(selected, rect!)}>
          <ChipDetail item={selected} v={valuations[selected.ticker]} />
        </DetailPanel>
      )}
```

Note: `onClose` re-selects the same item, which toggles it off via the hook (matches treemap dismiss semantics). The `rect!` is safe because `selected` implies a prior `select` set `rect`.

- [ ] **Step 4: Run the card tests, verify pass**

Run: `npm test -- src/__tests__/components/AnalystSentimentCard.test.tsx`
Expected: PASS (new test + all existing bucket/sort tests; existing tests use `getByText`/testids which still resolve on the button).

- [ ] **Step 5: Commit**

```bash
git add src/components/AnalystSentimentCard.tsx src/__tests__/components/AnalystSentimentCard.test.tsx
git commit -m "feat(analytics): open detail panel from Analyst Sentiment chips"
```

---

### Task 6: Wire `ValuationCard` chips to the panel

**Files:**
- Modify: `src/components/ValuationCard.tsx`
- Test: `src/__tests__/components/ValuationCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/components/ValuationCard.test.tsx` (add the `matchMedia` `beforeAll` stub from `TreemapTooltip.test.tsx` at the top of this file if not already present):

```tsx
import { fireEvent } from "@testing-library/react";

it("opens a detail panel when a chip is clicked", () => {
  const items = [item("AAPL")];
  const valuations: Record<string, ValuationData> = {
    AAPL: { valuationSource: "both", fairValueDescription: "Undervalued", fairValueDiscountPct: 12, upsideToTargetPct: 15, targetMeanPrice: 210, targetLowPrice: 150, targetHighPrice: 260 },
  };
  render(<ValuationCard items={items} valuations={valuations} />);
  expect(screen.queryByText("Your Position")).not.toBeInTheDocument();
  fireEvent.click(screen.getByTestId("chip-AAPL"));
  expect(screen.getByText("Your Position")).toBeInTheDocument();
});
```

(`item()` helper already exists at the top of this test file; `companyName` equals the ticker there, so assert on the panel-only label "Your Position" to avoid colliding with the chip's own "AAPL" text.)

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test -- src/__tests__/components/ValuationCard.test.tsx -t "detail panel"`
Expected: FAIL — "Your Position" never appears.

- [ ] **Step 3: Wire the hook + panel**

In `src/components/ValuationCard.tsx`:

Add imports at top:

```tsx
import { useDetailSelection } from "@/lib/use-detail-selection";
import { DetailPanel } from "@/components/ui/DetailPanel";
import { ChipDetail } from "@/components/ChipDetail";
```

Inside the component, before `return`:

```tsx
  const { selected, rect, select } = useDetailSelection<PortfolioItem>();
```

Replace the chip `<span ...>` (the one with `data-testid={`chip-${item.ticker}`}` and the inner ticker + subtext spans) with a button, dropping the `title=` attribute but **keeping** the inner `<span className="font-semibold">` and the `subtext` span exactly as they are:

```tsx
                  <button
                    type="button"
                    key={item.ticker}
                    data-testid={`chip-${item.ticker}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      select(item, e.currentTarget.getBoundingClientRect());
                    }}
                    className={`text-xs px-2 py-1 rounded border ${chipClass} text-center flex flex-col gap-0.5 cursor-pointer`}
                  >
                    <span className="font-semibold">{item.ticker}</span>
                    {subtext && <span className="text-[10px] opacity-75 font-normal">{subtext}</span>}
                  </button>
```

Before the closing `</section>`, after the no-coverage strip, render:

```tsx
      {selected && valuations[selected.ticker] && (
        <DetailPanel rect={rect} onClose={() => select(selected, rect!)}>
          <ChipDetail item={selected} v={valuations[selected.ticker]} />
        </DetailPanel>
      )}
```

- [ ] **Step 4: Run the card tests, verify pass**

Run: `npm test -- src/__tests__/components/ValuationCard.test.tsx`
Expected: PASS (new test + existing bucket/sort/subtext tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ValuationCard.tsx src/__tests__/components/ValuationCard.test.tsx
git commit -m "feat(analytics): open detail panel from Valuation chips"
```

---

### Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: all suites PASS.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Typecheck / build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual sandbox check (desktop + mobile)**

Run: `npm run sandbox`, sign in via the seed button, open `/analytics`.
- Click a chip in Analyst Sentiment → floating panel appears near the chip with rating, target range bar, and position rows.
- Click a chip in Valuation → same.
- Click the chip again, press Escape, and click outside → panel dismisses each way.
- Resize to a narrow viewport (≤767px) or use device emulation → clicking a chip opens a bottom Sheet instead, dismissable by tapping the overlay.
- Confirm the range bar's current-price marker sits between the low/high labels.

- [ ] **Step 5: Final commit (only if Step 4 surfaced fixes)**

```bash
git add -A
git commit -m "fix(analytics): chip detail panel polish from manual QA"
```
