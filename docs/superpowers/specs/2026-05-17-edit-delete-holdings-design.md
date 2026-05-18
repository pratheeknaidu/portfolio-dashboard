# Edit / Delete Individual Holdings — Design Spec

**Date:** 2026-05-17
**Status:** Approved, ready for implementation

## Goal

Let users edit (`shares`, `avgCost`) or delete individual holdings from the HoldingsTable on `/analytics`, without re-pasting their whole portfolio.

## Out of scope

- Editing `ticker` (doc id, identity), `companyName` / `sector` (auto-enriched), `addedAt` (audit field).
- Bulk edit/delete — re-import covers bulk via the existing replace-on-paste semantics.
- Optimistic UI updates — refetch after mutation is fast enough.
- Undo flows, audit log, change history.

## Approach summary

| Decision | Chosen | Alternatives rejected |
|----------|--------|----------------------|
| Where the controls live | Actions column on `/analytics`'s HoldingsTable | Treemap tooltip on `/` (would require making the pinned tooltip interactive) |
| Trigger UX | `⋯` kebab dropdown → Edit / Delete | Two icon buttons (less compact); inline row editing (state complexity in HoldingsTable) |
| Edit UX | Small modal with two number inputs, matching the import modal pattern | Inline-row editing; popover anchored to row |
| Delete UX | Confirm dialog ("Remove AAPL from your portfolio?") | Undo strip; no confirm |
| Data refresh | Refetch portfolio + quotes after mutation | Optimistic update with rollback |

## API

New dynamic route: `src/app/api/portfolio/[ticker]/route.ts`. Both handlers use `verifyRequest` (existing pattern) and scope writes to `users/{uid}/holdings/{TICKER}`. Ticker path param is uppercased on entry to match the doc-id convention.

### `PATCH /api/portfolio/[ticker]`

- **Body:** `{ shares?: number, avgCost?: number }` — at least one field required.
- **Validation:** any provided field must be finite and `> 0`.
- **Behavior:** Firestore `set(payload, { merge: true })` so `addedAt` is preserved.
- **Responses:**
  - `200` → `{ ticker, shares, avgCost }`
  - `400` → `{ error: "<message>" }` on invalid input
  - `404` → `{ error: "Holding not found" }` when the doc doesn't exist
  - `401` → unauth (via `verifyRequest`)

### `DELETE /api/portfolio/[ticker]`

- **Body:** none.
- **Behavior:** Firestore `delete()`. Idempotent — no 404 if the doc is already gone (Firestore delete is a no-op).
- **Responses:**
  - `200` → `{ success: true, ticker }`
  - `401` → unauth

## Frontend

### `HoldingsTable` (modified — `src/components/HoldingsTable.tsx`)

- New trailing "Actions" column with an empty header.
- Each row gets a `⋯` icon button. Click toggles a small dropdown (`Edit` / `Delete`) anchored to the row's actions cell.
- Dismissal: clicking the same `⋯` button again, clicking anywhere outside the dropdown panel, or pressing `Escape` closes it. Only one row's menu can be open at a time.
- New props: `onEdit?: (item: PortfolioItem) => void`, `onDelete?: (item: PortfolioItem) => void`. Both optional so existing usages don't break. If neither is provided, the Actions column is not rendered.
- HoldingsTable stays presentational. No fetch logic added here.

### `EditHoldingModal` (new — `src/components/EditHoldingModal.tsx`)

- Props: `holding: PortfolioItem`, `onClose: () => void`, `onSuccess: () => void`.
- Layout matches `CsvImportModal`: dark card with title, two number inputs (Shares, Avg Cost) prefilled with current values, Cancel / Save buttons.
- Save is disabled until both fields are finite and `> 0`.
- On Save: `fetch("/api/portfolio/{ticker}", { method: "PATCH", headers: { Authorization, Content-Type: application/json }, body: JSON.stringify({ shares, avgCost }) })`.
- 2xx → `onSuccess()`. Non-2xx or thrown → render the API's `error` message (or a generic fallback) inline below the inputs; modal stays open. The error clears when the user clicks Save again.

### `ConfirmDialog` (new — `src/components/ConfirmDialog.tsx`)

Generic, reusable. Props:

```ts
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;       // default "Confirm"
  destructive?: boolean;       // default false → styles Confirm as red when true
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}
```

Used for delete:

```tsx
<ConfirmDialog
  title="Remove holding?"
  message={`Remove ${deleting.ticker} from your portfolio?`}
  confirmLabel="Delete"
  destructive
  onConfirm={...}
  onCancel={() => setDeleting(null)}
/>
```

## State & data flow

`/analytics` page (parent) owns the modal/dialog state:

```ts
const [editing, setEditing] = useState<PortfolioItem | null>(null);
const [deleting, setDeleting] = useState<PortfolioItem | null>(null);
```

- Pass `onEdit={setEditing}` and `onDelete={setDeleting}` into `HoldingsTable`.
- When `editing` is non-null, render the `EditHoldingModal`. Its `onSuccess` clears `editing` and calls the existing `fetchData()` (already used by the import-success flow on this page) to refetch portfolio + quotes + snapshots.
- When `deleting` is non-null, render the `ConfirmDialog`. Its `onConfirm` runs `DELETE /api/portfolio/{ticker}`, then clears `deleting` and calls `fetchData()` on success.

No need to extract a shared hook — `/analytics` already has `fetchData()` and `/` has its own `fetchPortfolio()` with snapshot-POST semantics that don't belong on analytics.

## Validation & error surfaces

| Layer | Check | Failure surface |
|-------|-------|-----------------|
| Modal client | `shares`, `avgCost` finite and `> 0` | Save button disabled |
| API `PATCH` | same checks | `400` with `{ error }` |
| API `PATCH` | holding exists | `404` with `{ error: "Holding not found" }` |
| API `DELETE` | none | always `200` |
| Modal | non-2xx response or network error | inline red error line, modal stays open for retry |
| Confirm dialog | non-2xx response or network error | inline red error line, dialog stays open for retry |

## Testing

### API — extend `src/__tests__/api/portfolio.test.ts`

- `PATCH` happy path: updates the given fields, returns the updated values.
- `PATCH` rejects `shares ≤ 0` / `NaN` / missing both fields with `400`.
- `PATCH` returns `404` when the holding doc doesn't exist.
- `PATCH` returns `401` without auth.
- `DELETE` happy path removes the doc.
- `DELETE` is idempotent (no error on missing doc).
- `DELETE` returns `401` without auth.

### Components

- `HoldingsTable.test.tsx` — extend with: Actions column renders when `onEdit`/`onDelete` provided, the `⋯` button toggles a menu, clicking Edit/Delete fires the callback with the correct `PortfolioItem`.
- `EditHoldingModal.test.tsx` (new) — prefilled values, Save disabled on invalid input, Save sends the expected PATCH body, success calls `onSuccess`, error from API renders inline.
- `ConfirmDialog.test.tsx` (new) — title/message render, Cancel fires `onCancel`, Confirm fires `onConfirm`, async `onConfirm` keeps the dialog visible until it resolves.

## File changes

| File | Action |
|------|--------|
| `src/app/api/portfolio/[ticker]/route.ts` | NEW — `PATCH` + `DELETE` |
| `src/components/HoldingsTable.tsx` | MODIFY — Actions column + ⋯ menu + new optional props |
| `src/components/EditHoldingModal.tsx` | NEW |
| `src/components/ConfirmDialog.tsx` | NEW |
| `src/app/analytics/page.tsx` | MODIFY — wire up modal & dialog + refetch after mutation |
| `src/__tests__/api/portfolio.test.ts` | EXTEND — PATCH and DELETE tests |
| `src/__tests__/components/HoldingsTable.test.tsx` | EXTEND — Actions column tests |
| `src/__tests__/components/EditHoldingModal.test.tsx` | NEW |
| `src/__tests__/components/ConfirmDialog.test.tsx` | NEW |

## Notes & accepted risks

- **`addedAt` preservation on edit** — `merge: true` ensures `addedAt` is not touched.
- **Today's snapshot is stale until you visit `/`** — today's snapshot doc on Firestore keeps the pre-edit values until the dashboard's next `fetchPortfolio` overwrites it. Acceptable; the analytics page does not write snapshots.
- **Concurrent edits** — two tabs editing the same holding race; Firestore is last-write-wins. Acceptable for a single-user dashboard.
- **Empty portfolio after deletes** — HoldingsTable already shows "No holdings found"; `/analytics` parent already handles `totalValue=0` arithmetic. No new edge cases.
