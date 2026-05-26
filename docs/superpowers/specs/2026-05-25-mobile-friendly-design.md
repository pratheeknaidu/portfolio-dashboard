# Mobile-Friendly Web App — Design

**Date:** 2026-05-25
**Goal:** Full feature parity on mobile (every action that works on desktop works on a phone).
**Approach:** Responsive components with thin primitives (`<Sheet>`, `useIsMobile`), shipped in two phases.

---

## Context

The app is desktop-first. Concrete breakage on mobile today:

- `src/app/analytics/page.tsx` uses `grid-cols-2` with no responsive prefix — two 50%-width cards crammed into a 375px viewport.
- `src/components/Navbar.tsx` hides Dashboard/Analytics tabs entirely below `md:` (`hidden md:inline-flex`) — there is no way to navigate between pages on mobile.
- `src/components/HoldingsTable.tsx` has 8+ columns, will not fit on a phone.
- `src/components/TreemapTooltip.tsx` positions a floating tooltip against a tile rect — on a 375px screen with tiny tiles, it overlaps neighbors.
- Modals (`CsvImportModal`, `EditHoldingModal`, `ConfirmDialog`) are hand-rolled centered cards at a fixed width (`w-[480px]`) that overflow narrower screens.
- The dashboard uses `lg:col-span-*` for its hero/metrics/movers grid, which forces unnecessary single-column stacking on 768–1023px tablets.

## Goals

- Every page renders without horizontal overflow at 375×667.
- Every action (import, edit, delete, navigate, drill into a tile) works on touch.
- Tablet (768–1023px) gets a proper two-column experience, not the same stack as a phone.
- Desktop behavior is unchanged.

## Non-goals

- Native app, PWA install, offline support.
- Mobile-specific gestures beyond bottom-sheet dismiss.
- Replacing the nivo `<Treemap>` with a custom mobile-tuned renderer.
- User-facing toggle to opt out of mobile layout.

---

## Architecture

### Breakpoint strategy (Tailwind 3.4 defaults, no config change)

| Range | Tailwind prefix | Layout |
|------|-----------------|--------|
| `< 640px` | (default) | Phone. Single column, bottom sheets, drawer nav. |
| `640–767px` | `sm:` | Large phone / small tablet. Mostly still mobile patterns. |
| `768–1023px` | `md:` | Tablet. Two-column grids, table view, top-nav tabs, dialogs. |
| `≥ 1024px` | `lg:` | Desktop. Full layout. |

Convention: mobile-first. `grid-cols-1 md:grid-cols-2`, not `grid-cols-2 sm:grid-cols-1`.

### New primitives

**`<Sheet>`** — `src/components/ui/Sheet.tsx`

- Renders as a bottom sheet on `< md` (slides up, `rounded-t-2xl`, full-width, max-height ~85vh, internal scroll).
- Renders as a centered dialog on `≥ md` (matches current modal styling).
- API: `<Sheet open onClose>{children}</Sheet>`.
- Hand-rolled (no Radix dep — matches existing project style). Includes:
  - Focus trap (Tab cycles through focusable descendants).
  - `Escape` to close.
  - Scroll lock on `<body>` while open.
  - `role="dialog" aria-modal="true"`.
  - Overlay click closes; `e.stopPropagation()` on overlay before calling `onClose` so document-level click handlers don't double-fire.

**`useIsMobile()`** — `src/lib/use-is-mobile.ts`

- Reads `window.matchMedia("(max-width: 767px)")`.
- Returns `false` on the server (avoids hydration mismatch); swaps to actual value after mount.
- Listens for resize changes via `matchMedia.addEventListener("change", ...)`.
- Used only where CSS can't decide: `TileDetail` rendering branch.

### Mobile-first refactor conventions

- `grid-cols-N` → `grid-cols-1 md:grid-cols-N` everywhere it was non-responsive.
- `gap-6` → `gap-4 md:gap-6` on dense card grids.
- `p-6` on card containers → `p-4 md:p-6`.
- `lg:col-span-*` → `md:col-span-*` on the dashboard row 1 and row 3 grids (let tablets see 2-col).
- Buttons sized `h-8` or smaller → `h-10 md:h-8` on mobile for touch targets.

---

## Phase 1 — Layout sweep (one PR, ~1 day)

Pure Tailwind class edits. No new components, no new deps.

### `src/app/analytics/page.tsx`

- Line 117: `p-6 space-y-8` → `p-4 md:p-6 space-y-6 md:space-y-8`.
- Line 118: `grid grid-cols-2 gap-6` → `grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6`.
- Line 132: same change as line 118.
- All `<section>` cards: `p-6` → `p-4 md:p-6`.

### `src/app/page.tsx`

- Line 185: `<main>` padding `py-8` → `py-4 md:py-8`.
- Row 1 (hero + metrics): `lg:col-span-8` → `md:col-span-8`; `lg:col-span-4` → `md:col-span-4`.
- Row 3 (allocation + movers): `lg:col-span-5` → `md:col-span-5`; `lg:col-span-7` → `md:col-span-7`.
- Treemap container height `h-[440px] md:h-[520px]` → `h-[360px] sm:h-[440px] md:h-[520px]`.

### `src/app/layout.tsx`

- Add `overflow-x-hidden` to `<body>` (or `<html>`) as a safety net against single-component horizontal overflow. Real overflow gets fixed at the source; this is belt-and-suspenders.

### Verification

Chrome DevTools mobile emulation at 375×667, 390×844, 768×1024. Both pages must:
- Have no horizontal scroll.
- Show all card content (no clipped text or buttons).
- Render the dashboard 2-col hero/metrics at 768px+.

Phase 1 ships independently. The app is usable on mobile after this PR even though navigation, modals, and the table aren't polished yet.

---

## Phase 2 — Interaction patterns (one PR, ~2–3 days)

Builds the primitives and refactors components.

### Step order (incremental, each step verifiable):

1. **Build `<Sheet>` + tests.** No consumers yet.
2. **Build `useIsMobile()` + tests.**
3. **Migrate `ConfirmDialog`** (simplest body) to use `<Sheet>`. Verify modal still works on desktop, slides up on mobile.
4. **Migrate `EditHoldingModal`** to `<Sheet>`.
5. **Migrate `CsvImportModal`** to `<Sheet>` (most complex — has paste/csv mode toggle, result view, file input).
6. **Build `<MobileMenu>` drawer + integrate into `<Navbar>`.**
7. **Refactor `HoldingsTable`** to render `<HoldingsCards>` mobile view.
8. **Refactor `TreemapTooltip` → `<TileDetail>`** with sheet branch on mobile.

### Navigation: `<MobileMenu>` drawer

New file `src/components/MobileMenu.tsx`.

- Slides in from the **left**, full-height, ~75vw wide (max 320px).
- Dimmed backdrop; tap-outside and `Escape` close.
- Focus-trapped while open.
- Contents top → bottom:
  1. Brand block (logo + "Portfolio").
  2. Nav links: Dashboard, Analytics — same active-state pill styling as desktop tabs, stacked vertically.
  3. Divider.
  4. Market status row (the positive/animated-ping chip, full-width left-aligned).
  5. Sign out at the bottom.
- Closes on `pathname` change (`useEffect`).

`<Navbar>` changes:

- Below `md`: hamburger button (44×44 touch target) on the left, replacing the hidden tab pill.
- Below `sm`: Import button shrinks to icon-only; on `sm:` and up it shows icon+label.
- Market chip moves into the drawer; remove `hidden sm:inline-flex` wrapper from the navbar version (or hide it on `< md` since the drawer carries it).
- `md:` and up: unchanged.
- Drawer open/close state lives in `<Navbar>` (`useState`); not threaded through pages.

### `<HoldingsTable>` → condensed cards on mobile

Single component, two internal views. State (sort, expanded card) stays at the top.

- Desktop (`hidden md:block`): existing `<table>` unchanged.
- Mobile (`md:hidden`): vertical stack of cards. Each card:
  - Top row: ticker (bold, left) + % change (colored, right).
  - Second row: market value (left) + P&L $ (colored, right).
  - Tap → smooth height transition expands inline showing company name, shares, avg cost, current price, edit & delete buttons.
  - Only one card expanded at a time; tapping another swaps; tapping the expanded card collapses.
- No bottom sheet for table rows — inline expand keeps scroll position and feels lighter for tabular data.

### `<TreemapTooltip>` → `<TileDetail>`

Rename to reflect that it's no longer always a tooltip.

- `useIsMobile()` → wrap content in `<Sheet>`. Existing `tileRect` positioning math is skipped.
- Desktop → render the floating-tooltip variant exactly as today.

**Double-dismiss gotcha:** the page-level `document.addEventListener("click", dismiss)` in `src/app/page.tsx` would fire when the user taps the sheet overlay, racing with `<Sheet>`'s own `onClose`. Fix: `<Sheet>` calls `e.stopPropagation()` on overlay click before invoking `onClose`. The existing `setTimeout(..., 0)` in `page.tsx` that defers the click handler one tick is still needed for the desktop floating-tooltip case; leave it alone.

### Modals → `<Sheet>` wrapper

For each of `CsvImportModal`, `EditHoldingModal`, `ConfirmDialog`:

- Strip the `fixed inset-0 bg-black/60 flex items-center justify-center z-50` wrapper.
- Strip the inner `bg-surface-card border ... w-[480px]` chrome — `<Sheet>` provides this now.
- Wrap remaining body in `<Sheet open onClose={onClose}>{...}</Sheet>`.
- Body content (textarea, form fields, mode toggle, result view) stays as-is.

---

## Things explicitly unchanged

- `<Treemap>` (nivo) — sizes to its container; container shrinks via Phase 1.
- `<PortfolioHeroCard>`, `<MetricCard>`, `<AllocationCard>`, `<MoversCard>` — already mostly responsive; minor padding bumps only.
- `<SectorChart>`, `<PerformanceChart>` — recharts handles its own sizing.
- API routes, auth, Firestore schema, quote fetching, snapshot writing — none change.
- The 60s polling logic in `src/app/page.tsx` — unchanged.

---

## Testing

### Unit (jest + jsdom)

- **`<Sheet>`:** opens/closes, scroll lock toggles on `<body>`, Escape closes, focus trap cycles, overlay click fires `onClose`, overlay click calls `stopPropagation` first. Mock `matchMedia` to test mobile-vs-desktop variant rendering.
- **`useIsMobile`:** returns `false` on initial server-side-style render (no `window.matchMedia` listener fired yet), returns mocked matchMedia value after mount, updates on `change` event.
- **`<HoldingsTable>`:** with mocked `matchMedia(max-width: 767px)` returning true, renders `<HoldingsCards>` and not `<table>`; vice versa for desktop. Tap-to-expand toggles the expanded card; tapping a second collapses the first.
- **`<MobileMenu>`:** opens from hamburger, closes on Link click (via mocked `next/navigation`), closes on Escape.
- **Existing modal tests** keep passing — `<Sheet>` swap is behavior-transparent. Update any test that asserts on the old wrapper class names.

### Manual

Chrome DevTools at 375×667, 390×844, 768×1024.

After Phase 1: no horizontal overflow, drawer hamburger visible, both pages usable.
After Phase 2: holdings cards expand cleanly, tile tap opens bottom sheet, modals slide up from bottom, drawer slides from left.

**Real-device check** before merging Phase 2 — DevTools emulation does not faithfully reproduce touch + scroll-locking behavior that matters for sheets.

### Not tested

- Visual regression / screenshots (no existing pipeline; not worth adding).
- Real-device touch gesture for swipe-down-to-close (implement but verify manually only).

---

## Rollout & risk

- **Phase 1** is near-zero-risk — CSS class changes only. Worst case is tablet layout needs a breakpoint tweak.
- **Phase 2** risk is concentrated in `<Sheet>` since all modals depend on it. Mitigation:
  1. Build `<Sheet>` with full test coverage before any consumer migrates.
  2. Migrate `ConfirmDialog` first (simplest), verify, then `EditHoldingModal`, then `CsvImportModal`.
  3. Each step is a separate commit so anything can be reverted independently.
- No data-layer, API, or auth changes.
- No new runtime dependencies.

---

## Open questions (none blocking)

- If we later add a third top-level page, the drawer accommodates it without redesign. If we go beyond ~5 sections, revisit (drawer scroll, grouped sections).
- Real-device testing surface — assumed Phase 2 reviewer will use Chrome on a phone. Worth a brief note in the PR description.
