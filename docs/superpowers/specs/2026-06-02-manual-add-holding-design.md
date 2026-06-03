# Manually add a single stock

## Problem

The only way to get holdings into the portfolio today is the CSV/paste import
(`CsvImportModal` → `POST /api/import`), which bulk-replaces the whole
portfolio. There is no way to add one position by hand — e.g. to correct a
missing holding or add a stock bought outside Robinhood without re-importing.

## Goal

A lightweight "add one stock" flow: enter ticker, shares, and average cost;
the holding is validated, enriched with company name + sector, and written as a
single new position without disturbing the rest of the portfolio.

## Design

### Backend — `POST /api/portfolio`

New handler added to the existing collection route
(`src/app/api/portfolio/route.ts`, which currently only has `GET`).

- Auth via `verifyRequest(req)` with the standard `instanceof NextResponse`
  guard (first line of the handler).
- Body: `{ ticker, shares, avgCost }`.
- Validation:
  - `shares` and `avgCost` must be positive finite numbers (mirror the
    `isPositiveFinite` helper in `[ticker]/route.ts`) → `400` otherwise.
  - `ticker` normalized to uppercase + trimmed; empty → `400`.
- Duplicate check: if the holding doc already exists for this uid, return
  `409 { error: "<TICKER> is already in your portfolio. Edit it instead." }`.
- Validate + enrich: call `enrichHoldings([ticker])` (which now carries the
  crypto `-USD` fallback). If it returns no summary for the ticker, the symbol
  isn't real → `400 { error: "Couldn't find a stock for ‘<TICKER>’." }`.
  Otherwise use the resolved `name` + `sector`.
- Write the holding doc:
  `{ ticker, companyName, sector, shares, avgCost, addedAt }` with `addedAt`
  as an ISO string (per repo convention). Return the created holding.

Why a dedicated endpoint rather than reusing `importHoldings`: the import
pipeline's `writeHoldings` is a bulk *replace* — it deletes any holding not in
the submitted set. Reusing it for a single add would wipe the rest of the
portfolio. `PATCH /api/portfolio/[ticker]` is also unsuitable: it deliberately
404s when the holding doesn't exist (it's edit-only).

### Frontend — `AddHoldingModal.tsx`

A new component mirroring `EditHoldingModal`: same `Sheet` wrapper, same input
styling and save/cancel footer. Differs by adding a **ticker** text input
(auto-uppercased) above the **shares** and **avg cost** number inputs.

- Save disabled until ticker is non-empty and shares/avgCost are positive
  finite.
- `POST`s to `/api/portfolio`; maps `400` → "couldn't find" message and `409`
  → "already held" message into the inline error area.
- On success calls `onSuccess()`, which triggers `fetchPortfolio()` in
  `page.tsx` so the treemap + holdings table re-render with the new position.

### Entry points — one modal, three buttons

`page.tsx` gains a `showAddHolding` state and passes an `onAddClick` callback to:

- **Navbar** — a `+ Add` button beside the existing Import button.
- **EmptyPortfolio** — a secondary "add one manually" action under the Import
  CTA.
- **HoldingsTable** — a `+ Add` button in its header.

### Data flow

Any entry point → `AddHoldingModal` → `POST /api/portfolio` →
validate / dedupe / enrich → Firestore write → `onSuccess` → `fetchPortfolio()`
refetch → heatmap + table re-render.

### Error handling

| Case | Status | User-facing message |
|------|--------|---------------------|
| No / invalid auth | 401 | (handled by `verifyRequest`) |
| Missing or non-positive shares/avgCost | 400 | "shares/avgCost must be a positive number" |
| Empty ticker | 400 | "Ticker is required" |
| Unknown symbol (enrich found nothing) | 400 | "Couldn't find a stock for ‘XYZ’." |
| Ticker already held | 409 | "AAPL is already in your portfolio. Edit it instead." |

## Testing (TDD)

- **API** (`src/__tests__/api/portfolio.test.ts`, mocking `firebase-admin` +
  `enrichHoldings`): create success, 409 duplicate, 400 unknown ticker, 400 bad
  shares/avgCost, 401 unauth.
- **Component** (`AddHoldingModal`, jsdom): save disabled until valid, error
  message rendering on 400/409, success callback fires on 200.

## Out of scope (YAGNI)

- Transaction-history / cost-basis lot tracking (the CSV path handles that).
- Live price preview inside the form.
- Bulk add (that's the existing CSV/paste import).
