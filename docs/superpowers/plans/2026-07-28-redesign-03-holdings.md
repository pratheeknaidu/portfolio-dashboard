# Redesign Plan 3: Holdings Screen + PositionSheet

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `/holdings` screen — a sortable, accessible, keyboard-reachable table that is the documented equivalent of the heat map — plus `PositionSheet`, the single detail-and-actions surface (Edit/Remove) opened from a table row, and the dashboard's 10-row capped table with its nav-aware mobile list.

**Architecture:** A pure `sortHoldings` module (tested in isolation) drives a new rd-token `PositionsTable`. `PositionSheet` is a new self-contained detail sheet built on the existing responsive `Sheet` primitive (bottom sheet on mobile, centred on desktop); it renders rd-styled content and an Edit/Remove footer, and opens the existing `EditHoldingModal` / `ConfirmDialog`. A `usePositionActions` hook centralises the edit/remove state + DELETE so the dashboard and the holdings route share one implementation. Everything is additive: the legacy `HoldingsTable`, `ChipDetail` and `DetailPanel` stay on Analytics untouched until plan 4.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-26-design-handoff-redesign-design.md`
**Predecessors:** plans 1 (foundation + heat map) and 2 (dashboard) — both complete; plan 2 is in open PR #29, which this branch builds on.

---

## Inherited context — do not re-litigate

| Decision | Source |
|---|---|
| Tokens are additive; `--rd-*` coexists with the legacy oklch palette (deleted in plan 4) | Plan 1 |
| `SizingMode` stays `"equity" \| "profit"`; only labels say "P&L" | Spec, *Known gaps* |
| The tree stays GREEN throughout; nothing is deleted that another screen still imports | Plan 2 correction |
| Number formatting: `money`, `signedMoney`, `signedPct` from `src/lib/design/format.ts` (U+2212 minus, tabular) | Plan 1 |
| `usePortfolioData(range)` returns `{ items, failed, status, snapshots, excludedValue, refresh }` | Plan 2 |

**Naming decision (important):** the legacy `src/components/HoldingsTable.tsx` is still imported by `src/app/analytics/page.tsx` and has its own test suite, so it **stays untouched**. The new sortable table is therefore a new file, **`PositionsTable`**. Plan 4 (analytics rewrite) deletes the legacy `HoldingsTable` and may rename `PositionsTable` → `HoldingsTable` then. Do NOT touch the legacy file, its test, or `analytics/page.tsx` in this plan.

**Deferred to plan 4 — do NOT build here:**
- Analytics rewrite, and deletion of legacy `HoldingsTable`, `ChipDetail`, `DetailPanel`, `Navbar`, `MobileMenu`.
- Restyling the `Sheet` primitive to `--rd-*` (it is shared with the analytics `ChipDetail` path via `DetailPanel`, so restyling it now would half-migrate Analytics). `PositionSheet` renders rd-styled content **inside** the existing `Sheet` shell; the thin shell seam is accepted until plan 4.
- **Tile-tap and mover-row → `PositionSheet`.** The dashboard tiles open the plan-1 hover `TreemapTooltip`; unifying that with `PositionSheet` reworks `HeatMapCard`/`Treemap` and is its own task. This plan wires `PositionSheet` from **table rows only**. The `PositionSheet` component is built surface-agnostic so plan 4 can wire tiles/movers to it without change.
- The **mobile heat map "top 10 + aggregate strip"** behaviour. The strip routes to `/holdings`, which this plan creates, so plan 4 can add it; `MobileHoldingsList` is built nav-aware now so it is ready.

**User standing rules:** never add `Co-Authored-By` or any AI mention to commits/PRs; branch before the first commit; default to opening a PR when work is ready; no "for recruiters" framing anywhere.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `src/lib/design/sort-holdings.ts` | Pure sort: column keys, comparator, `HOLDING_COLUMNS` metadata |
| `src/components/PositionsTable.tsx` | Desktop sortable table, one shared grid template, `aria-sort`, row → `onSelect` |
| `src/components/PositionSheet.tsx` | Detail + Edit/Remove footer, in a `Sheet` container |
| `src/components/MobileHoldingsList.tsx` | Nav-aware list: 6 rows + "Show all" (dashboard) / all rows + total + sort (holdings) |
| `src/lib/use-position-actions.tsx` | Shared edit/remove state, modals, and DELETE; used by dashboard + holdings |
| `src/app/holdings/page.tsx` | The `/holdings` route |
| `src/app/demo/holdings/page.tsx` | `/demo/holdings` mirror (re-export) |

**Modify:** `src/components/MobileTabs.tsx` (add Holdings to `NAV_TABS`), `src/app/page.tsx` (dashboard 10-row table + mobile list + position actions).

**Do NOT touch:** `src/components/HoldingsTable.tsx`, `src/components/ChipDetail.tsx`, `src/components/ui/DetailPanel.tsx`, `src/components/ui/Sheet.tsx` (used as-is), `src/app/analytics/page.tsx`.

---

## Task 1: Sort logic and column metadata

**Files:**
- Create: `src/lib/design/sort-holdings.ts`
- Test: `src/__tests__/lib/design/sort-holdings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { sortHoldings, HOLDING_COLUMNS, type SortKey } from "@/lib/design/sort-holdings";
import type { PortfolioItem } from "@/types";

function item(over: Partial<PortfolioItem> & { ticker: string }): PortfolioItem {
  const shares = over.shares ?? 10;
  const avgCost = over.avgCost ?? 100;
  const price = over.quote?.price ?? 110;
  return {
    ticker: over.ticker,
    companyName: over.companyName ?? `${over.ticker} Inc.`,
    sector: over.sector ?? "Technology",
    shares,
    avgCost,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: over.quote ?? { price, change: 1, changePercent: 0.9, previousClose: price - 1 },
    marketValue: over.marketValue ?? shares * price,
    totalPL: over.totalPL ?? shares * (price - avgCost),
    totalPLPercent: over.totalPLPercent ?? ((price - avgCost) / avgCost) * 100,
  };
}

const a = item({ ticker: "AAA", marketValue: 100, totalPL: 5 });
const b = item({ ticker: "BBB", marketValue: 300, totalPL: -10 });
const c = item({ ticker: "CCC", marketValue: 200, totalPL: 20 });

describe("sortHoldings", () => {
  it("returns a new array and does not mutate the input", () => {
    const input = [a, b, c];
    const out = sortHoldings(input, "marketValue", "desc", 600);
    expect(out).not.toBe(input);
    expect(input.map((i) => i.ticker)).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("sorts a numeric column descending and ascending", () => {
    expect(sortHoldings([a, b, c], "marketValue", "desc", 600).map((i) => i.ticker)).toEqual([
      "BBB",
      "CCC",
      "AAA",
    ]);
    expect(sortHoldings([a, b, c], "marketValue", "asc", 600).map((i) => i.ticker)).toEqual([
      "AAA",
      "CCC",
      "BBB",
    ]);
  });

  it("sorts signed columns by value, not magnitude", () => {
    expect(sortHoldings([a, b, c], "totalPL", "desc", 600).map((i) => i.ticker)).toEqual([
      "CCC",
      "AAA",
      "BBB",
    ]);
  });

  it("sorts text columns case-insensitively", () => {
    const lower = item({ ticker: "zeta", companyName: "zeta" });
    const upper = item({ ticker: "Alpha", companyName: "Alpha" });
    expect(sortHoldings([lower, upper], "ticker", "asc", 600).map((i) => i.ticker)).toEqual([
      "Alpha",
      "zeta",
    ]);
  });

  it("derives % of portfolio from the passed total", () => {
    // BBB is 300/600 = 50%, the largest share.
    expect(sortHoldings([a, b, c], "portfolioPercent", "desc", 600)[0].ticker).toBe("BBB");
  });

  it("keeps a stable order for equal values", () => {
    const x = item({ ticker: "X", marketValue: 100 });
    const y = item({ ticker: "Y", marketValue: 100 });
    expect(sortHoldings([x, y], "marketValue", "asc", 200).map((i) => i.ticker)).toEqual(["X", "Y"]);
    expect(sortHoldings([x, y], "marketValue", "desc", 200).map((i) => i.ticker)).toEqual(["X", "Y"]);
  });

  it("sinks a non-finite value to the bottom regardless of direction", () => {
    const bad = item({ ticker: "BAD", marketValue: NaN });
    expect(sortHoldings([bad, a], "marketValue", "desc", 100).map((i) => i.ticker)).toEqual([
      "AAA",
      "BAD",
    ]);
    expect(sortHoldings([bad, a], "marketValue", "asc", 100).map((i) => i.ticker)).toEqual([
      "AAA",
      "BAD",
    ]);
  });

  it("exposes exactly ten columns, ticker first", () => {
    expect(HOLDING_COLUMNS).toHaveLength(10);
    expect(HOLDING_COLUMNS[0].key).toBe("ticker");
    const keys = HOLDING_COLUMNS.map((c) => c.key);
    const expected: SortKey[] = [
      "ticker",
      "companyName",
      "sector",
      "shares",
      "avgCost",
      "price",
      "dayChangePercent",
      "marketValue",
      "totalPL",
      "portfolioPercent",
    ];
    expect(keys).toEqual(expected);
  });

  it("marks numeric columns so the UI can right-align them", () => {
    const byKey = Object.fromEntries(HOLDING_COLUMNS.map((c) => [c.key, c]));
    expect(byKey.ticker.numeric).toBe(false);
    expect(byKey.companyName.numeric).toBe(false);
    expect(byKey.sector.numeric).toBe(false);
    expect(byKey.marketValue.numeric).toBe(true);
    expect(byKey.totalPL.numeric).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/lib/design/sort-holdings.test.ts`
Expected: FAIL — `Cannot find module '@/lib/design/sort-holdings'`.

- [ ] **Step 3: Write the implementation**

```ts
import type { PortfolioItem } from "@/types";

export type SortKey =
  | "ticker"
  | "companyName"
  | "sector"
  | "shares"
  | "avgCost"
  | "price"
  | "dayChangePercent"
  | "marketValue"
  | "totalPL"
  | "portfolioPercent";

export type SortDir = "asc" | "desc";

export interface HoldingColumn {
  key: SortKey;
  label: string;
  /** Right-aligned, tabular-figures, sorted numerically. */
  numeric: boolean;
}

/**
 * One row of column metadata drives both the header and the grid template, so
 * the two can never drift out of alignment. Order here is column order on
 * screen.
 */
export const HOLDING_COLUMNS: HoldingColumn[] = [
  { key: "ticker", label: "Ticker", numeric: false },
  { key: "companyName", label: "Company", numeric: false },
  { key: "sector", label: "Sector", numeric: false },
  { key: "shares", label: "Shares", numeric: true },
  { key: "avgCost", label: "Avg cost", numeric: true },
  { key: "price", label: "Price", numeric: true },
  { key: "dayChangePercent", label: "Day", numeric: true },
  { key: "marketValue", label: "Value", numeric: true },
  { key: "totalPL", label: "Total P&L", numeric: true },
  { key: "portfolioPercent", label: "% Port.", numeric: true },
];

function value(item: PortfolioItem, key: SortKey, totalValue: number): number | string {
  switch (key) {
    case "ticker":
      return item.ticker;
    case "companyName":
      return item.companyName;
    case "sector":
      return item.sector;
    case "shares":
      return item.shares;
    case "avgCost":
      return item.avgCost;
    case "price":
      return item.quote.price;
    case "dayChangePercent":
      return item.quote.changePercent;
    case "marketValue":
      return item.marketValue;
    case "totalPL":
      return item.totalPL;
    case "portfolioPercent":
      return totalValue > 0 ? (item.marketValue / totalValue) * 100 : 0;
  }
}

/**
 * Sort a copy of `items` by one column.
 *
 * Non-finite numbers always sink to the bottom rather than sorting to an end,
 * so one bad quote never steals the top row the eye lands on first. The
 * comparator is applied to a copy, and JS sort is stable (ES2019+), so equal
 * rows keep their prior order — important because the table re-sorts on every
 * header click and a shuffling tie is disorienting.
 */
export function sortHoldings(
  items: PortfolioItem[],
  key: SortKey,
  dir: SortDir,
  totalValue: number,
): PortfolioItem[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...items].sort((x, y) => {
    const a = value(x, key, totalValue);
    const b = value(y, key, totalValue);
    if (typeof a === "string" || typeof b === "string") {
      return sign * String(a).localeCompare(String(b), "en", { sensitivity: "base" });
    }
    const aBad = !Number.isFinite(a);
    const bBad = !Number.isFinite(b);
    if (aBad || bBad) return aBad === bBad ? 0 : aBad ? 1 : -1; // bad always last
    return sign * (a - b);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/lib/design/sort-holdings.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/sort-holdings.ts src/__tests__/lib/design/sort-holdings.test.ts
git commit -m "feat(holdings): pure sort with column metadata

One column table drives both the header and the grid template so they
cannot drift. Non-finite values always sink to the bottom, and the sort
is stable so a tie does not reshuffle on every header click."
```

---

## Task 2: Sortable desktop table

**Files:**
- Create: `src/components/PositionsTable.tsx`
- Test: `src/__tests__/components/PositionsTable.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PositionsTable } from "@/components/PositionsTable";
import type { PortfolioItem } from "@/types";

function item(ticker: string, marketValue: number, totalPL = 0): PortfolioItem {
  return {
    ticker,
    companyName: `${ticker} Inc.`,
    sector: "Technology",
    shares: 10,
    avgCost: 100,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: { price: marketValue / 10, change: 1, changePercent: 0.9, previousClose: 100 },
    marketValue,
    totalPL,
    totalPLPercent: 5,
  };
}

const items = [item("AAA", 100, 5), item("BBB", 300, -10), item("CCC", 200, 20)];

describe("PositionsTable", () => {
  it("renders a row per holding with its ticker", () => {
    render(<PositionsTable items={items} totalValue={600} onSelect={jest.fn()} />);
    for (const t of ["AAA", "BBB", "CCC"]) {
      expect(screen.getByRole("row", { name: new RegExp(t) })).toBeInTheDocument();
    }
  });

  it("defaults to market value, descending", () => {
    render(<PositionsTable items={items} totalValue={600} onSelect={jest.fn()} />);
    const rows = screen.getAllByRole("row").slice(1); // drop header
    expect(rows.map((r) => within(r).getByTestId("cell-ticker").textContent)).toEqual([
      "BBB",
      "CCC",
      "AAA",
    ]);
  });

  it("re-sorts when a column header is clicked, and flips direction on a second click", async () => {
    render(<PositionsTable items={items} totalValue={600} onSelect={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /total p&l/i }));
    let rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getByTestId("cell-ticker").textContent)).toEqual([
      "CCC",
      "AAA",
      "BBB",
    ]);
    await userEvent.click(screen.getByRole("button", { name: /total p&l/i }));
    rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getByTestId("cell-ticker").textContent)).toEqual([
      "BBB",
      "AAA",
      "CCC",
    ]);
  });

  it("marks the active sort column with aria-sort and clears the others", async () => {
    render(<PositionsTable items={items} totalValue={600} onSelect={jest.fn()} />);
    // default is marketValue desc
    expect(screen.getByRole("columnheader", { name: /value/i })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    await userEvent.click(screen.getByRole("button", { name: /shares/i }));
    expect(screen.getByRole("columnheader", { name: /shares/i })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(screen.getByRole("columnheader", { name: /value/i })).not.toHaveAttribute("aria-sort");
  });

  it("calls onSelect with the row's item when a row is activated", async () => {
    const onSelect = jest.fn();
    render(<PositionsTable items={items} totalValue={600} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("row", { name: /AAA/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ ticker: "AAA" }));
  });

  it("carries a P&L direction glyph, not colour alone", () => {
    render(<PositionsTable items={items} totalValue={600} onSelect={jest.fn()} />);
    const bbb = screen.getByRole("row", { name: /BBB/ });
    expect(within(bbb).getByTestId("cell-totalPL").textContent).toMatch(/▼/);
  });

  it("shows an empty note rather than a bare header when there are no holdings", () => {
    render(<PositionsTable items={[]} totalValue={0} onSelect={jest.fn()} />);
    expect(screen.getByText(/no holdings/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/components/PositionsTable.test.tsx`
Expected: FAIL — `Cannot find module '@/components/PositionsTable'`.

- [ ] **Step 3: Write the implementation**

```tsx
"use client";
import { useState } from "react";
import {
  HOLDING_COLUMNS,
  sortHoldings,
  type SortDir,
  type SortKey,
} from "@/lib/design/sort-holdings";
import { money, signedMoney, signedPct } from "@/lib/design/format";
import type { PortfolioItem } from "@/types";

interface PositionsTableProps {
  items: PortfolioItem[];
  totalValue: number;
  onSelect: (item: PortfolioItem) => void;
}

// Ticker | Company (1fr, truncates) | Sector | Shares | Avg | Price | Day | Value | P&L | %
const GRID = "grid-cols-[72px_minmax(0,1fr)_120px_72px_88px_88px_72px_104px_120px_72px]";

function glyph(v: number): string {
  if (v > 0) return "▲";
  if (v < 0) return "▼";
  return "◆";
}

function tone(v: number): string {
  if (v > 0) return "text-rd-gain";
  if (v < 0) return "text-rd-loss";
  return "text-rd-flat";
}

export function PositionsTable({ items, totalValue, onSelect }: PositionsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("marketValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  if (items.length === 0) {
    return <p className="p-6 text-sm text-rd-muted">No holdings to show.</p>;
  }

  const sorted = sortHoldings(items, sortKey, sortDir, totalValue);

  const onHeader = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="overflow-x-auto">
      <div role="table" className="min-w-[900px]">
        <div
          role="row"
          className={`grid ${GRID} gap-2 border-b border-rd-border px-4 py-2`}
        >
          {HOLDING_COLUMNS.map((col) => {
            const active = col.key === sortKey;
            return (
              <div
                key={col.key}
                role="columnheader"
                aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                className={col.numeric ? "text-right" : "text-left"}
              >
                <button
                  type="button"
                  onClick={() => onHeader(col.key)}
                  className="rd-focusable font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label hover:text-rd-text"
                >
                  {col.label}
                  {active && <span aria-hidden="true">{sortDir === "asc" ? " ↑" : " ↓"}</span>}
                </button>
              </div>
            );
          })}
        </div>

        {sorted.map((item) => {
          const pct = totalValue > 0 ? (item.marketValue / totalValue) * 100 : 0;
          const dayPct = item.quote.changePercent;
          return (
            <div
              key={item.ticker}
              role="row"
              aria-label={item.ticker}
              tabIndex={0}
              onClick={() => onSelect(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(item);
                }
              }}
              className={`grid ${GRID} cursor-pointer items-center gap-2 border-b border-rd-border-hairline px-4 py-2.5 text-sm hover:bg-rd-row-hover rd-focusable`}
            >
              <div data-testid="cell-ticker" className="font-mono font-semibold text-rd-text">
                {item.ticker}
              </div>
              <div className="truncate text-rd-body">{item.companyName}</div>
              <div className="truncate text-rd-muted">{item.sector}</div>
              <div className="text-right font-mono tabular-nums text-rd-body">{item.shares}</div>
              <div className="text-right font-mono tabular-nums text-rd-body">
                {money(item.avgCost)}
              </div>
              <div className="text-right font-mono tabular-nums text-rd-body">
                {money(item.quote.price)}
              </div>
              <div className={`text-right font-mono tabular-nums ${tone(dayPct)}`}>
                <span aria-hidden="true">{glyph(dayPct)}</span> {signedPct(dayPct)}
              </div>
              <div className="text-right font-mono tabular-nums text-rd-text">
                {money(item.marketValue)}
              </div>
              <div
                data-testid="cell-totalPL"
                className={`text-right font-mono tabular-nums ${tone(item.totalPL)}`}
              >
                <span aria-hidden="true">{glyph(item.totalPL)}</span> {signedMoney(item.totalPL)}
              </div>
              <div className="text-right font-mono tabular-nums text-rd-muted">
                {pct.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/components/PositionsTable.test.tsx`
Expected: PASS, 7 tests.

> **Note on `getByRole("row", { name: ... })`:** the row's accessible name comes from `aria-label={item.ticker}`, so `{ name: /AAA/ }` matches. Keep the `aria-label` on the row.

- [ ] **Step 5: Commit**

```bash
git add src/components/PositionsTable.tsx src/__tests__/components/PositionsTable.test.tsx
git commit -m "feat(holdings): sortable positions table on a shared grid

Ten columns on one grid template shared by header and rows, so they
cannot misalign. Clickable headers carry aria-sort; rows are focusable
buttons-in-spirit that open the position sheet. P&L carries a glyph."
```

---

## Task 3: PositionSheet

**Files:**
- Create: `src/components/PositionSheet.tsx`
- Test: `src/__tests__/components/PositionSheet.test.tsx`

The detail-and-actions surface. Built on the existing `Sheet` (`src/components/ui/Sheet.tsx`) which is already responsive — a bottom sheet on mobile, centred on desktop. It renders rd-styled content and an **Edit** / **Remove** footer; the two buttons call props so the parent owns the modals (Task 5 provides them). Surface-agnostic on purpose: plan 4 will open it from tiles and mover rows unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PositionSheet } from "@/components/PositionSheet";
import type { PortfolioItem } from "@/types";

const item: PortfolioItem = {
  ticker: "AAPL",
  companyName: "Apple Inc.",
  sector: "Technology",
  shares: 100,
  avgCost: 100,
  addedAt: "2026-01-02T00:00:00.000Z",
  quote: { price: 110, change: 2, changePercent: 1.85, previousClose: 108 },
  marketValue: 11000,
  totalPL: 1000,
  totalPLPercent: 10,
};

const props = { item, onClose: jest.fn(), onEdit: jest.fn(), onRemove: jest.fn() };

describe("PositionSheet", () => {
  it("renders nothing when there is no item", () => {
    const { container } = render(<PositionSheet {...props} item={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the company, ticker and sector", () => {
    render(<PositionSheet {...props} />);
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText(/Technology/)).toBeInTheDocument();
  });

  it("shows the position figures, formatted", () => {
    render(<PositionSheet {...props} />);
    expect(screen.getByText("$11,000.00")).toBeInTheDocument(); // market value
    expect(screen.getByText(/\+\$1,000\.00/)).toBeInTheDocument(); // total P&L
    expect(screen.getByText("100")).toBeInTheDocument(); // shares
  });

  it("uses a true minus sign on a loss, never a hyphen", () => {
    render(<PositionSheet {...props} item={{ ...item, totalPL: -250, totalPLPercent: -2 }} />);
    const el = screen.getByText(/250\.00/);
    expect(el.textContent).toContain("−");
    expect(el.textContent).not.toContain("-");
  });

  it("fires onEdit and onRemove from the footer", async () => {
    const onEdit = jest.fn();
    const onRemove = jest.fn();
    render(<PositionSheet {...props} onEdit={onEdit} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ ticker: "AAPL" }));
    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ ticker: "AAPL" }));
  });

  it("closes on the overlay", async () => {
    const onClose = jest.fn();
    render(<PositionSheet {...props} onClose={onClose} />);
    await userEvent.click(screen.getByTestId("sheet-overlay"));
    expect(onClose).toHaveBeenCalled();
  });

  it("gives both actions a 44px minimum touch target", () => {
    render(<PositionSheet {...props} />);
    expect(screen.getByRole("button", { name: /edit/i })).toHaveClass("min-h-[44px]");
    expect(screen.getByRole("button", { name: /remove/i })).toHaveClass("min-h-[44px]");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/components/PositionSheet.test.tsx`
Expected: FAIL — `Cannot find module '@/components/PositionSheet'`.

- [ ] **Step 3: Write the implementation**

```tsx
"use client";
import { Sheet } from "@/components/ui/Sheet";
import { money, signedMoney, signedPct } from "@/lib/design/format";
import type { PortfolioItem } from "@/types";

interface PositionSheetProps {
  item: PortfolioItem | null;
  onClose: () => void;
  onEdit: (item: PortfolioItem) => void;
  onRemove: (item: PortfolioItem) => void;
}

function tone(v: number): string {
  if (v > 0) return "text-rd-gain";
  if (v < 0) return "text-rd-loss";
  return "text-rd-flat";
}

/**
 * The single detail-and-actions surface for a position. Opened today from a
 * table row; built surface-agnostic so plan 4 can open it from a tile tap and
 * a mover row unchanged.
 *
 * It renders rd-styled content inside the shared `Sheet` shell rather than
 * restyling `Sheet` itself — `Sheet` is still on the legacy `ChipDetail` path
 * on Analytics, which plan 4 migrates.
 */
export function PositionSheet({ item, onClose, onEdit, onRemove }: PositionSheetProps) {
  if (!item) return null;

  const dayChange = item.quote.change * item.shares;

  return (
    <Sheet open onClose={onClose} labelledBy="position-sheet-title">
      <div className="bg-rd-card p-5">
        <h2 id="position-sheet-title" className="text-base font-semibold text-rd-text">
          {item.companyName}
        </h2>
        <p className="mt-0.5 text-xs text-rd-muted">
          <span className="font-mono">{item.ticker}</span>
          <span className="mx-1.5 opacity-40">·</span>
          {item.sector}
        </p>

        <div className="mt-4 flex items-baseline justify-between">
          <span className="font-mono text-lg tabular-nums text-rd-text">
            {money(item.quote.price)}
          </span>
          <span className={`font-mono text-sm tabular-nums ${tone(dayChange)}`}>
            {signedMoney(dayChange)} ({signedPct(item.quote.changePercent)})
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-y-2 border-t border-rd-border-hairline pt-4 text-sm">
          <dt className="text-rd-muted">Shares</dt>
          <dd className="text-right font-mono tabular-nums text-rd-body">{item.shares}</dd>
          <dt className="text-rd-muted">Market value</dt>
          <dd className="text-right font-mono tabular-nums text-rd-text">
            {money(item.marketValue)}
          </dd>
          <dt className="text-rd-muted">Total P&amp;L</dt>
          <dd className={`text-right font-mono tabular-nums ${tone(item.totalPL)}`}>
            {signedMoney(item.totalPL)} ({signedPct(item.totalPLPercent)})
          </dd>
        </dl>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => onEdit(item)}
            className="rd-focusable inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-rd-border-control bg-rd-control text-sm font-medium text-rd-text hover:border-rd-border-strong"
          >
            Edit
          </button>
          <button
            onClick={() => onRemove(item)}
            className="rd-focusable inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-rd-border-control text-sm font-medium text-rd-loss hover:border-rd-border-strong"
          >
            Remove
          </button>
        </div>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/components/PositionSheet.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/PositionSheet.tsx src/__tests__/components/PositionSheet.test.tsx
git commit -m "feat(holdings): position sheet with edit/remove footer

The single detail-and-actions surface for a position, built on the
existing responsive Sheet. Renders rd content inside the legacy shell
rather than restyling Sheet, which is still on the analytics path.
Surface-agnostic so plan 4 can open it from tiles and movers."
```

---

## Task 4: Nav-aware mobile list

**Files:**
- Create: `src/components/MobileHoldingsList.tsx`
- Test: `src/__tests__/components/MobileHoldingsList.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { MobileHoldingsList } from "@/components/MobileHoldingsList";
import type { PortfolioItem } from "@/types";

function item(ticker: string, marketValue: number): PortfolioItem {
  return {
    ticker,
    companyName: `${ticker} Inc.`,
    sector: "Technology",
    shares: 10,
    avgCost: 100,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: { price: marketValue / 10, change: 1, changePercent: 0.9, previousClose: 100 },
    marketValue,
    totalPL: 5,
    totalPLPercent: 5,
  };
}

const many = Array.from({ length: 9 }, (_, i) => item(`T${i}`, (9 - i) * 100));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("MobileHoldingsList", () => {
  it("on the dashboard shows six rows and a Show all link, largest first", () => {
    render(
      <MobileHoldingsList items={many} totalValue={4500} variant="dashboard" onSelect={jest.fn()} />,
    );
    expect(screen.getAllByTestId("holding-row")).toHaveLength(6);
    expect(screen.getByTestId("holding-row")).toHaveTextContent("T0"); // largest value
    expect(screen.getByRole("link", { name: /show all/i })).toHaveAttribute("href", "/holdings");
  });

  it("links Show all into /demo when in demo mode", () => {
    render(
      <MobileHoldingsList
        items={many}
        totalValue={4500}
        variant="dashboard"
        onSelect={jest.fn()}
        demo
      />,
    );
    expect(screen.getByRole("link", { name: /show all/i })).toHaveAttribute(
      "href",
      "/demo/holdings",
    );
  });

  it("on the holdings screen shows every row and no Show all link", () => {
    render(
      <MobileHoldingsList items={many} totalValue={4500} variant="holdings" onSelect={jest.fn()} />,
    );
    expect(screen.getAllByTestId("holding-row")).toHaveLength(9);
    expect(screen.queryByRole("link", { name: /show all/i })).toBeNull();
  });

  it("on the holdings screen shows a total row", () => {
    render(
      <MobileHoldingsList items={many} totalValue={4500} variant="holdings" onSelect={jest.fn()} />,
    );
    expect(screen.getByTestId("total-row")).toHaveTextContent("$4,500.00");
  });

  it("selects the item on tap", async () => {
    const onSelect = jest.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <MobileHoldingsList
        items={[item("AAA", 100)]}
        totalValue={100}
        variant="holdings"
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByTestId("holding-row"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ ticker: "AAA" }));
  });

  it("gives each row a 44px minimum touch target", () => {
    render(
      <MobileHoldingsList
        items={[item("AAA", 100)]}
        totalValue={100}
        variant="holdings"
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByTestId("holding-row")).toHaveClass("min-h-[44px]");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/components/MobileHoldingsList.test.tsx`
Expected: FAIL — `Cannot find module '@/components/MobileHoldingsList'`.

- [ ] **Step 3: Write the implementation**

```tsx
"use client";
import Link from "next/link";
import { sortHoldings } from "@/lib/design/sort-holdings";
import { money, signedPct } from "@/lib/design/format";
import type { PortfolioItem } from "@/types";

interface MobileHoldingsListProps {
  items: PortfolioItem[];
  totalValue: number;
  /** dashboard: 6 rows + "Show all"; holdings: all rows + total. */
  variant: "dashboard" | "holdings";
  onSelect: (item: PortfolioItem) => void;
  demo?: boolean;
}

const DASHBOARD_ROWS = 6;

function tone(v: number): string {
  if (v > 0) return "text-rd-gain";
  if (v < 0) return "text-rd-loss";
  return "text-rd-flat";
}

/**
 * Nav-aware because the mobile heat map's "+N smaller positions" strip (plan 4)
 * routes here: a Dashboard slice that stopped at 6 would send the user to a
 * screen that does not contain the position they tapped. On Holdings it shows
 * everything plus a total; on the Dashboard it shows the top 6 and links on.
 */
export function MobileHoldingsList({
  items,
  totalValue,
  variant,
  onSelect,
  demo = false,
}: MobileHoldingsListProps) {
  const sorted = sortHoldings(items, "marketValue", "desc", totalValue);
  const rows = variant === "dashboard" ? sorted.slice(0, DASHBOARD_ROWS) : sorted;
  const showAllHref = demo ? "/demo/holdings" : "/holdings";

  return (
    <div className="flex flex-col">
      {rows.map((item) => (
        <button
          key={item.ticker}
          data-testid="holding-row"
          onClick={() => onSelect(item)}
          className="rd-focusable flex min-h-[44px] items-center justify-between gap-3 border-b border-rd-border-hairline px-1 py-2 text-left"
        >
          <span className="min-w-0">
            <span className="font-mono text-sm font-semibold text-rd-text">{item.ticker}</span>
            <span className="ml-2 truncate text-xs text-rd-muted">{item.companyName}</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-mono text-sm tabular-nums text-rd-text">
              {money(item.marketValue)}
            </span>
            <span className={`block font-mono text-xs tabular-nums ${tone(item.totalPL)}`}>
              {signedPct(item.totalPLPercent)}
            </span>
          </span>
        </button>
      ))}

      {variant === "dashboard" && sorted.length > DASHBOARD_ROWS && (
        <Link
          href={showAllHref}
          className="rd-focusable mt-2 inline-flex min-h-[44px] items-center justify-center text-sm font-medium text-rd-text"
        >
          Show all {sorted.length} holdings →
        </Link>
      )}

      {variant === "holdings" && (
        <div
          data-testid="total-row"
          className="flex items-center justify-between px-1 py-3 text-sm font-semibold text-rd-text"
        >
          <span>Total</span>
          <span className="font-mono tabular-nums">{money(totalValue)}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/components/MobileHoldingsList.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/MobileHoldingsList.tsx src/__tests__/components/MobileHoldingsList.test.tsx
git commit -m "feat(holdings): nav-aware mobile holdings list

Six rows and a Show-all link on the dashboard; all rows plus a total on
the holdings screen. Nav-aware so the mobile map's aggregate strip (plan
4) routes to a screen that actually contains the tapped position."
```

---

## Task 5: Shared position actions hook

The dashboard and the holdings route both need the same edit/remove behaviour: open `PositionSheet` on select, open `EditHoldingModal` on Edit, confirm + DELETE on Remove. This hook centralises it so the two screens cannot drift.

**Files:**
- Create: `src/lib/use-position-actions.tsx`
- Test: `src/__tests__/lib/use-position-actions.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePositionActions } from "@/lib/use-position-actions";
import type { PortfolioItem } from "@/types";

const mockGetIdToken = jest.fn<Promise<string | null>, []>();
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ getIdToken: () => mockGetIdToken() }) }));

const mockToastError = jest.fn();
jest.mock("@/lib/toast-context", () => ({
  useToast: () => ({ error: mockToastError, info: jest.fn(), success: jest.fn(), show: jest.fn(), dismiss: jest.fn(), toasts: [] }),
}));

const item = (ticker: string): PortfolioItem => ({
  ticker,
  companyName: `${ticker} Inc.`,
  sector: "Technology",
  shares: 10,
  avgCost: 100,
  addedAt: "2026-01-02T00:00:00.000Z",
  quote: { price: 110, change: 1, changePercent: 0.9, previousClose: 109 },
  marketValue: 1100,
  totalPL: 100,
  totalPLPercent: 10,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetIdToken.mockResolvedValue("token-123");
});

describe("usePositionActions", () => {
  it("selecting a position sets it as the sheet target", () => {
    const { result } = renderHook(() => usePositionActions(jest.fn()));
    act(() => result.current.select(item("AAPL")));
    expect(result.current.selected?.ticker).toBe("AAPL");
  });

  it("edit closes the sheet and opens the edit modal for that item", () => {
    const { result } = renderHook(() => usePositionActions(jest.fn()));
    act(() => result.current.select(item("AAPL")));
    act(() => result.current.edit(item("AAPL")));
    expect(result.current.selected).toBeNull();
    expect(result.current.editing?.ticker).toBe("AAPL");
  });

  it("remove opens a confirm rather than deleting immediately", () => {
    const { result } = renderHook(() => usePositionActions(jest.fn()));
    act(() => result.current.remove(item("AAPL")));
    expect(result.current.confirming?.ticker).toBe("AAPL");
  });

  it("confirming the remove DELETEs the ticker and refreshes", async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const refresh = jest.fn();
    const { result } = renderHook(() => usePositionActions(refresh));
    act(() => result.current.remove(item("ZZZ")));
    await act(async () => {
      await result.current.confirmRemove();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/portfolio/ZZZ",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(refresh).toHaveBeenCalled();
    expect(result.current.confirming).toBeNull();
  });

  it("toasts and keeps the confirm open when the delete fails", async () => {
    const fetchMock = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const refresh = jest.fn();
    const { result } = renderHook(() => usePositionActions(refresh));
    act(() => result.current.remove(item("ZZZ")));
    await act(async () => {
      await result.current.confirmRemove();
    });
    expect(mockToastError).toHaveBeenCalledWith("Couldn't remove ZZZ.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("dismiss clears the sheet", () => {
    const { result } = renderHook(() => usePositionActions(jest.fn()));
    act(() => result.current.select(item("AAPL")));
    act(() => result.current.dismiss());
    expect(result.current.selected).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/lib/use-position-actions.test.tsx`
Expected: FAIL — `Cannot find module '@/lib/use-position-actions'`.

- [ ] **Step 3: Write the implementation**

```tsx
"use client";
import { useCallback, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import type { PortfolioItem } from "@/types";

export interface PositionActions {
  selected: PortfolioItem | null;
  editing: PortfolioItem | null;
  confirming: PortfolioItem | null;
  select: (item: PortfolioItem) => void;
  dismiss: () => void;
  edit: (item: PortfolioItem) => void;
  closeEdit: () => void;
  remove: (item: PortfolioItem) => void;
  cancelRemove: () => void;
  confirmRemove: () => Promise<void>;
}

/**
 * One edit/remove flow for both the dashboard and the holdings screen. Edit and
 * Remove hand off to the existing EditHoldingModal / ConfirmDialog; the parent
 * renders those from the returned state, so this hook owns the decisions and
 * the screens stay identical.
 */
export function usePositionActions(refresh: () => void): PositionActions {
  const { getIdToken } = useAuth();
  const toast = useToast();
  const [selected, setSelected] = useState<PortfolioItem | null>(null);
  const [editing, setEditing] = useState<PortfolioItem | null>(null);
  const [confirming, setConfirming] = useState<PortfolioItem | null>(null);

  const select = useCallback((item: PortfolioItem) => setSelected(item), []);
  const dismiss = useCallback(() => setSelected(null), []);

  const edit = useCallback((item: PortfolioItem) => {
    setSelected(null);
    setEditing(item);
  }, []);
  const closeEdit = useCallback(() => setEditing(null), []);

  const remove = useCallback((item: PortfolioItem) => {
    setSelected(null);
    setConfirming(item);
  }, []);
  const cancelRemove = useCallback(() => setConfirming(null), []);

  const confirmRemove = useCallback(async () => {
    if (!confirming) return;
    const ticker = confirming.ticker;
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
      setConfirming(null);
      refresh();
    } catch {
      toast.error(`Couldn't remove ${ticker}.`);
    }
  }, [confirming, getIdToken, toast, refresh]);

  return {
    selected,
    editing,
    confirming,
    select,
    dismiss,
    edit,
    closeEdit,
    remove,
    cancelRemove,
    confirmRemove,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/lib/use-position-actions.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/use-position-actions.tsx src/__tests__/lib/use-position-actions.test.tsx
git commit -m "feat(holdings): shared position-actions hook

One select/edit/remove flow for the dashboard and the holdings screen so
the two cannot drift. Remove confirms before it DELETEs; a failed delete
toasts and leaves the confirm open."
```

---

## Task 6: The /holdings route

**Files:**
- Create: `src/app/holdings/page.tsx`, `src/app/demo/holdings/page.tsx`
- Test: `src/__tests__/app/holdings-page.test.tsx`

- [ ] **Step 1: Write the failing test**

The page composes tested pieces, so the test asserts composition and the desktop/mobile switch, mocking the data hook and the responsive hook.

```tsx
import { render, screen } from "@testing-library/react";
import HoldingsPage from "@/app/holdings/page";
import type { PortfolioItem } from "@/types";

const item = (ticker: string, mv: number): PortfolioItem => ({
  ticker,
  companyName: `${ticker} Inc.`,
  sector: "Technology",
  shares: 10,
  avgCost: 100,
  addedAt: "2026-01-02T00:00:00.000Z",
  quote: { price: mv / 10, change: 1, changePercent: 0.9, previousClose: 100 },
  marketValue: mv,
  totalPL: 5,
  totalPLPercent: 5,
});

let mockData = {
  items: [item("AAA", 100), item("BBB", 300)],
  failed: [],
  status: "ready",
  snapshots: [],
  excludedValue: 0,
  refresh: jest.fn(),
};
jest.mock("@/lib/use-portfolio-data", () => ({ usePortfolioData: () => mockData }));

let mockMobile = false;
jest.mock("@/lib/use-is-mobile", () => ({ useIsMobile: () => mockMobile }));
jest.mock("@/lib/demo-context", () => ({ useIsDemo: () => false }));
jest.mock("@/components/AuthGuard", () => ({ AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ getIdToken: async () => "t", signOut: jest.fn() }) }));
jest.mock("@/lib/toast-context", () => ({ useToast: () => ({ error: jest.fn(), info: jest.fn(), success: jest.fn(), show: jest.fn(), dismiss: jest.fn(), toasts: [] }) }));
jest.mock("next/navigation", () => ({ usePathname: () => "/holdings" }));

describe("HoldingsPage", () => {
  beforeEach(() => {
    mockMobile = false;
    mockData = { ...mockData, status: "ready", items: [item("AAA", 100), item("BBB", 300)] };
  });

  it("renders the desktop table with every holding", () => {
    render(<HoldingsPage />);
    expect(screen.getByRole("row", { name: /AAA/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /BBB/ })).toBeInTheDocument();
  });

  it("renders the mobile list on a narrow viewport", () => {
    mockMobile = true;
    render(<HoldingsPage />);
    expect(screen.getAllByTestId("holding-row").length).toBe(2);
  });

  it("shows the empty state when there are no holdings", () => {
    mockData = { ...mockData, status: "empty", items: [] };
    render(<HoldingsPage />);
    expect(screen.getByText(/no holdings yet/i)).toBeInTheDocument();
  });

  it("shows a skeleton while loading", () => {
    mockData = { ...mockData, status: "loading", items: [] };
    render(<HoldingsPage />);
    expect(screen.getByRole("status")).toHaveAccessibleName(/loading/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/app/holdings-page.test.tsx`
Expected: FAIL — `Cannot find module '@/app/holdings/page'`.

- [ ] **Step 3: Write `src/app/holdings/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { PositionsTable } from "@/components/PositionsTable";
import { MobileHoldingsList } from "@/components/MobileHoldingsList";
import { PositionSheet } from "@/components/PositionSheet";
import { EmptyPortfolio } from "@/components/EmptyPortfolio";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { EditHoldingModal } from "@/components/EditHoldingModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CsvImportModal } from "@/components/CsvImportModal";
import { AddHoldingModal } from "@/components/AddHoldingModal";
import { usePortfolioData } from "@/lib/use-portfolio-data";
import { usePositionActions } from "@/lib/use-position-actions";
import { useIsMobile } from "@/lib/use-is-mobile";
import { useIsDemo } from "@/lib/demo-context";
import { useAuth } from "@/lib/auth-context";
import { isMarketOpen } from "@/lib/market-hours";

export default function HoldingsPage() {
  const { items, status, refresh } = usePortfolioData("1D");
  const { signOut } = useAuth();
  const isDemo = useIsDemo();
  const isMobile = useIsMobile();
  const actions = usePositionActions(refresh);
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const totalValue = items.reduce((sum, i) => sum + i.marketValue, 0);

  const openImport = () => (isDemo ? undefined : setShowImport(true));
  const openAdd = () => (isDemo ? undefined : setShowAdd(true));

  return (
    <AuthGuard>
      <AppShell
        topBar={
          <TopBar
            onImportClick={openImport}
            onAddClick={openAdd}
            onSignOut={signOut}
            isDemo={isDemo}
            marketOpen={isMarketOpen()}
            vix={null}
          />
        }
      >
        {status === "loading" ? (
          <DashboardSkeleton />
        ) : status === "empty" ? (
          <EmptyPortfolio onImportClick={openImport} onAddClick={openAdd} />
        ) : (
          <section aria-label="Holdings" className="rounded-xl border border-rd-border bg-rd-card">
            {isMobile ? (
              <div className="p-4">
                <MobileHoldingsList
                  items={items}
                  totalValue={totalValue}
                  variant="holdings"
                  onSelect={actions.select}
                  demo={isDemo}
                />
              </div>
            ) : (
              <PositionsTable items={items} totalValue={totalValue} onSelect={actions.select} />
            )}
          </section>
        )}
      </AppShell>

      <PositionSheet
        item={actions.selected}
        onClose={actions.dismiss}
        onEdit={actions.edit}
        onRemove={actions.remove}
      />
      {actions.editing && (
        <EditHoldingModal
          holding={actions.editing}
          onClose={actions.closeEdit}
          onSuccess={() => {
            actions.closeEdit();
            refresh();
          }}
        />
      )}
      {actions.confirming && (
        <ConfirmDialog
          title={`Remove ${actions.confirming.ticker}?`}
          message="This deletes the holding from your portfolio."
          onConfirm={actions.confirmRemove}
          onCancel={actions.cancelRemove}
        />
      )}
      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onAddSingle={() => {
            setShowImport(false);
            setShowAdd(true);
          }}
          onSuccess={() => {
            setShowImport(false);
            refresh();
          }}
        />
      )}
      {showAdd && (
        <AddHoldingModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            refresh();
          }}
        />
      )}
    </AuthGuard>
  );
}
```

> **Reconcile before finalising:** open `src/app/page.tsx` and copy the EXACT prop names it passes to `CsvImportModal`, `AddHoldingModal`, `EditHoldingModal`, `ConfirmDialog`, and `TopBar`. If any differ from the above (e.g. modal callback names), match the real components — `tsc` must pass. Confirm `useIsMobile` is exported from `@/lib/use-is-mobile` and `EmptyPortfolio` accepts `{ onImportClick, onAddClick }`.

- [ ] **Step 4: Write `src/app/demo/holdings/page.tsx`**

```tsx
// The demo holdings screen is the same component; demo behaviour comes from the
// DemoProvider in the /demo segment's layout.
export { default } from "@/app/holdings/page";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/__tests__/app/holdings-page.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/holdings/page.tsx src/app/demo/holdings/page.tsx src/__tests__/app/holdings-page.test.tsx
git commit -m "feat(holdings): the /holdings route

The sortable table on desktop, the nav-aware list on mobile, with the
shared position-actions flow for edit and remove. Mirrored under /demo."
```

---

## Task 7: Add Holdings to the nav

**Files:**
- Modify: `src/components/MobileTabs.tsx`
- Test: `src/__tests__/components/MobileTabs.test.tsx` (extend), `src/__tests__/components/TopBar.test.tsx` (should still pass)

- [ ] **Step 1: Update the failing test**

Add to `src/__tests__/components/MobileTabs.test.tsx` inside the `describe`:

```tsx
  it("includes a Holdings tab between Dashboard and Analytics", () => {
    expect(NAV_TABS.map((t) => t.label)).toEqual(["Dashboard", "Holdings", "Analytics"]);
  });

  it("marks Holdings current on the /holdings route", () => {
    mockPathname.mockReturnValue("/holdings");
    render(<MobileTabs />);
    expect(screen.getByRole("link", { name: "Holdings" })).toHaveAttribute("aria-current", "page");
  });

  it("resolves Holdings active under the /demo prefix", () => {
    mockPathname.mockReturnValue("/demo/holdings");
    render(<MobileTabs />);
    expect(screen.getByRole("link", { name: "Holdings" })).toHaveAttribute("aria-current", "page");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/components/MobileTabs.test.tsx`
Expected: FAIL — `NAV_TABS` is `["Dashboard", "Analytics"]`.

- [ ] **Step 3: Add the tab**

In `src/components/MobileTabs.tsx`, change `NAV_TABS` to:

```tsx
export const NAV_TABS: NavTab[] = [
  { href: "/", label: "Dashboard" },
  { href: "/holdings", label: "Holdings" },
  { href: "/analytics", label: "Analytics" },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/components/MobileTabs.test.tsx src/__tests__/components/TopBar.test.tsx`
Expected: PASS. `TopBar` renders `NAV_TABS` too, so confirm its suite is still green (it queries by button/status roles, not the tab links, so the extra tab does not break it).

- [ ] **Step 5: Commit**

```bash
git add src/components/MobileTabs.tsx src/__tests__/components/MobileTabs.test.tsx
git commit -m "feat(nav): add the Holdings tab

Now that /holdings exists, the third tab the spec's mobile section calls
for is live in both the desktop nav and the mobile segmented control."
```

---

## Task 8: Dashboard 10-row table + mobile list

**Files:**
- Modify: `src/app/page.tsx`
- Test: `src/__tests__/app/dashboard-holdings.test.tsx`

The dashboard gains the holdings table capped at 10 rows (desktop) / the 6-row mobile list, wired to the same `usePositionActions` flow. Replace the dashboard's existing `handleRemoveTicker` with the shared hook so there is one implementation.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import DashboardPage from "@/app/page";
import type { PortfolioItem } from "@/types";

const mkItems = (n: number): PortfolioItem[] =>
  Array.from({ length: n }, (_, i) => ({
    ticker: `T${i}`,
    companyName: `T${i} Inc.`,
    sector: "Technology",
    shares: 10,
    avgCost: 100,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: { price: 110, change: 1, changePercent: 0.9, previousClose: 109 },
    marketValue: (n - i) * 100,
    totalPL: 5,
    totalPLPercent: 5,
  }));

let mockData = {
  items: mkItems(14),
  failed: [],
  status: "ready",
  snapshots: [],
  excludedValue: 0,
  refresh: jest.fn(),
};
jest.mock("@/lib/use-portfolio-data", () => ({ usePortfolioData: () => mockData }));
jest.mock("@/lib/use-is-mobile", () => ({ useIsMobile: () => false }));
jest.mock("@/lib/demo-context", () => ({ useIsDemo: () => false }));
jest.mock("@/components/AuthGuard", () => ({ AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ getIdToken: async () => "t", signOut: jest.fn() }) }));
jest.mock("@/lib/toast-context", () => ({ useToast: () => ({ error: jest.fn(), info: jest.fn(), success: jest.fn(), show: jest.fn(), dismiss: jest.fn(), toasts: [] }) }));
jest.mock("next/navigation", () => ({ usePathname: () => "/" }));
// The heat map pulls in nivo; stub it so this composition test stays fast.
jest.mock("@/components/HeatMapCard", () => ({ HeatMapCard: () => <div data-testid="heatmap" /> }));

describe("Dashboard holdings table", () => {
  it("caps the dashboard table at 10 rows even with more holdings", () => {
    mockData = { ...mockData, items: mkItems(14) };
    render(<DashboardPage />);
    expect(screen.getAllByRole("row").length - 1).toBe(10); // minus header row
  });

  it("links to the full holdings screen when capped", () => {
    mockData = { ...mockData, items: mkItems(14) };
    render(<DashboardPage />);
    expect(screen.getByRole("link", { name: /all holdings/i })).toHaveAttribute("href", "/holdings");
  });

  it("does not show the see-all link when 10 or fewer", () => {
    mockData = { ...mockData, items: mkItems(8) };
    render(<DashboardPage />);
    expect(screen.queryByRole("link", { name: /all holdings/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/__tests__/app/dashboard-holdings.test.tsx`
Expected: FAIL — the dashboard renders no holdings table yet.

- [ ] **Step 3: Wire the dashboard**

In `src/app/page.tsx`:

1. Add imports:
```tsx
import Link from "next/link";
import { PositionsTable } from "@/components/PositionsTable";
import { MobileHoldingsList } from "@/components/MobileHoldingsList";
import { PositionSheet } from "@/components/PositionSheet";
import { EditHoldingModal } from "@/components/EditHoldingModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePositionActions } from "@/lib/use-position-actions";
import { useIsMobile } from "@/lib/use-is-mobile";
```

2. Replace the existing `handleRemoveTicker` and its `useCallback` with the shared hook:
```tsx
  const actions = usePositionActions(fetchPortfolio);
  const isMobile = useIsMobile();
```
Delete the old `handleRemoveTicker` definition. The `FailedTickersStrip`'s `onRemove` becomes `(ticker) => actions.remove(items.find((i) => i.ticker === ticker) ?? { ticker } as never)` — **NO.** Simpler: keep the strip removing by ticker via a thin inline handler that finds the item and calls `actions.remove`, or leave the strip's existing remove path. To avoid overreach, keep `FailedTickersStrip`'s remove wired to a small local:
```tsx
  const removeByTicker = (ticker: string) => {
    const found = items.find((i) => i.ticker === ticker);
    if (found) actions.remove(found);
  };
```
and pass `onRemove={removeByTicker}` to `FailedTickersStrip`. (A failed ticker may not be in `items`; if not found, there is nothing to sheet-confirm — the strip's Retry is the relevant action for those anyway.)

3. Below the `AllocationStrip` block, add the holdings section:
```tsx
            <div className="mt-4 rounded-xl border border-rd-border bg-rd-card">
              <div className="flex items-center justify-between px-4 pt-4">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
                  Holdings
                </h2>
                {items.length > 10 && (
                  <Link
                    href={isDemo ? "/demo/holdings" : "/holdings"}
                    className="rd-focusable text-xs font-medium text-rd-muted hover:text-rd-text"
                  >
                    All holdings →
                  </Link>
                )}
              </div>
              {isMobile ? (
                <div className="p-4">
                  <MobileHoldingsList
                    items={items}
                    totalValue={totals.totalValue}
                    variant="dashboard"
                    onSelect={actions.select}
                    demo={isDemo}
                  />
                </div>
              ) : (
                <PositionsTable
                  items={[...items].sort((a, b) => b.marketValue - a.marketValue).slice(0, 10)}
                  totalValue={totals.totalValue}
                  onSelect={actions.select}
                />
              )}
            </div>
```

4. Before the closing `</AuthGuard>`, add the sheet + modals (mirroring the holdings route):
```tsx
      <PositionSheet
        item={actions.selected}
        onClose={actions.dismiss}
        onEdit={actions.edit}
        onRemove={actions.remove}
      />
      {actions.editing && (
        <EditHoldingModal
          holding={actions.editing}
          onClose={actions.closeEdit}
          onSuccess={() => {
            actions.closeEdit();
            fetchPortfolio();
          }}
        />
      )}
      {actions.confirming && (
        <ConfirmDialog
          title={`Remove ${actions.confirming.ticker}?`}
          message="This deletes the holding from your portfolio."
          onConfirm={actions.confirmRemove}
          onCancel={actions.cancelRemove}
        />
      )}
```

> **Note:** `PositionsTable` caps at 10 by slicing the top 10 by market value BEFORE passing to the table, but the table also sorts. The dashboard's cap is "the 10 largest positions", so slice by `marketValue` desc first (as shown). The `% of portfolio` column still uses the full `totals.totalValue`, so the capped table's percentages remain correct against the whole portfolio.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/__tests__/app/dashboard-holdings.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Full verification**

Run: `npm run build && npm test && npm run lint && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/__tests__/app/dashboard-holdings.test.tsx
git commit -m "feat(dashboard): 10-row holdings table with the shared actions flow

The dashboard shows the ten largest positions and links to the full
holdings screen; the mobile list shows six and does the same. Edit and
remove now run through the shared usePositionActions hook, replacing the
dashboard's bespoke remove handler."
```

---

## Task 9: Verify the whole flow

**Files:** none (verification only).

- [ ] **Step 1: Full green check**

```bash
npm test && npm run lint && npx tsc --noEmit && npm run build
```
Expected: all green.

- [ ] **Step 2: Smoke-test the production build at both viewports**

Not optional — plan 1 shipped a mobile overflow bug because every check ran at desktop width. Build, serve the production build (dev server OFF so the build is not overwritten under it), and against `/demo` and `/demo/holdings`:

1. **1440px `/demo/holdings`** — the table renders every row; clicking a header re-sorts and the arrow + `aria-sort` move; clicking a row opens `PositionSheet` with the right numbers; Edit opens the edit modal; Remove opens the confirm.
2. **1440px `/demo`** — the dashboard shows a 10-row holdings table under the allocation strip with an "All holdings →" link; the link routes to `/demo/holdings`.
3. **375px `/demo`** — `document.documentElement.scrollWidth === clientWidth` (no horizontal overflow); the holdings section shows the 6-row mobile list with "Show all N holdings →"; every row and the Holdings tab is ≥44px.
4. **375px `/demo/holdings`** — all rows, a total row, no overflow; tapping a row opens the sheet from the bottom.
5. The three-tab control (Dashboard / Holdings / Analytics) shows the active tab per route on both viewports.
6. `/demo/analytics` still renders on the legacy palette (unchanged).
7. Console and server logs clean on every screen.

- [ ] **Step 3: Commit any fixes the smoke test surfaces, then stop.**

---

## Done when

- `/holdings` (and `/demo/holdings`) render a sortable, keyboard-reachable table on desktop and the nav-aware list on mobile.
- A table/list row opens `PositionSheet`; Edit and Remove work through one shared hook on both the dashboard and the holdings screen.
- The dashboard shows the ten largest positions with an "All holdings" link; mobile shows six with "Show all".
- The nav has three tabs, active state correct under both `/` and `/demo`.
- No horizontal overflow at 375px; every target ≥44px.
- `/analytics` still renders on the legacy palette.
- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` all clean.

## Watch out for

- **This plan is additive.** Do NOT delete or edit the legacy `HoldingsTable`, `ChipDetail`, `DetailPanel`, `Sheet`, or `analytics/page.tsx`. They migrate/delete in plan 4. Editing `Sheet` would half-migrate Analytics.
- **`PositionsTable` is a new file, not a rewrite of `HoldingsTable`.** Both exist until plan 4.
- The dashboard cap is the **ten largest by market value**, sliced before the table sorts; the `%` column still divides by the whole-portfolio total, not the capped subset's total.
- `usePositionActions` is the single edit/remove implementation — do not leave the dashboard's old `handleRemoveTicker` behind beside it.
- Reconcile every modal/TopBar prop name against the real components before trusting the plan's JSX; this plan's predecessors were wrong repeatedly on exactly that.

## Plan 4 inbox (carried forward)

1. Analytics rewrite (performance zoomed-y, direct-labelled allocation, P&L-by-sector, retained valuation block) onto `AppShell`/`TopBar`.
2. Delete legacy `HoldingsTable`, `ChipDetail`, `DetailPanel`, `Navbar`, `MobileMenu` (+ their tests); optionally rename `PositionsTable` → `HoldingsTable`.
3. Restyle `Sheet` to `--rd-*` once Analytics no longer depends on its legacy shell.
4. Wire tile-tap and mover-row → `PositionSheet` (reworking the plan-1 hover `TreemapTooltip`).
5. Mobile heat map: top-10 tiles + tappable aggregate strip routing to `/holdings` (which now exists and whose mobile list is already nav-aware).
6. Delete the legacy oklch palette, `.bento-card`, body gradients from `globals.css` — the final destructive token cleanup.
