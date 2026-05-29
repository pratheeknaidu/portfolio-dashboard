# Mobile-Friendly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the entire app usable on mobile with full feature parity, in two phases — first a CSS-only layout sweep, then interaction patterns (sheets, drawer, condensed table).

**Architecture:** Responsive components with mobile-first Tailwind classes. Two thin primitives — `<Sheet>` (bottom sheet on mobile, dialog on desktop) and `useIsMobile()` (matchMedia hook). Drawer navigation on phones, condensed-with-expand table view, bottom-sheet tile detail.

**Tech Stack:** Next.js 14 App Router, Tailwind 3.4, React 18, Jest + Testing Library, jsdom.

**Spec:** [docs/superpowers/specs/2026-05-25-mobile-friendly-design.md](../specs/2026-05-25-mobile-friendly-design.md)

**Branch:** `feat/mobile-friendly`

---

## Phase 1 — Layout sweep

Pure Tailwind class edits. No new components. Verifiable by manual viewport check.

---

### Task 1: Fix analytics page grid breakpoints

**Files:**
- Modify: `src/app/analytics/page.tsx:117-145`

- [ ] **Step 1: Open the file and confirm current state**

Read `src/app/analytics/page.tsx`. Lines 117-145 contain the `<main>` element, two `grid-cols-2` rows, and several `<section>` cards using `p-6`.

- [ ] **Step 2: Apply mobile-first class edits**

Make these exact replacements:

In the `<main>` opening tag (line 117):
- Replace `className="flex-1 overflow-auto p-6 space-y-8"`
- With `className="flex-1 overflow-auto p-4 md:p-6 space-y-6 md:space-y-8"`

On the first grid row (line 118):
- Replace `<div className="grid grid-cols-2 gap-6">`
- With `<div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">`

On the second grid row (line 132):
- Replace `<div className="grid grid-cols-2 gap-6">`
- With `<div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">`

On every `<section>` card inside `<main>` (there are three — sector, performance, holdings — and the two AnalystSentiment/Valuation cards are their own components, leave those alone):
- Replace `className="bg-surface-card rounded-lg p-6 border border-surface-border"`
- With `className="bg-surface-card rounded-lg p-4 md:p-6 border border-surface-border"`

- [ ] **Step 3: Manual verification — desktop unchanged**

Run dev server: `npm run sandbox`
Open `http://localhost:3000/analytics` at a desktop viewport (≥1024px wide).
Confirm: two-column layouts render unchanged, padding looks unchanged.

- [ ] **Step 4: Manual verification — mobile**

In Chrome DevTools, toggle device toolbar (Cmd+Shift+M), select iPhone SE (375×667).
Open `/analytics`.
Confirm:
- Sector + Performance cards stack vertically (one column).
- AnalystSentiment + Valuation cards stack vertically.
- Holdings card padding feels tighter (`p-4` not `p-6`).
- No horizontal scrollbar at the document level.

- [ ] **Step 5: Commit**

```bash
git add src/app/analytics/page.tsx
git commit -m "fix(analytics): stack grid cards on mobile, tighter padding"
```

---

### Task 2: Fix dashboard page breakpoints and treemap height

**Files:**
- Modify: `src/app/page.tsx:185-246`

- [ ] **Step 1: Apply class edits**

In the `<main>` opening tag (line 185):
- Replace `className="flex-1 px-4 md:px-8 py-8 max-w-[1400px] w-full mx-auto"`
- With `className="flex-1 px-4 md:px-8 py-4 md:py-8 max-w-[1400px] w-full mx-auto"`

Row 1 hero/metrics — line 188 and 191:
- Replace `<div className="col-span-12 lg:col-span-8">`
- With `<div className="col-span-12 md:col-span-8">`
- Replace `<div className="col-span-12 lg:col-span-4 flex flex-col gap-4">`
- With `<div className="col-span-12 md:col-span-4 flex flex-col gap-4">`

Treemap container — line 228:
- Replace `<div className="h-[440px] md:h-[520px] relative">`
- With `<div className="h-[360px] sm:h-[440px] md:h-[520px] relative">`

Row 3 allocation/movers — lines 240 and 243:
- Replace `<div className="col-span-12 lg:col-span-5">`
- With `<div className="col-span-12 md:col-span-5">`
- Replace `<div className="col-span-12 lg:col-span-7">`
- With `<div className="col-span-12 md:col-span-7">`

- [ ] **Step 2: Manual verification — tablet (768px)**

`npm run sandbox` if not already running.
DevTools: set viewport to 768×1024 (iPad portrait).
Open `/`.
Confirm:
- Hero + metrics row renders 2-column (was previously stacking).
- Allocation + Movers row renders 2-column.
- Treemap occupies `h-[520px]` (the `md:` value kicks in at 768px).

- [ ] **Step 3: Manual verification — phone (375px)**

DevTools: set viewport to 375×667.
Confirm:
- All rows stack to single column.
- Treemap container shows at `h-[360px]` — visible but doesn't dominate the screen.
- No horizontal scroll.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "fix(dashboard): drop lg: to md: so tablets get 2-col, shrink treemap on phones"
```

---

### Task 3: Add overflow-x-hidden safety net to root layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Read the current layout file**

Read `src/app/layout.tsx`. Identify the `<body>` tag and its existing className.

- [ ] **Step 2: Add overflow-x-hidden**

Append ` overflow-x-hidden` to the existing `<body>` className. Do NOT remove or change any other class.

Example: if the current is
```tsx
<body className={`${inter.className} bg-background text-foreground`}>
```
Change to:
```tsx
<body className={`${inter.className} bg-background text-foreground overflow-x-hidden`}>
```

(Adapt to the actual existing className — only append `overflow-x-hidden`.)

- [ ] **Step 3: Verify nothing broke**

Run: `npm run lint`
Expected: no new lint errors.

Run: `npm test`
Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix(layout): add overflow-x-hidden safety net to body"
```

---

### Phase 1 Checkpoint

At this point, the app is mobile-usable for browsing (no nav between pages yet on mobile, but each page renders well at 375px). This is a natural PR boundary.

- [ ] **Open PR for Phase 1**

```bash
git push -u origin feat/mobile-friendly
gh pr create --title "Mobile-friendly Phase 1: layout sweep" --body "$(cat <<'EOF'
## Summary
- Stack 2-col grids on mobile, restore at md (768px)
- Drop lg: to md: on dashboard so tablets get 2-col
- Shrink treemap height to 360px on phones
- Tighten card padding on small screens
- Safety-net overflow-x-hidden on body

## Test plan
- [ ] DevTools at 375×667: no horizontal scroll on / or /analytics
- [ ] DevTools at 768×1024: dashboard hero+metrics row is 2-col
- [ ] DevTools at ≥1024px: layouts unchanged
- [ ] `npm test` passes
EOF
)"
```

After merge, continue to Phase 2 on the same branch (or a new branch off main if Phase 1 is merged first).

---

## Phase 2 — Interaction patterns

New primitives, drawer nav, condensed table, tile detail sheet, modal-to-sheet migration.

---

### Task 4: Build `useIsMobile` hook with tests

**Files:**
- Create: `src/lib/use-is-mobile.ts`
- Create: `src/__tests__/lib/use-is-mobile.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/lib/use-is-mobile.test.ts`:

```ts
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "@/lib/use-is-mobile";

function mockMatchMedia(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const mql = {
    matches,
    media: "(max-width: 767px)",
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.push(cb);
    },
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    },
    dispatchChange: (newMatches: boolean) => {
      mql.matches = newMatches;
      listeners.forEach((cb) =>
        cb({ matches: newMatches } as MediaQueryListEvent),
      );
    },
  };
  window.matchMedia = jest.fn().mockReturnValue(mql);
  return mql;
}

describe("useIsMobile", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns true when matchMedia matches", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("returns false when matchMedia does not match", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("updates when the media query changes", () => {
    const mql = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      mql.dispatchChange(true);
    });
    expect(result.current).toBe(true);
  });

  it("cleans up its listener on unmount", () => {
    const mql = mockMatchMedia(true);
    const removeSpy = jest.spyOn(mql, "removeEventListener");
    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/lib/use-is-mobile.test.ts`
Expected: FAIL with "Cannot find module '@/lib/use-is-mobile'".

- [ ] **Step 3: Implement the hook**

Create `src/lib/use-is-mobile.ts`:

```ts
"use client";
import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
  // Default to false on SSR so we render the desktop tree on first paint,
  // then swap after mount. Avoids hydration mismatches.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/__tests__/lib/use-is-mobile.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/use-is-mobile.ts src/__tests__/lib/use-is-mobile.test.ts
git commit -m "feat(ui): add useIsMobile hook with matchMedia listener"
```

---

### Task 5: Build `<Sheet>` primitive with tests

**Files:**
- Create: `src/components/ui/Sheet.tsx`
- Create: `src/__tests__/components/Sheet.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/components/Sheet.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Sheet } from "@/components/ui/Sheet";

describe("Sheet", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("renders nothing when open is false", () => {
    render(
      <Sheet open={false} onClose={() => {}}>
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.queryByText("Body")).not.toBeInTheDocument();
  });

  it("renders children when open is true", () => {
    render(
      <Sheet open onClose={() => {}}>
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("renders with role=dialog and aria-modal=true", () => {
    render(
      <Sheet open onClose={() => {}}>
        <p>Body</p>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("calls onClose when overlay is clicked", () => {
    const onClose = jest.fn();
    render(
      <Sheet open onClose={onClose}>
        <p>Body</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByTestId("sheet-overlay"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stops propagation on overlay click", () => {
    const onClose = jest.fn();
    const docClick = jest.fn();
    document.addEventListener("click", docClick);
    render(
      <Sheet open onClose={onClose}>
        <p>Body</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByTestId("sheet-overlay"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(docClick).not.toHaveBeenCalled();
    document.removeEventListener("click", docClick);
  });

  it("does not call onClose when clicking inside the panel", () => {
    const onClose = jest.fn();
    render(
      <Sheet open onClose={onClose}>
        <button>Inside</button>
      </Sheet>,
    );
    fireEvent.click(screen.getByText("Inside"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const onClose = jest.fn();
    render(
      <Sheet open onClose={onClose}>
        <p>Body</p>
      </Sheet>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("locks body scroll while open", () => {
    const { rerender } = render(
      <Sheet open onClose={() => {}}>
        <p>Body</p>
      </Sheet>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Sheet open={false} onClose={() => {}}>
        <p>Body</p>
      </Sheet>,
    );
    expect(document.body.style.overflow).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/components/Sheet.test.tsx`
Expected: FAIL with "Cannot find module '@/components/ui/Sheet'".

- [ ] **Step 3: Implement the Sheet component**

Create `src/components/ui/Sheet.tsx`:

```tsx
"use client";
import { useEffect, useRef, ReactNode } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** aria-labelledby target id, if the consumer's header has one. */
  labelledBy?: string;
}

export function Sheet({ open, onClose, children, labelledBy }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Scroll lock on body while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    // stopPropagation so document-level "click outside" handlers
    // (e.g. TreemapTooltip dismiss in dashboard) don't double-fire.
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60"
      data-testid="sheet-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="
          w-full md:w-auto md:max-w-lg
          max-h-[85vh] md:max-h-[90vh]
          overflow-y-auto
          bg-surface-card border border-surface-border
          rounded-t-2xl md:rounded-xl
          shadow-2xl
          animate-in slide-in-from-bottom md:slide-in-from-bottom-0
        "
      >
        {children}
      </div>
    </div>
  );
}
```

Note: `animate-in slide-in-from-bottom` requires `tailwindcss-animate` or it will silently no-op. The project doesn't have it installed, and adding a dep just for animation is overkill. Replace those classes with empty (no animation) — the sheet will appear instantly. If you want animation later, add `tailwindcss-animate` as a separate task.

Edit the className above and remove `animate-in slide-in-from-bottom md:slide-in-from-bottom-0` from the panel's className. Final panel className:

```
w-full md:w-auto md:max-w-lg
max-h-[85vh] md:max-h-[90vh]
overflow-y-auto
bg-surface-card border border-surface-border
rounded-t-2xl md:rounded-xl
shadow-2xl
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/__tests__/components/Sheet.test.tsx`
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Sheet.tsx src/__tests__/components/Sheet.test.tsx
git commit -m "feat(ui): add Sheet primitive (bottom sheet on mobile, dialog on desktop)"
```

---

### Task 6: Migrate `ConfirmDialog` to use `<Sheet>`

**Files:**
- Modify: `src/components/ConfirmDialog.tsx`
- Verify: `src/__tests__/components/ConfirmDialog.test.tsx` still passes

- [ ] **Step 1: Read the existing test**

Read `src/__tests__/components/ConfirmDialog.test.tsx`. Note any assertions on DOM structure (e.g., querying for `role="dialog"`). The Sheet wrapper provides `role="dialog"` so those should still pass.

- [ ] **Step 2: Refactor ConfirmDialog**

Replace `src/components/ConfirmDialog.tsx` contents with:

```tsx
"use client";
import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  };

  const confirmClass = destructive
    ? "bg-loss hover:bg-loss/90"
    : "bg-accent hover:bg-accent-dark";

  return (
    <Sheet open onClose={() => { if (!pending) onCancel(); }} labelledBy="confirm-dialog-title">
      <div className="p-5 md:p-6">
        <h2 id="confirm-dialog-title" className="text-lg font-bold text-white mb-2">{title}</h2>
        <p className="text-sm text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            aria-label={confirmLabel}
            className={`px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50 ${confirmClass}`}
          >
            {pending ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
```

Note: removed the local `useEffect` that handled Escape; `Sheet` now does this. Also removed the local `fixed inset-0` overlay.

- [ ] **Step 3: Run tests**

Run: `npm test -- src/__tests__/components/ConfirmDialog.test.tsx`
Expected: all tests PASS. If any fail because they asserted on a removed class (e.g., `fixed inset-0`), update the test selectors to use `role="dialog"` or visible text instead.

- [ ] **Step 4: Manual verification**

`npm run sandbox`
Navigate to `/analytics`, trigger a delete via the kebab menu on any holding.
At desktop viewport: dialog appears centered.
At 375px viewport (DevTools): dialog appears as bottom sheet.

- [ ] **Step 5: Commit**

```bash
git add src/components/ConfirmDialog.tsx src/__tests__/components/ConfirmDialog.test.tsx
git commit -m "refactor(ui): ConfirmDialog uses Sheet primitive"
```

---

### Task 7: Migrate `EditHoldingModal` to use `<Sheet>`

**Files:**
- Modify: `src/components/EditHoldingModal.tsx`
- Verify: `src/__tests__/components/EditHoldingModal.test.tsx` still passes

- [ ] **Step 1: Refactor EditHoldingModal**

Replace `src/components/EditHoldingModal.tsx` contents with:

```tsx
"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Sheet } from "@/components/ui/Sheet";
import type { PortfolioItem } from "@/types";

interface Props {
  holding: PortfolioItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditHoldingModal({ holding, onClose, onSuccess }: Props) {
  const { getIdToken } = useAuth();
  const [shares, setShares] = useState<number>(holding.shares);
  const [avgCost, setAvgCost] = useState<number>(holding.avgCost);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valid = Number.isFinite(shares) && shares > 0
    && Number.isFinite(avgCost) && avgCost > 0;

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/portfolio/${holding.ticker}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shares, avgCost }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Update failed (${res.status})`);
        return;
      }
      onSuccess();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open onClose={() => { if (!saving) onClose(); }} labelledBy="edit-holding-title">
      <div className="p-5 md:p-6">
        <h2 id="edit-holding-title" className="text-lg font-bold text-white mb-1">Edit holding</h2>
        <p className="text-sm text-gray-400 mb-4">{holding.ticker} &middot; {holding.companyName}</p>

        <div className="space-y-4">
          <div>
            <label htmlFor="edit-shares" className="block text-xs text-gray-400 mb-1">Shares</label>
            <input
              id="edit-shares"
              type="number"
              step="any"
              value={Number.isFinite(shares) ? shares : ""}
              onChange={(e) => setShares(parseFloat(e.target.value))}
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="edit-avgcost" className="block text-xs text-gray-400 mb-1">Avg Cost</label>
            <input
              id="edit-avgcost"
              type="number"
              step="any"
              value={Number.isFinite(avgCost) ? avgCost : ""}
              onChange={(e) => setAvgCost(parseFloat(e.target.value))}
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {error && <p className="text-loss text-sm mt-3">{error}</p>}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!valid || saving}
            className="px-4 py-2 text-sm bg-accent rounded-lg text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 2: Run tests**

Run: `npm test -- src/__tests__/components/EditHoldingModal.test.tsx`
Expected: all tests PASS. Update test selectors only if they asserted on the removed `fixed inset-0` wrapper.

- [ ] **Step 3: Manual verification**

`npm run sandbox`, edit a holding from `/analytics`. Desktop = centered dialog. 375px = bottom sheet.

- [ ] **Step 4: Commit**

```bash
git add src/components/EditHoldingModal.tsx src/__tests__/components/EditHoldingModal.test.tsx
git commit -m "refactor(ui): EditHoldingModal uses Sheet primitive"
```

---

### Task 8: Migrate `CsvImportModal` to use `<Sheet>`

**Files:**
- Modify: `src/components/CsvImportModal.tsx`
- Verify: `src/__tests__/components/CsvImportModal.test.tsx` still passes

- [ ] **Step 1: Refactor CsvImportModal**

In `src/components/CsvImportModal.tsx`:

Add the import at the top:
```tsx
import { Sheet } from "@/components/ui/Sheet";
```

Replace the JSX return — the outer `<div className="fixed inset-0 ...">` and inner `<div className="bg-surface-card border ... w-[480px] shadow-2xl">` chrome — with a `<Sheet>` wrapper.

The full new return (preserving all existing body logic):

```tsx
  return (
    <Sheet open onClose={onClose}>
      <div className="p-5 md:p-6">
        <h2 className="text-lg font-bold text-white mb-4">Import Holdings</h2>

        {!result ? (
          <>
            <div className="flex gap-1 mb-4 bg-surface-bg rounded-lg p-1">
              <button
                onClick={() => setMode("paste")}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition ${mode === "paste" ? "bg-accent text-white" : "text-gray-400 hover:text-white"}`}
              >
                Paste from Robinhood
              </button>
              <button
                onClick={() => setMode("csv")}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition ${mode === "csv" ? "bg-accent text-white" : "text-gray-400 hover:text-white"}`}
              >
                Upload CSV
              </button>
            </div>

            {mode === "paste" ? (
              <>
                <ol className="text-xs text-gray-400 mb-3 space-y-1 list-decimal list-inside">
                  <li>
                    Open{" "}
                    <a
                      href="https://robinhood.com/account/investing"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      robinhood.com/account/investing
                    </a>
                  </li>
                  <li>Scroll to the <span className="text-gray-300">Stocks</span> section</li>
                  <li>Select all rows in the stocks table and copy</li>
                  <li>Paste below and click Import</li>
                </ol>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste positions text here..."
                  aria-label="Paste positions"
                  className="w-full h-40 bg-surface-bg border border-surface-border rounded-lg p-3 text-sm text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-accent"
                />
              </>
            ) : (
              <>
                <label htmlFor="csv-file" className="block text-sm text-gray-400 mb-2">
                  Choose file
                </label>
                <input
                  id="csv-file"
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  aria-label="Choose file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-300 mb-4"
                />
              </>
            )}

            {error && <p className="text-loss text-sm mb-2">{error}</p>}
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
                className="px-4 py-2 text-sm bg-accent rounded-lg text-white disabled:opacity-50"
              >
                {loading ? "Importing..." : "Import"}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-2 text-sm">
            {result.imported.length > 0 && (
              <p className="text-gain">Imported: {result.imported.join(", ")}</p>
            )}
            {result.updated.length > 0 && (
              <p className="text-accent">Updated: {result.updated.join(", ")}</p>
            )}
            {result.removed.length > 0 && (
              <p className="text-loss">Removed: {result.removed.join(", ")}</p>
            )}
            {result.errors.length > 0 && (
              <div className="text-loss">
                <p>Errors:</p>
                {result.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
            <button onClick={handleResultClose} className="mt-4 px-4 py-2 text-sm bg-surface-border rounded text-white">
              Close
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
```

- [ ] **Step 2: Run tests**

Run: `npm test -- src/__tests__/components/CsvImportModal.test.tsx`
Expected: PASS. Update selectors that referenced the removed wrapper.

- [ ] **Step 3: Manual verification**

`npm run sandbox`, click Import. Desktop: centered dialog. 375px: bottom sheet, paste textarea fully usable.

- [ ] **Step 4: Commit**

```bash
git add src/components/CsvImportModal.tsx src/__tests__/components/CsvImportModal.test.tsx
git commit -m "refactor(ui): CsvImportModal uses Sheet primitive"
```

---

### Task 9: Build `<MobileMenu>` drawer and wire into `<Navbar>`

**Files:**
- Create: `src/components/MobileMenu.tsx`
- Create: `src/__tests__/components/MobileMenu.test.tsx`
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: Write failing tests for MobileMenu**

Create `src/__tests__/components/MobileMenu.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileMenu } from "@/components/MobileMenu";

const mockSignOut = jest.fn();
const mockPathname = jest.fn(() => "/");

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ signOut: mockSignOut }),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

jest.mock("@/lib/market-hours", () => ({
  isMarketOpen: () => true,
}));

describe("MobileMenu", () => {
  afterEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue("/");
  });

  it("renders nothing when closed", () => {
    render(<MobileMenu open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nav links when open", () => {
    render(<MobileMenu open onClose={() => {}} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
  });

  it("calls onClose when overlay is clicked", () => {
    const onClose = jest.fn();
    render(<MobileMenu open onClose={onClose} />);
    fireEvent.click(screen.getByTestId("mobile-menu-overlay"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Escape", () => {
    const onClose = jest.fn();
    render(<MobileMenu open onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when a nav link is clicked", () => {
    const onClose = jest.fn();
    render(<MobileMenu open onClose={onClose} />);
    fireEvent.click(screen.getByText("Analytics"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("highlights the active path", () => {
    mockPathname.mockReturnValue("/analytics");
    render(<MobileMenu open onClose={() => {}} />);
    const analyticsLink = screen.getByText("Analytics").closest("a");
    expect(analyticsLink?.className).toMatch(/from-primary/);
  });

  it("calls signOut when Sign out is clicked", () => {
    render(<MobileMenu open onClose={() => {}} />);
    fireEvent.click(screen.getByText("Sign out"));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/components/MobileMenu.test.tsx`
Expected: FAIL with "Cannot find module '@/components/MobileMenu'".

- [ ] **Step 3: Implement MobileMenu**

Create `src/components/MobileMenu.tsx`:

```tsx
"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isMarketOpen } from "@/lib/market-hours";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const marketOpen = isMarketOpen();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const tabs = [
    { href: "/", label: "Dashboard" },
    { href: "/analytics", label: "Analytics" },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      className="fixed inset-0 z-50 md:hidden"
    >
      <div
        data-testid="mobile-menu-overlay"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <aside className="absolute left-0 top-0 h-full w-[75vw] max-w-[320px] bg-surface-card border-r border-border/60 shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 p-5 border-b border-border/40">
          <div className="brand-mark h-10 w-10 rounded-xl flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-primary-foreground">
              <path d="M4 18L9 11L13 14L20 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="20" cy="6" r="1.6" fill="currentColor" />
            </svg>
          </div>
          <span className="font-display text-lg font-semibold text-foreground">Portfolio</span>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={onClose}
                className={`px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                  active
                    ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-3 space-y-2 border-t border-border/40">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border ${
              marketOpen
                ? "bg-positive/10 text-positive border-positive/30"
                : "bg-surface-elevated/60 text-muted-foreground border-border/60"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${marketOpen ? "bg-positive" : "bg-muted-foreground/60"}`} />
            {marketOpen ? "Market Open" : "Market Closed"}
          </div>
          <button
            onClick={signOut}
            className="w-full text-left px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Run MobileMenu tests**

Run: `npm test -- src/__tests__/components/MobileMenu.test.tsx`
Expected: all 7 tests PASS.

- [ ] **Step 5: Wire MobileMenu into Navbar**

Modify `src/components/Navbar.tsx` to:
1. Add `useState` for menu open.
2. Add a hamburger button visible only on `< md`.
3. Add `<MobileMenu>` render at the bottom.
4. Hide the market status chip below `md` (drawer carries it now).
5. Add `sm:` prefix so Import button shrinks to icon-only on the smallest screens.

Full replacement of `src/components/Navbar.tsx`:

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isMarketOpen } from "@/lib/market-hours";
import { MobileMenu } from "@/components/MobileMenu";

interface NavbarProps {
  onImportClick: () => void;
}

export function Navbar({ onImportClick }: NavbarProps) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const marketOpen = isMarketOpen();
  const [menuOpen, setMenuOpen] = useState(false);

  const tabs: { href: string; label: string }[] = [
    { href: "/", label: "Dashboard" },
    { href: "/analytics", label: "Analytics" },
  ];

  return (
    <>
      <nav className="h-16 flex items-center px-4 md:px-8 justify-between border-b border-border/40 backdrop-blur-md bg-background/40">
        <div className="flex items-center gap-3 md:gap-8">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="md:hidden inline-flex items-center justify-center h-11 w-11 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <div className="brand-mark h-10 w-10 rounded-xl flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-primary-foreground">
                <path d="M4 18L9 11L13 14L20 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="20" cy="6" r="1.6" fill="currentColor" />
              </svg>
            </div>
            <span className="font-display text-lg font-semibold tracking-tight text-foreground">
              Portfolio
            </span>
          </div>

          <div className="hidden md:inline-flex items-center gap-1 bg-surface-elevated/60 border border-border/60 rounded-full p-1">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                    active
                      ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-sm shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={`hidden md:inline-flex items-center gap-2 h-10 px-3.5 rounded-full text-xs font-medium tracking-wide border ${
              marketOpen
                ? "bg-positive/10 text-positive border-positive/30"
                : "bg-surface-elevated/60 text-muted-foreground border-border/60"
            }`}
          >
            <span className="relative flex h-2 w-2 items-center justify-center">
              {marketOpen && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-positive/60 animate-ping" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  marketOpen ? "bg-positive" : "bg-muted-foreground/60"
                }`}
              />
            </span>
            {marketOpen ? "Market Open" : "Market Closed"}
          </span>

          <button
            onClick={onImportClick}
            aria-label="Import"
            className="inline-flex items-center gap-1.5 h-10 px-3 sm:px-4 rounded-full text-sm font-medium text-primary-foreground bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-px transition-all"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
              <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            <span className="hidden sm:inline">Import</span>
          </button>

          <button
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
            className="hidden md:inline-flex items-center justify-center h-10 w-10 rounded-full bg-surface-elevated/60 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </div>
      </nav>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
```

Note: Sign out is hidden below `md` because it now lives in the drawer.

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 7: Manual verification**

`npm run sandbox`. At 375px viewport: hamburger appears top-left, market chip is hidden, Import shows icon-only, sign-out icon is hidden. Tap hamburger → drawer slides open with nav links + market chip + sign out. Tap a link → drawer closes, navigation happens. Tap outside drawer or press Escape → drawer closes.

At ≥768px: drawer hamburger is hidden, top tabs visible, market chip visible, full Import button, sign-out icon visible. Unchanged from before.

- [ ] **Step 8: Commit**

```bash
git add src/components/MobileMenu.tsx src/__tests__/components/MobileMenu.test.tsx src/components/Navbar.tsx
git commit -m "feat(nav): add mobile drawer with hamburger, hide chip+signout on mobile"
```

---

### Task 10: Refactor `HoldingsTable` with mobile card view + expand

**Files:**
- Modify: `src/components/HoldingsTable.tsx`
- Modify: `src/__tests__/components/HoldingsTable.test.tsx`

- [ ] **Step 1: Add failing test for the mobile card view**

Read `src/__tests__/components/HoldingsTable.test.tsx` to find an existing render pattern (it sets up `PortfolioItem[]` test data). Append these tests to the existing describe block:

```tsx
describe("HoldingsTable mobile cards", () => {
  it("renders the mobile card list", () => {
    // The card list has `md:hidden`, but jsdom renders it regardless;
    // we identify the card variant by data-testid to disambiguate from the table rows.
    render(<HoldingsTable items={mockItems} totalValue={10000} />);
    expect(screen.getAllByTestId("holding-card").length).toBe(mockItems.length);
  });

  it("expands a card when tapped and shows extra detail", () => {
    render(<HoldingsTable items={mockItems} totalValue={10000} />);
    const firstCard = screen.getAllByTestId("holding-card")[0];
    expect(firstCard.querySelector("[data-testid='holding-card-detail']")).toBeNull();

    fireEvent.click(firstCard);
    expect(firstCard.querySelector("[data-testid='holding-card-detail']")).not.toBeNull();
  });

  it("collapses the previous card when a different one is tapped", () => {
    render(<HoldingsTable items={mockItems} totalValue={10000} />);
    const cards = screen.getAllByTestId("holding-card");
    fireEvent.click(cards[0]);
    expect(cards[0].querySelector("[data-testid='holding-card-detail']")).not.toBeNull();
    fireEvent.click(cards[1]);
    expect(cards[0].querySelector("[data-testid='holding-card-detail']")).toBeNull();
    expect(cards[1].querySelector("[data-testid='holding-card-detail']")).not.toBeNull();
  });

  it("collapses on second tap of the same card", () => {
    render(<HoldingsTable items={mockItems} totalValue={10000} />);
    const firstCard = screen.getAllByTestId("holding-card")[0];
    fireEvent.click(firstCard);
    fireEvent.click(firstCard);
    expect(firstCard.querySelector("[data-testid='holding-card-detail']")).toBeNull();
  });
});
```

The existing test file should already have `mockItems` defined; if not, copy the first existing render's items as your test data.

- [ ] **Step 2: Run new tests to verify they fail**

Run: `npm test -- src/__tests__/components/HoldingsTable.test.tsx`
Expected: the new `HoldingsTable mobile cards` block fails because `holding-card` testid doesn't exist.

- [ ] **Step 3: Refactor HoldingsTable**

In `src/components/HoldingsTable.tsx`:

1. Add expand state at the top of the component, next to `openMenuTicker`:

```tsx
const [expandedCardTicker, setExpandedCardTicker] = useState<string | null>(null);
```

2. Wrap the existing `<div className="overflow-x-auto"><table>...</table></div>` in a `<div className="hidden md:block">` so the table only renders at md+.

3. Add a new mobile-only block (`<div className="md:hidden">`) right after that, containing the card list. The block renders the same `sorted` array.

Replace the current return block (starting at line 132 of the existing file, the `return (` line) with:

```tsx
  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by ticker or company..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-xs px-3 py-1.5 bg-surface-border text-white text-sm rounded border border-surface-border focus:outline-none focus:ring-1 focus:ring-accent placeholder-gray-500"
        />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              <SortHeader label="Ticker" col="ticker" />
              <SortHeader label="Company" col="companyName" />
              <SortHeader label="Shares" col="shares" />
              <SortHeader label="Avg Cost" col="avgCost" />
              <SortHeader label="Current Price" col="price" />
              <SortHeader label="Market Value" col="marketValue" />
              <SortHeader label="Day Change" col="dayChange" />
              <SortHeader label="Total P&L" col="totalPL" />
              <SortHeader label="% of Portfolio" col="portfolioPercent" />
              {showActions && <th className="px-3 py-2" aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const portfolioPct =
                totalValue > 0
                  ? ((item.marketValue / totalValue) * 100).toFixed(1)
                  : "0.0";
              const dayPositive = item.quote.changePercent >= 0;
              const plPositive = item.totalPL >= 0;

              return (
                <tr
                  key={item.ticker}
                  className="border-b border-surface-border hover:bg-surface-border/30"
                >
                  <td className="px-3 py-2 font-mono font-semibold text-white">{item.ticker}</td>
                  <td className="px-3 py-2 text-gray-300">{item.companyName}</td>
                  <td className="px-3 py-2 text-gray-300">{item.shares}</td>
                  <td className="px-3 py-2 text-gray-300">${item.avgCost.toFixed(2)}</td>
                  <td className="px-3 py-2 text-gray-300">${item.quote.price.toFixed(2)}</td>
                  <td className="px-3 py-2 text-gray-300">{fmt(item.marketValue)}</td>
                  <td className={`px-3 py-2 ${dayPositive ? "text-gain" : "text-loss"}`}>
                    {dayPositive ? "+" : ""}{item.quote.changePercent.toFixed(2)}%
                  </td>
                  <td className={`px-3 py-2 ${plPositive ? "text-gain" : "text-loss"}`}>
                    {plPositive ? "" : "-"}{fmt(item.totalPL)}
                  </td>
                  <td className="px-3 py-2 text-gray-300">{portfolioPct}%</td>
                  {showActions && (
                    <td className="px-3 py-2 relative">
                      <button
                        type="button"
                        aria-label={`Actions for ${item.ticker}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openMenuTicker === item.ticker) {
                            setOpenMenuTicker(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          const spaceBelow = window.innerHeight - rect.bottom;
                          setMenuDirection(spaceBelow < MENU_HEIGHT ? "up" : "down");
                          setOpenMenuTicker(item.ticker);
                        }}
                        className="text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-surface-border"
                      >
                        ⋯
                      </button>
                      {openMenuTicker === item.ticker && (
                        <div
                          ref={menuRef}
                          className={`absolute right-0 ${menuDirection === "up" ? "bottom-full mb-1" : "top-full mt-1"} bg-surface-card border border-surface-border rounded-md shadow-lg z-10 min-w-[120px]`}
                        >
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => { setOpenMenuTicker(null); onEdit(item); }}
                              className="block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-surface-border"
                            >
                              Edit
                            </button>
                          )}
                          {onDelete && (
                            <button
                              type="button"
                              onClick={() => { setOpenMenuTicker(null); onDelete(item); }}
                              className="block w-full text-left px-3 py-2 text-sm text-loss hover:bg-surface-border"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="text-center py-8 text-gray-500">No holdings found</div>
        )}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {sorted.map((item) => {
          const dayPositive = item.quote.changePercent >= 0;
          const plPositive = item.totalPL >= 0;
          const expanded = expandedCardTicker === item.ticker;
          return (
            <div
              key={item.ticker}
              data-testid="holding-card"
              onClick={() =>
                setExpandedCardTicker(expanded ? null : item.ticker)
              }
              className="p-3 rounded-lg border border-surface-border bg-surface-card hover:bg-surface-border/30 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-white">{item.ticker}</span>
                <span className={dayPositive ? "text-gain" : "text-loss"}>
                  {dayPositive ? "+" : ""}{item.quote.changePercent.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 text-sm">
                <span className="text-gray-300">{fmt(item.marketValue)}</span>
                <span className={plPositive ? "text-gain" : "text-loss"}>
                  {plPositive ? "" : "-"}{fmt(item.totalPL)}
                </span>
              </div>

              {expanded && (
                <div
                  data-testid="holding-card-detail"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 pt-3 border-t border-surface-border text-xs text-gray-400 space-y-1"
                >
                  <div className="text-gray-300">{item.companyName}</div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>Shares</span><span className="text-right text-gray-300">{item.shares}</span>
                    <span>Avg Cost</span><span className="text-right text-gray-300">${item.avgCost.toFixed(2)}</span>
                    <span>Price</span><span className="text-right text-gray-300">${item.quote.price.toFixed(2)}</span>
                  </div>
                  {showActions && (
                    <div className="flex gap-2 pt-2">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          className="flex-1 px-3 py-2 text-sm bg-surface-border rounded text-white"
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(item)}
                          className="flex-1 px-3 py-2 text-sm bg-loss/20 text-loss rounded"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div className="text-center py-8 text-gray-500">No holdings found</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/__tests__/components/HoldingsTable.test.tsx`
Expected: all tests PASS (existing + 4 new mobile card tests).

If existing table tests fail because they call `screen.getByText` for content that now appears twice (once in table, once in card), update the failing selectors to be more specific (`within(table)` scoping, or use the table-row testid).

- [ ] **Step 5: Manual verification**

`npm run sandbox`. `/analytics` at 375px: cards appear instead of table. Tap to expand. Edit and Delete buttons reachable. At ≥768px: table appears, cards are hidden.

- [ ] **Step 6: Commit**

```bash
git add src/components/HoldingsTable.tsx src/__tests__/components/HoldingsTable.test.tsx
git commit -m "feat(holdings): mobile card view with tap-to-expand detail"
```

---

### Task 11: Refactor `TreemapTooltip` → `<TileDetail>` with mobile sheet branch

**Files:**
- Modify: `src/components/TreemapTooltip.tsx` (rename internally to `TileDetail`, keep file name and export name for backwards compatibility)
- Modify: `src/app/page.tsx`
- Verify: `src/__tests__/components/TreemapTooltip.test.tsx` still passes

- [ ] **Step 1: Add a failing test for mobile sheet branch**

In `src/__tests__/components/TreemapTooltip.test.tsx`, append:

```tsx
describe("TreemapTooltip mobile", () => {
  beforeEach(() => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      media: "(max-width: 767px)",
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
  });

  it("renders the detail inside a Sheet on mobile", () => {
    render(<TreemapTooltip item={mockItem} tileRect={null} />);
    // Sheet provides role=dialog; the floating tooltip does not.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
```

`mockItem` should be a `PortfolioItem` — copy from an existing test in the same file.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/__tests__/components/TreemapTooltip.test.tsx`
Expected: the new test fails because `role="dialog"` does not appear in the current floating-tooltip variant.

- [ ] **Step 3: Refactor TreemapTooltip**

Replace `src/components/TreemapTooltip.tsx` with:

```tsx
"use client";
import { useIsMobile } from "@/lib/use-is-mobile";
import { Sheet } from "@/components/ui/Sheet";
import type { PortfolioItem } from "@/types";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export interface TileRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_W = 256;
const TOOLTIP_H = 220;
const GAP = 8;

function position(rect: TileRect | null) {
  if (!rect) return { top: 0, left: 0 };
  const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080;

  let top = rect.top - TOOLTIP_H - GAP;
  if (top < GAP) top = rect.top + rect.height + GAP;
  if (top + TOOLTIP_H > vh - GAP) top = Math.max(GAP, vh - TOOLTIP_H - GAP);

  let left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
  left = Math.max(GAP, Math.min(left, vw - TOOLTIP_W - GAP));

  return { top, left };
}

interface Props {
  item: PortfolioItem | null;
  tileRect: TileRect | null;
  /** Called when the mobile sheet overlay is tapped. Desktop tooltip ignores. */
  onClose?: () => void;
}

function TileBody({ item }: { item: PortfolioItem }) {
  const dayChange = item.quote.change * item.shares;
  return (
    <>
      <div className="font-display text-base font-semibold text-foreground">
        {item.companyName}
      </div>
      <div className="text-xs text-muted-foreground mb-3 mt-0.5">
        <span className="font-mono">{item.ticker}</span>
        <span className="mx-1.5 opacity-40">·</span>
        {item.sector}
      </div>
      <div className="grid grid-cols-2 gap-y-1.5 text-xs">
        <span className="text-muted-foreground">Shares</span>
        <span className="text-right font-mono text-foreground">{item.shares}</span>
        <span className="text-muted-foreground">Avg Cost</span>
        <span className="text-right font-mono text-foreground">{fmt(item.avgCost)}</span>
        <span className="text-muted-foreground">Price</span>
        <span className="text-right font-mono text-foreground">{fmt(item.quote.price)}</span>
        <span className="text-muted-foreground">Market Value</span>
        <span className="text-right font-mono text-foreground">{fmt(item.marketValue)}</span>
        <span className="text-muted-foreground">Total P&L</span>
        <span className={`text-right font-mono ${item.totalPL >= 0 ? "text-positive" : "text-negative"}`}>
          {fmt(item.totalPL)} ({item.totalPLPercent.toFixed(1)}%)
        </span>
        <span className="text-muted-foreground">Day Change</span>
        <span className={`text-right font-mono ${dayChange >= 0 ? "text-positive" : "text-negative"}`}>
          {fmt(dayChange)} ({item.quote.changePercent.toFixed(2)}%)
        </span>
      </div>
    </>
  );
}

export function TreemapTooltip({ item, tileRect, onClose }: Props) {
  const isMobile = useIsMobile();
  if (!item) return null;

  if (isMobile) {
    return (
      <Sheet open onClose={onClose ?? (() => {})}>
        <div className="p-5">
          <TileBody item={item} />
        </div>
      </Sheet>
    );
  }

  const { top, left } = position(tileRect);
  return (
    <div
      className="bento-card fixed z-50 p-5 text-sm pointer-events-none transition-[top,left] duration-100 ease-out"
      style={{ top, left, width: TOOLTIP_W }}
    >
      <TileBody item={item} />
    </div>
  );
}
```

- [ ] **Step 4: Wire the new onClose prop in `src/app/page.tsx`**

In `src/app/page.tsx`, locate the `<TreemapTooltip item={selectedItem} tileRect={tileRect} />` usage (around line 235).

Replace with:

```tsx
<TreemapTooltip
  item={selectedItem}
  tileRect={tileRect}
  onClose={dismissSelection}
/>
```

This gives the mobile sheet a real close handler. The desktop variant ignores it (it has `pointer-events-none`).

- [ ] **Step 5: Run tests**

Run: `npm test -- src/__tests__/components/TreemapTooltip.test.tsx`
Expected: all tests PASS (existing + new mobile test).

- [ ] **Step 6: Manual verification**

`npm run sandbox`.

At desktop viewport:
- Tap a treemap tile → floating tooltip appears near the tile (unchanged).
- Click outside → tooltip dismisses (unchanged).

At 375px viewport:
- Tap a tile → bottom sheet slides up with the same content.
- Tap overlay → sheet closes and `selectedItem` clears (no double-dismiss).
- Press Escape → sheet closes.

- [ ] **Step 7: Commit**

```bash
git add src/components/TreemapTooltip.tsx src/app/page.tsx src/__tests__/components/TreemapTooltip.test.tsx
git commit -m "feat(treemap): tile detail renders as bottom sheet on mobile"
```

---

### Phase 2 Checkpoint

- [ ] **Final smoke test**

Run: `npm test`
Expected: all tests PASS.

Run: `npm run lint`
Expected: no errors.

`npm run sandbox` and check:
- 375×667: dashboard, analytics, hamburger drawer, treemap tile sheet, holdings cards, all three modal sheets.
- 768×1024: dashboard 2-col, analytics 2-col, top tabs, dialogs centered.
- 1280+: original desktop layout unchanged.

- [ ] **Real-device check** (before opening PR)

Open the local dev server URL on your actual phone (same WiFi). Verify the bottom sheets and drawer feel right — DevTools emulation hides touch quirks.

- [ ] **Open PR for Phase 2**

```bash
git push origin feat/mobile-friendly
gh pr create --title "Mobile-friendly Phase 2: sheets, drawer, condensed table" --body "$(cat <<'EOF'
## Summary
- New <Sheet> primitive: bottom sheet on mobile, centered dialog on desktop
- New useIsMobile() hook
- MobileMenu drawer wired into Navbar (hamburger on phones)
- HoldingsTable renders condensed cards on mobile with tap-to-expand detail
- TreemapTooltip becomes TileDetail with mobile bottom-sheet rendering
- CsvImportModal, EditHoldingModal, ConfirmDialog migrated to <Sheet>

## Test plan
- [ ] `npm test` passes
- [ ] DevTools 375×667: drawer opens, holdings cards expand, tile tap opens sheet, modals slide up
- [ ] DevTools 768×1024: top tabs visible, dialogs centered, table view
- [ ] Real-device check on phone
EOF
)"
```

---

## Self-review

**Spec coverage:**
- Breakpoint strategy → Tasks 1, 2 (Phase 1).
- `<Sheet>` primitive → Task 5.
- `useIsMobile()` hook → Task 4.
- Mobile-first conventions (grid, gap, padding) → Tasks 1, 2.
- Phase 1 layout sweep (analytics page, dashboard page, body overflow) → Tasks 1, 2, 3.
- Navigation (`<MobileMenu>`, Navbar changes) → Task 9.
- `<HoldingsTable>` mobile cards → Task 10.
- `<TreemapTooltip>` → `<TileDetail>` sheet → Task 11.
- Modal migrations (Confirm, Edit, CsvImport) → Tasks 6, 7, 8.
- Step order discipline (Sheet → simplest modal first → drawer → table → tile) → preserved.
- Testing approach (Sheet, useIsMobile, MobileMenu, holdings expand, tile mobile) → covered.
- Out-of-scope (PWA, native, gestures) → respected (no tasks for these).

**Placeholder scan:** No TBDs or "implement later". Every code step has the full code body.

**Type consistency:**
- `useIsMobile` returns `boolean` everywhere (Task 4 declaration, Task 11 consumer).
- `Sheet` props `{ open, onClose, children, labelledBy? }` are consistent across consumers (Tasks 6, 7, 8, 11).
- `MobileMenu` props `{ open, onClose }` consistent (Task 9 declaration + Navbar consumer).
- `HoldingsTable` interface unchanged — no consumer changes needed.
- `TreemapTooltip` adds an optional `onClose?` prop — backwards compatible.

**Scope:** Two PRs, each self-contained. Phase 1 is reviewable in one sitting; Phase 2 has 8 commits internally but a single focused diff per commit.
