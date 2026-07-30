# Redesign Plan 4: Analytics + Legacy Cleanup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Analytics screen onto the new shell and tokens — Performance (zoomed y-axis, honest empty state), the reused direct-labelled Allocation strip, a new P&L-by-sector card, and the retained valuation block — then delete every legacy component and the legacy oklch palette, so the whole app is on one design system.

**Architecture:** A pure `sectorPL` module drives a new `SectorPLCard`. The Analytics page is rewritten onto `AppShell`/`TopBar`, reusing `AllocationStrip` (built in plan 2) in place of the donut and dropping the holdings table (it lives at `/holdings` now). The two surviving valuation cards and their `DetailPanel`/`ChipDetail`/`Sheet` primitives are restyled to `--rd-*`. Once no screen references the legacy palette, `globals.css` loses the oklch block, `.bento-card`, the body gradients and the legacy Tailwind aliases in one destructive commit. This is the last plan; after it, no `--rd-*`-vs-oklch coexistence remains.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, Recharts, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-26-design-handoff-redesign-design.md`
**Predecessors:** plans 1–3 complete (plan 3 in open PR #30). This branch builds on plan 3.

---

## Inherited context — do not re-litigate

| Decision | Source |
|---|---|
| **Analytics = Performance + Allocation + P&L-by-sector + retained valuation block.** No heat map, no hero, no holdings table — that separation is the fix for the review's duplication finding. | Spec, *Screens* |
| `VixPill`, `AnalystSentimentCard`, `ValuationCard` **survive**, restyled to the new tokens. The two valuation cards are the fourth block on Analytics. | Spec, *Scope decisions* #2 |
| Under five snapshots the Performance card renders an **honest empty state**, not a two-point line. | Spec, *Known gaps* |
| Tokens were additive through plans 1–3; **this plan does the destructive swap** once nothing legacy remains. | Plan 1 |
| `AllocationStrip` takes `items` and is reused here — do not build a second allocation component. | Plan 2 |

**Deferred to an optional plan 5 (NOT in scope here):** wiring tile-tap / mover-row → `PositionSheet` (reworking the plan-1 hover `TreemapTooltip` into a modal trigger), and the mobile heat-map "top-10 tiles + tappable aggregate strip". The app is fully functional and fully token-migrated without these; they are interaction polish. `MobileHoldingsList` is already nav-aware for the strip, and `PositionSheet` is already surface-agnostic, so plan 5 needs no rework here.

**User standing rules:** never add `Co-Authored-By` or any AI mention to commits/PRs; branch before the first commit; default to opening a PR; no "for recruiters" framing.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `src/lib/design/sector-pl.ts` | Pure P&L aggregation by sector, largest absolute P&L first |
| `src/components/SectorPLCard.tsx` | Direct-labelled P&L-by-sector, glyphs, the one fact neither map nor table shows |
| `src/components/PerformanceCard.tsx` | rd-styled performance chart: zoomed y-axis, stated range, honest empty state |

**Modify (restyle to `--rd-*`):** `src/components/AnalystSentimentCard.tsx`, `src/components/ValuationCard.tsx`, `src/components/ChipDetail.tsx`, `src/components/ui/DetailPanel.tsx`, `src/components/ui/Sheet.tsx`, `src/app/analytics/page.tsx`.

**Delete:** `src/components/Navbar.tsx`, `src/components/MobileMenu.tsx`, `src/components/HoldingsTable.tsx`, `src/components/SectorChart.tsx`, `src/components/EquityAllocationChart.tsx`, `src/components/PerformanceChart.tsx` (replaced by `PerformanceCard`), and their test files.

**Destructive edit (final task):** `src/app/globals.css` (remove oklch palette, `.bento-card`, `.brand-mark`, `.delta-pill`, `.app-divider`, body gradients), `tailwind.config.ts` (remove legacy colour aliases).

---

## Task 1: P&L by sector (pure)

**Files:**
- Create: `src/lib/design/sector-pl.ts`
- Test: `src/__tests__/lib/design/sector-pl.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { sectorPL } from "@/lib/design/sector-pl";
import { sectorColor } from "@/lib/design/sectors";
import type { PortfolioItem } from "@/types";

function item(sector: string, totalPL: number, ticker = sector.slice(0, 4)): PortfolioItem {
  return {
    ticker,
    companyName: `${ticker} Inc.`,
    sector,
    shares: 1,
    avgCost: 100,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: { price: 100 + totalPL, change: 0, changePercent: 0, previousClose: 100 },
    marketValue: 100 + totalPL,
    totalPL,
    totalPLPercent: totalPL,
  };
}

describe("sectorPL", () => {
  it("sums P&L per sector, largest absolute P&L first", () => {
    const rows = sectorPL([
      item("Technology", 100),
      item("Healthcare", -300),
      item("Technology", 50),
    ]);
    expect(rows.map((r) => [r.sector, r.pl])).toEqual([
      ["Healthcare", -300],
      ["Technology", 150],
    ]);
  });

  it("carries the sector palette colour", () => {
    const rows = sectorPL([item("Technology", 100)]);
    expect(rows[0].color).toBe(sectorColor("Technology"));
  });

  it("computes each sector's P&L as a percent of its cost basis", () => {
    // Technology cost basis 200 (2 x 100), P&L +100 -> +50%.
    const rows = sectorPL([item("Technology", 60), item("Technology", 40)]);
    expect(rows[0].plPercent).toBeCloseTo(50, 5);
  });

  it("buckets unknown sectors as Other rather than dropping their P&L", () => {
    const orphan = { ...item("Technology", 40), sector: "Nonexistent Sector" };
    const rows = sectorPL([item("Technology", 60), orphan]);
    const other = rows.find((r) => r.sector === "Other");
    expect(other?.pl).toBe(40);
  });

  it("returns an empty list for an empty portfolio", () => {
    expect(sectorPL([])).toEqual([]);
  });

  it("reports zero-percent rather than NaN when a sector's cost basis is zero", () => {
    const free = { ...item("Technology", 10), avgCost: 0, marketValue: 10 };
    const rows = sectorPL([free]);
    expect(Number.isFinite(rows[0].plPercent)).toBe(true);
    expect(rows[0].plPercent).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/__tests__/lib/design/sector-pl.test.ts`
Expected: FAIL — `Cannot find module '@/lib/design/sector-pl'`.

- [ ] **Step 3: Implement**

```ts
import type { PortfolioItem } from "@/types";
import { OTHER_COLOR, SECTOR_COLORS, sectorColor } from "@/lib/design/sectors";

export interface SectorPLRow {
  sector: string;
  pl: number;
  /** P&L as a percent of the sector's cost basis. */
  plPercent: number;
  color: string;
}

const OTHER = "Other";

/**
 * P&L aggregated by sector — the one fact neither the heat map (which shows
 * position magnitude) nor the table (which shows per-position P&L) surfaces:
 * where the money was actually made or lost. Ordered by absolute P&L so the
 * biggest swing, up or down, is first. Unknown sectors bucket into `Other`
 * rather than vanishing, so the totals still reconcile with the portfolio.
 */
export function sectorPL(items: PortfolioItem[]): SectorPLRow[] {
  const pl = new Map<string, number>();
  const cost = new Map<string, number>();

  for (const i of items) {
    const key = i.sector && SECTOR_COLORS[i.sector] ? i.sector : OTHER;
    pl.set(key, (pl.get(key) ?? 0) + i.totalPL);
    cost.set(key, (cost.get(key) ?? 0) + i.shares * i.avgCost);
  }

  if (pl.size === 0) return [];

  return [...pl.entries()]
    .map(([sector, plValue]) => {
      const basis = cost.get(sector) ?? 0;
      return {
        sector,
        pl: plValue,
        plPercent: basis > 0 ? (plValue / basis) * 100 : 0,
        color: sector === OTHER ? OTHER_COLOR : sectorColor(sector),
      };
    })
    .sort((a, b) => Math.abs(b.pl) - Math.abs(a.pl));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/__tests__/lib/design/sector-pl.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/sector-pl.ts src/__tests__/lib/design/sector-pl.test.ts
git commit -m "feat(analytics): P&L by sector

The one fact neither the heat map nor the table shows — where the money
was made or lost. Ordered by absolute P&L, unknown sectors bucketed into
Other so the totals still reconcile."
```

---

## Task 2: Sector P&L card

**Files:**
- Create: `src/components/SectorPLCard.tsx`
- Test: `src/__tests__/components/SectorPLCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, within } from "@testing-library/react";
import { SectorPLCard } from "@/components/SectorPLCard";
import type { PortfolioItem } from "@/types";

function item(sector: string, totalPL: number): PortfolioItem {
  return {
    ticker: sector.slice(0, 4),
    companyName: `${sector} Co`,
    sector,
    shares: 1,
    avgCost: 100,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: { price: 100 + totalPL, change: 0, changePercent: 0, previousClose: 100 },
    marketValue: 100 + totalPL,
    totalPL,
    totalPLPercent: totalPL,
  };
}

const items = [item("Technology", 500), item("Healthcare", -300), item("Energy", 100)];

describe("SectorPLCard", () => {
  it("names the section", () => {
    render(<SectorPLCard items={items} />);
    expect(screen.getByText(/p&l by sector/i)).toBeInTheDocument();
  });

  it("lists each sector with its signed P&L, biggest swing first", () => {
    render(<SectorPLCard items={items} />);
    const rows = screen.getAllByTestId("sector-pl-row");
    expect(rows[0]).toHaveTextContent("Technology");
    expect(within(rows[0]).getByText(/\+\$500\.00/)).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent("Healthcare");
  });

  it("uses a true minus and a glyph on a losing sector", () => {
    render(<SectorPLCard items={items} />);
    const healthcare = screen.getAllByTestId("sector-pl-row").find((r) => /Healthcare/.test(r.textContent ?? ""))!;
    expect(healthcare.textContent).toContain("−");
    expect(healthcare.textContent).toContain("▼");
    expect(healthcare.textContent).not.toContain("-$");
  });

  it("shows an empty note for an empty portfolio", () => {
    render(<SectorPLCard items={[]} />);
    expect(screen.getByText(/no positions/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/__tests__/components/SectorPLCard.test.tsx`
Expected: FAIL — `Cannot find module '@/components/SectorPLCard'`.

- [ ] **Step 3: Implement**

```tsx
import { sectorPL } from "@/lib/design/sector-pl";
import { signedMoney, signedPct } from "@/lib/design/format";
import type { PortfolioItem } from "@/types";

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

export function SectorPLCard({ items }: { items: PortfolioItem[] }) {
  const rows = sectorPL(items);

  return (
    <section
      aria-label="P&L by sector"
      className="rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6"
    >
      <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
        P&amp;L by sector
      </h2>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-rd-muted">No positions to break down.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {rows.map((r) => (
            <li
              key={r.sector}
              data-testid="sector-pl-row"
              className="flex items-baseline justify-between gap-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: r.color }}
                />
                <span className="truncate text-sm text-rd-body">{r.sector}</span>
              </span>
              <span className={`shrink-0 font-mono text-sm tabular-nums ${tone(r.pl)}`}>
                <span aria-hidden="true">{glyph(r.pl)}</span> {signedMoney(r.pl)}
                <span className="ml-2 text-rd-muted">{signedPct(r.plPercent)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/__tests__/components/SectorPLCard.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/SectorPLCard.tsx src/__tests__/components/SectorPLCard.test.tsx
git commit -m "feat(analytics): P&L-by-sector card

Direct-labelled rows, biggest swing first, glyph as well as colour."
```

---

## Task 3: Performance card

Rewrites the shipped `PerformanceChart` as a new rd-styled `PerformanceCard`. Two spec requirements the old chart missed: a **zoomed y-axis** (domain from the data's own min/max, not anchored at 0, so day-to-day movement is legible), and an **honest empty state under five snapshots** rather than a two-point line implying a trend.

**Files:**
- Create: `src/components/PerformanceCard.tsx`
- Test: `src/__tests__/components/PerformanceCard.test.tsx`

Read `src/components/PerformanceChart.tsx` first for the recharts wiring and the range-filter logic to carry over.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { PerformanceCard, yDomain, MIN_POINTS } from "@/components/PerformanceCard";
import type { Snapshot } from "@/types";

// Recharts' ResponsiveContainer needs a size; jsdom reports 0. Stub it so the
// chart body renders in tests (the same trick the repo uses elsewhere).
jest.mock("recharts", () => {
  const real = jest.requireActual("recharts");
  return { ...real, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div style={{ width: 800, height: 300 }}>{children}</div>
  ) };
});

function snaps(values: number[]): Snapshot[] {
  return values.map((v, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, "0")}`,
    totalValue: v,
    holdings: {},
  }));
}

describe("yDomain", () => {
  it("brackets the data with a margin, never anchored at zero", () => {
    const [lo, hi] = yDomain([100000, 100500, 100200, 100800, 100400]);
    expect(lo).toBeGreaterThan(0);
    expect(lo).toBeLessThan(100000);
    expect(hi).toBeGreaterThan(100800);
  });

  it("does not collapse to a zero-height band for a flat series", () => {
    const [lo, hi] = yDomain([100000, 100000, 100000, 100000, 100000]);
    expect(hi).toBeGreaterThan(lo);
  });
});

describe("PerformanceCard", () => {
  it("draws the chart when there are at least five snapshots", () => {
    const { container } = render(<PerformanceCard snapshots={snaps([1, 2, 3, 4, 5].map((n) => 100000 + n * 100))} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.queryByText(/not enough history/i)).toBeNull();
  });

  it("renders an honest empty state under five snapshots", () => {
    render(<PerformanceCard snapshots={snaps([100000, 100500])} />);
    expect(screen.getByText(/not enough history/i)).toBeInTheDocument();
  });

  it("exposes the minimum-points threshold as five", () => {
    expect(MIN_POINTS).toBe(5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/__tests__/components/PerformanceCard.test.tsx`
Expected: FAIL — `Cannot find module '@/components/PerformanceCard'`.

- [ ] **Step 3: Implement**

Model the recharts wiring on the existing `PerformanceChart`. Key differences: rd token colours, `YAxis domain={yDomain(values)}` with `tickFormatter={axisMoney}` (from `@/lib/design/format`), and the `MIN_POINTS` empty-state guard. Export `yDomain` and `MIN_POINTS` for the test.

```tsx
"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { axisMoney } from "@/lib/design/format";
import type { Snapshot } from "@/types";

export const MIN_POINTS = 5;

/**
 * Y-axis bounds from the data's own range with a 5% margin — NOT anchored at
 * zero. A portfolio chart anchored at zero flattens every real day-to-day move
 * into a straight line near the top; the whole point of this card is to make
 * that movement legible. The `|| 1` guards a flat series from a zero-height band.
 */
export function yDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const margin = (max - min || max * 0.01 || 1) * 0.05;
  return [min - margin, max + margin];
}

export function PerformanceCard({ snapshots }: { snapshots: Snapshot[] }) {
  const values = snapshots.map((s) => s.totalValue);

  return (
    <section
      aria-label="Performance"
      className="rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6"
    >
      <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
        Performance over time
      </h2>

      {snapshots.length < MIN_POINTS ? (
        <p className="mt-6 text-sm text-rd-faint">
          Not enough history yet — a few more days of snapshots and your portfolio&apos;s
          trajectory appears here.
        </p>
      ) : (
        <div className="mt-4 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={snapshots} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--rd-gridline)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--rd-text-faint)", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "var(--rd-border)" }}
              />
              <YAxis
                domain={yDomain(values)}
                tickFormatter={axisMoney}
                tick={{ fill: "var(--rd-text-faint)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Line
                type="monotone"
                dataKey="totalValue"
                stroke="var(--rd-gain)"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/__tests__/components/PerformanceCard.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/PerformanceCard.tsx src/__tests__/components/PerformanceCard.test.tsx
git commit -m "feat(analytics): performance card with a zoomed y-axis

The axis brackets the data's own range instead of anchoring at zero, so
day-to-day movement is legible; under five snapshots it renders an honest
empty state rather than a two-point line."
```

---

## Task 4: Restyle the detail primitives and valuation cards to rd tokens

The two valuation cards survive but must move off the legacy palette. They open a `DetailPanel` (desktop bento tooltip / mobile `Sheet`) rendering `ChipDetail`. After plan 3 moved the holdings detail to `PositionSheet`, these three primitives are used ONLY by the valuation cards (and the soon-deleted `EquityAllocationChart`), so they can be restyled to `--rd-*` without touching anything migrated.

**Files:**
- Modify: `src/components/ui/Sheet.tsx`, `src/components/ui/DetailPanel.tsx`, `src/components/ChipDetail.tsx`, `src/components/AnalystSentimentCard.tsx`, `src/components/ValuationCard.tsx`
- Tests: the existing suites for these components must keep passing; update any that assert legacy class names.

No new behaviour — this is a token swap. There is no clean unit test for "uses the right colour", so the guard is: existing tests stay green, `tsc`/`lint` clean, and the Task 9 smoke test confirms the visual.

- [ ] **Step 1: Swap the tokens, one file at a time, running its test after each**

Replace legacy classes with rd equivalents throughout the five files:

| Legacy | rd replacement |
|---|---|
| `bg-surface-card`, `bg-surface`, `.bento-card` | `bg-rd-card` |
| `border-surface-border`, `border-border` | `border-rd-border` |
| `text-foreground` | `text-rd-text` |
| `text-muted-foreground` | `text-rd-muted` |
| `text-positive` | `text-rd-gain` |
| `text-negative` | `text-rd-loss` |
| `bg-surface-border` (bars) | `bg-rd-inset` |
| `font-display` | (drop; the body font is fine) |

In `DetailPanel.tsx` the desktop branch uses `className="bento-card ..."` — replace with an rd panel: `className="fixed z-50 rounded-xl border border-rd-border bg-rd-card p-5 text-sm shadow-[0_14px_34px_#00000099] ..."` (keep the positioning logic and `pointer-events-none` untouched).

In `Sheet.tsx` the inner panel uses `bg-surface-card border-surface-border` — replace with `bg-rd-card border-rd-border`.

After each file, run its test (e.g. `npm test -- src/__tests__/components/ChipDetail.test.tsx`) and fix any assertion that checked a legacy class name — update the expectation to the rd class; do NOT delete the assertion.

- [ ] **Step 2: Full check**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: all green. If a test asserted `toHaveStyle({ color: "..." })` with an oklch value, update it to the rd token's hex or drop the colour assertion in favour of a class-name check.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Sheet.tsx src/components/ui/DetailPanel.tsx src/components/ChipDetail.tsx src/components/AnalystSentimentCard.tsx src/components/ValuationCard.tsx src/__tests__/components/
git commit -m "feat(analytics): restyle the valuation cards and detail primitives to rd tokens

The two surviving valuation cards and the DetailPanel/Sheet/ChipDetail
primitives they open move off the legacy oklch palette. No behaviour
change; the holdings detail already moved to PositionSheet in plan 3, so
these are their only remaining consumers."
```

---

## Task 5: Rewrite the Analytics page

The single token-migration commit for this screen (spec §2 rule). Analytics moves onto `AppShell`/`TopBar` and its new blocks in one commit.

**Files:**
- Modify: `src/app/analytics/page.tsx`
- Test: `src/__tests__/app/analytics-page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import AnalyticsPage from "@/app/analytics/page";
import type { PortfolioItem } from "@/types";

const item = (ticker: string, sector: string, mv: number, pl: number): PortfolioItem => ({
  ticker,
  companyName: `${ticker} Inc.`,
  sector,
  shares: 10,
  avgCost: 100,
  addedAt: "2026-01-02T00:00:00.000Z",
  quote: { price: mv / 10, change: 1, changePercent: 0.9, previousClose: 100 },
  marketValue: mv,
  totalPL: pl,
  totalPLPercent: pl / 10,
});

let mockData = {
  items: [item("AAA", "Technology", 600, 100), item("BBB", "Healthcare", 300, -50)],
  failed: [],
  status: "ready",
  snapshots: [],
  excludedValue: 0,
  refresh: jest.fn(),
};
jest.mock("@/lib/use-portfolio-data", () => ({ usePortfolioData: () => mockData }));
jest.mock("@/lib/demo-context", () => ({ useIsDemo: () => false }));
jest.mock("@/components/AuthGuard", () => ({ AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ getIdToken: async () => "t", signOut: jest.fn() }) }));
jest.mock("@/lib/toast-context", () => ({ useToast: () => ({ error: jest.fn(), info: jest.fn(), success: jest.fn(), show: jest.fn(), dismiss: jest.fn(), toasts: [] }) }));
jest.mock("next/navigation", () => ({ usePathname: () => "/analytics" }));
// Valuation cards fetch their own data and pull recharts; stub for a fast composition test.
jest.mock("@/components/AnalystSentimentCard", () => ({ AnalystSentimentCard: () => <div data-testid="analyst" /> }));
jest.mock("@/components/ValuationCard", () => ({ ValuationCard: () => <div data-testid="valuation" /> }));
jest.mock("@/components/PerformanceCard", () => ({ PerformanceCard: () => <div data-testid="performance" /> }));

describe("AnalyticsPage", () => {
  it("renders performance, allocation, P&L-by-sector and the valuation block", () => {
    render(<AnalyticsPage />);
    expect(screen.getByTestId("performance")).toBeInTheDocument();
    expect(screen.getByLabelText("Allocation")).toBeInTheDocument();
    expect(screen.getByLabelText("P&L by sector")).toBeInTheDocument();
    expect(screen.getByTestId("analyst")).toBeInTheDocument();
    expect(screen.getByTestId("valuation")).toBeInTheDocument();
  });

  it("does not render a heat map or a holdings table", () => {
    render(<AnalyticsPage />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByLabelText(/heat map/i)).toBeNull();
  });

  it("marks the Analytics tab active", () => {
    render(<AnalyticsPage />);
    const links = screen.getAllByRole("link", { name: "Analytics" });
    expect(links.some((l) => l.getAttribute("aria-current") === "page")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/__tests__/app/analytics-page.test.tsx`
Expected: FAIL — the current page renders `Navbar`, `SectorChart`, a holdings table, etc.

- [ ] **Step 3: Rewrite `src/app/analytics/page.tsx`**

Preserve the data fetching (items, snapshots, valuations) and the import/add modal handlers. Replace the render tree with `AppShell`/`TopBar` and the four blocks. Read the current file first and keep every hook/handler that still applies; drop the holdings-table, edit and confirm modals (editing lives on `/holdings` now) and the `SectorChart`/`EquityAllocationChart` usage.

```tsx
// inside the AuthGuard/AppShell body, replacing the old grid:
<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
  <PerformanceCard snapshots={snapshots} />
  <AllocationStrip items={items} />
  <SectorPLCard items={items} />
  <div className="flex flex-col gap-4">
    <AnalystSentimentCard items={items} valuations={valuations} />
    <ValuationCard items={items} valuations={valuations} />
  </div>
</div>
```

Wire `TopBar` exactly as the dashboard and holdings pages do (`onImportClick`, `onAddClick`, `onSignOut`, `isDemo`, `marketOpen={isMarketOpen()}`, `vix={null}`), gate loading/empty with `status`, and keep the `CsvImportModal`/`AddHoldingModal` blocks. **Reconcile every prop name against the real components and the sibling pages — this project's plans have been wrong on prop names repeatedly.**

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/__tests__/app/analytics-page.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Full check** — `npm run build && npm test && npm run lint && npx tsc --noEmit`. The build must still compile `/analytics` and `/demo/analytics`. Note which components are now unimported (`Navbar`, `SectorChart`, `EquityAllocationChart`, `HoldingsTable`, `PerformanceChart`, `EditHoldingModal`, `ConfirmDialog` on this page) — Task 6 deletes the dead ones.

- [ ] **Step 6: Commit**

```bash
git add src/app/analytics/page.tsx src/__tests__/app/analytics-page.test.tsx
git commit -m "feat(analytics): rewrite onto the shell with the new blocks

Performance (zoomed axis), the reused allocation strip, P&L by sector,
and the retained valuation block — no heat map, no hero, no holdings
table, which is the fix for the review's duplication finding. Migrated
onto AppShell/TopBar in one commit."
```

---

## Task 6: Delete the legacy components

Now that no screen imports them, remove the legacy chrome and charts.

**Files:**
- Delete: `Navbar.tsx`, `MobileMenu.tsx`, `HoldingsTable.tsx`, `SectorChart.tsx`, `EquityAllocationChart.tsx`, `PerformanceChart.tsx` and each one's test.

- [ ] **Step 1: Confirm nothing imports them**

Run: `grep -rlnE "Navbar|MobileMenu|HoldingsTable|SectorChart|EquityAllocationChart|PerformanceChart" src/ | grep -v "__tests__"`
Expected: no `src/` matches outside the files themselves. If anything matches, STOP and fix that import first — do not delete a file still in use. (`PositionsTable` is a distinct name; do not confuse it with `HoldingsTable`.)

- [ ] **Step 2: Delete**

```bash
git rm src/components/Navbar.tsx src/components/MobileMenu.tsx src/components/HoldingsTable.tsx \
       src/components/SectorChart.tsx src/components/EquityAllocationChart.tsx src/components/PerformanceChart.tsx \
       src/__tests__/components/MobileMenu.test.tsx src/__tests__/components/HoldingsTable.test.tsx \
       src/__tests__/components/SectorChart.test.tsx src/__tests__/components/PerformanceChart.test.tsx
```
Verified against the tree: `Navbar` and `EquityAllocationChart` have **no** test files (do not list them). If `ls src/__tests__/components/` shows a test for any of these that is not listed above, `git rm` it too.

- [ ] **Step 3: Verify** — `npm test && npm run lint && npx tsc --noEmit && npm run build`. All green; the deleted components leave no dangling import.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete the legacy chrome and charts

Navbar, MobileMenu, the old HoldingsTable, the donut SectorChart, the
EquityAllocationChart and the pre-redesign PerformanceChart have no
remaining importers now that Analytics is migrated."
```

---

## Task 7: Delete the legacy palette

The final destructive step. Once every screen is on `--rd-*`, `globals.css` loses the oklch block and its dependants, and `tailwind.config.ts` loses the legacy colour aliases.

**Files:**
- Modify: `src/app/globals.css`, `tailwind.config.ts`

- [ ] **Step 1: Prove nothing still uses the legacy tokens**

Run:
```bash
grep -rnE "bento-card|brand-mark|delta-pill|app-divider|text-foreground|bg-surface|text-muted-foreground|text-positive|text-negative|oklch|font-display" src/ | grep -v "__tests__"
```
Expected: **no matches**. Every hit must be migrated first (it should already be, after Tasks 4–6). If `font-display` still appears, repoint or remove it. Do not proceed until this is clean — a dangling legacy class after the palette is deleted renders as an unstyled element.

- [ ] **Step 2: Remove the legacy CSS**

In `src/app/globals.css`, delete: the legacy `:root` oklch variable block (keep the `--rd-*` block and `--radius`), the body radial-gradient `background` (replace the `body` rule's background with `background-color: var(--rd-page);`), the `h1..h4 { font-family: var(--font-display) ... }` rule, and the entire `.bento-card`, `.brand-mark`, `.delta-pill*`, `.app-divider*` component rules. Keep `.rd-focusable` and the `@tailwind` directives.

In `tailwind.config.ts`, remove the legacy colour keys (`background`, `foreground`, `surface`, `card`, `popover`, `primary`, `muted`, `gold`, `positive`, `negative`, `border`, `input`, `ring`, and the `gain`/`loss`/`accent` legacy aliases) — keep the `rd` group, `borderRadius`, `fontFamily`, and `content`. Remove the `display` fontFamily entry if nothing uses `font-display`.

- [ ] **Step 3: Verify** — `npm run build && npm test && npm run lint && npx tsc --noEmit`. The build must succeed with no "unknown utility class" warnings. If Tailwind errors on a missing class, something still referenced a deleted token — find and migrate it, do not re-add the token.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css tailwind.config.ts
git commit -m "chore: delete the legacy oklch palette

Every screen is on the rd-* tokens now, so the coexisting oklch palette,
the bento-card/brand-mark/delta-pill/app-divider rules, the body
gradients and the legacy Tailwind colour aliases are gone. One design
system remains."
```

---

## Task 8: Verify the whole app

**Files:** none.

- [ ] **Step 1: Full green** — `npm test && npm run lint && npx tsc --noEmit && npm run build`.

- [ ] **Step 2: Smoke-test the production build at both viewports.** Not optional. Build, serve the production build (dev server OFF), and against `/demo`, `/demo/holdings`, `/demo/analytics`:

1. **1440px** — all three screens render with no unstyled/black-on-black elements (the tell-tale of a missed token); Analytics shows Performance, Allocation, P&L-by-sector and the valuation block, no heat map or table; the valuation cards' detail popover opens and is rd-styled.
2. **375px** — no horizontal overflow (`scrollWidth === clientWidth`) on any of the three; the three-tab control works; targets ≥44px.
3. Console and server logs clean on every screen.
4. Grep the built CSS for `oklch(` to confirm the palette is gone from output: `grep -rl "oklch(" .next/static/css/ && echo "LEAK" || echo "clean"`.

- [ ] **Step 3: Commit any fixes the smoke test surfaces, then stop.**

---

## Done when

- Analytics renders Performance (zoomed axis, honest empty state), Allocation, P&L-by-sector and the valuation block on the new shell — no heat map, no hero, no holdings table.
- No legacy component or oklch token remains anywhere in `src/` or the built CSS.
- All three screens render with no unstyled elements and no 375px overflow.
- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` all clean.

## Watch out for

- **Task 5 is the Analytics token-migration commit — land it whole.** A half-migrated Analytics against `#07090b` reads as a rendering fault (spec §2).
- **Do not delete a component before Task 6's grep proves it is unimported.** `HoldingsTable` (legacy) ≠ `PositionsTable` (plan 3) — deleting the wrong one breaks `/holdings`.
- **Task 7's grep must be clean before deleting the palette.** A surviving `text-foreground` becomes an unstyled element the moment the token is gone; the build may not error, so the grep is the gate, not the compiler.
- Keep `ResponsiveContainer` mocked in chart tests — jsdom reports zero size and recharts renders nothing otherwise.
- The valuation cards fetch their own valuation data; do not rip that out during the restyle.

## Plan 5 inbox (optional interaction polish — the redesign is complete without it)

1. Wire tile-tap and mover-row → `PositionSheet` (rework the plan-1 hover `TreemapTooltip` into, or alongside, a tap-to-open modal). `PositionSheet` is already surface-agnostic.
2. Mobile heat map: render the **top-10 tiles only** plus a tappable "+N smaller positions" aggregate strip routing to `/holdings`. `MobileHoldingsList` is already nav-aware for this.
