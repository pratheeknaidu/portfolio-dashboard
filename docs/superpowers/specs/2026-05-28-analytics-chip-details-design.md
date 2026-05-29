# Analytics Chip Detail Panels — Design Spec

**Date:** 2026-05-28
**Status:** Approved, ready for implementation

## Goal

Make the ticker chips in the Analyst Sentiment and Valuation cards on `/analytics`
open a rich detail panel — the same click-to-pin tooltip (desktop) / bottom sheet
(mobile) interaction the treemap tiles already use. Today each chip only carries a
native HTML `title` tooltip, which is desktop-hover-only, unstyled, and invisible on
touch devices.

The panel surfaces the data behind the chip's grouping plus a Yahoo-style **analyst
price target range** (low → average → high, with the current price marked), so a tap
answers "why is this in this bucket, and where does the market think it's going?"

## Out of scope

- Hover-to-preview (we match the treemap's deliberate click/tap-to-pin model).
- Per-holding click-through to a dedicated detail page.
- New charts beyond the single price-target range bar.
- Editing holdings from the panel (Edit/Delete stays on the Holdings table).
- Refactoring `page.tsx`'s treemap selection wiring (left as-is; only the shared
  shell is extracted from `TreemapTooltip`).

## Approach summary

Approach **A**: extract the reusable shell out of `TreemapTooltip` so tiles and chips
share one positioning + desktop/mobile implementation.

| Decision | Chosen | Alternatives rejected |
|----------|--------|-----------------------|
| Sharing strategy | Extract generic `DetailPanel` shell from `TreemapTooltip`; `TreemapTooltip` becomes a thin wrapper | Pass body as prop to `TreemapTooltip` (conflates tile/chip semantics); self-contained copy in chips (duplicates positioning, drifts) |
| Interaction | Click/tap-to-pin; Escape or outside-click dismiss; re-click toggles off | Hover preview (not touch-friendly); modal dialog |
| Selection state | Shared `useDetailSelection()` hook, used by both cards | Duplicate state + listeners in each card; lift to page |
| FV "range" meaning | Analyst price target range (`targetLowPrice` → mean → `targetHighPrice`) | Trading Central fair value (single point + label, no band) |
| Chip element | `<button>` (keyboard accessible) replacing the `<span>` + `title` | Keep `<span>`, add `title` only |

## Architecture

### New: `DetailPanel` shell — `src/components/ui/DetailPanel.tsx`

Extracted from `TreemapTooltip`. Owns the positioning math and the desktop/mobile
switch; renders nothing about content.

```tsx
interface DetailPanelProps {
  rect: TileRect | null;   // anchor rect from getBoundingClientRect()
  onClose: () => void;
  children: ReactNode;
}
```

- Desktop: `fixed`, `pointer-events-none` card positioned near `rect` (the existing
  `position()` logic moves here verbatim).
- Mobile (`useIsMobile()`): renders children inside `Sheet` (portaled to body).
- `TileRect` type moves to `DetailPanel.tsx`; `TreemapTooltip` re-imports it so
  existing imports (`page.tsx`, `Treemap.tsx`) keep working via a re-export.

`TreemapTooltip` becomes:

```tsx
export function TreemapTooltip({ item, tileRect, onClose }) {
  if (!item) return null;
  return <DetailPanel rect={tileRect} onClose={onClose ?? (() => {})}>
    <TileBody item={item} />
  </DetailPanel>;
}
```

### New: `useDetailSelection()` hook — `src/lib/use-detail-selection.ts`

Generalizes the pin/dismiss pattern currently inline in `page.tsx`.

```ts
function useDetailSelection<T>(): {
  selected: T | null;
  rect: TileRect | null;
  select: (item: T, rect: TileRect) => void;  // re-selecting same item toggles off
  dismiss: () => void;
};
```

- Tracks `selected` + `rect`.
- Installs Escape + deferred outside-click listeners only while something is selected
  (same one-tick `setTimeout` deferral as `page.tsx` so the selecting click doesn't
  immediately dismiss).
- Identity for toggle-off is by reference; callers pass the same object.

### New: `ChipDetail` body — `src/components/ChipDetail.tsx`

```tsx
interface ChipDetailProps { item: PortfolioItem; v: ValuationData; }
```

Sections (missing fields render `—`):

1. **Header** — `companyName`; sub-line `ticker · sector`.
2. **Price** — current price + day change (`quote.change * shares` value and
   `changePercent`), green/red.
3. **Analyst sentiment** — recommendation label (Strong Buy … Strong Sell, derived
   from `recommendationKey`), `recommendationMean` (e.g. `2.1`), `numberOfAnalystOpinions`.
4. **Price target range bar** — horizontal track from `targetLowPrice` to
   `targetHighPrice`; a marker for the current price and a marker/label for
   `targetMeanPrice`; `+upside%` (`upsideToTargetPct`) shown alongside. Rendered only
   when low/high are present; otherwise a "No price targets" line.
5. **Fair value** — `fairValueDescription` + `fairValueDiscountPct` + `fairValueProvider`,
   when present.
6. **Your position** — `shares`, `marketValue`, `totalPL` (with %), green/red — ties
   the chip back to the portfolio like the treemap body does.

Range-bar math: clamp current price into `[low, high]` for the marker position
(`(price - low) / (high - low)`, clamped to `[0,1]`); guard `high === low`.

### Wiring in the cards

`AnalystSentimentCard.tsx` and `ValuationCard.tsx`:

- Call `const { selected, rect, select, dismiss } = useDetailSelection<PortfolioItem>()`.
- Each chip becomes a `<button type="button">` (keeps `data-testid={`chip-${ticker}`}`,
  drops the `title` attribute). `onClick` calls `select(item, e.currentTarget.getBoundingClientRect())`
  with `stopPropagation` so the outside-click listener doesn't fire on the same click.
- After the buckets, render once:
  `{selected && <DetailPanel rect={rect} onClose={dismiss}><ChipDetail item={selected} v={valuations[selected.ticker]} /></DetailPanel>}`.
- The Valuation chip keeps its inline `subtext` (FV/Tgt %) on the chip face; the panel
  is additive.

## Data layer

Add two optional fields to `ValuationData` (`src/types/index.ts`):

```ts
targetLowPrice?: number;
targetHighPrice?: number;
```

Populate them in `src/lib/yahoo-finance-valuations.ts` `fetchOne()` from the same
`financialData` module already fetched (`fd.targetLowPrice`, `fd.targetHighPrice`),
guarded by `typeof === "number"`, setting `touched = true`. Add deterministic values
to `src/lib/yahoo-finance-valuations-mock.ts` so sandbox renders the range bar
(low/high bracketing the existing mock `targetMeanPrice`).

No API route or Firestore changes — valuations are computed and returned live.

## Testing

- `ChipDetail`: range-bar position math (current inside/at-edges of range), missing
  low/high → "No price targets", missing sentiment/FV → `—`, P&L sign coloring.
- `useDetailSelection`: select sets state; re-select same item toggles off; `dismiss`
  clears; Escape and outside-click dismiss; selecting click doesn't self-dismiss.
- Update `AnalystSentimentCard` / `ValuationCard` tests: chips are now `<button>`s
  that open the panel on click (assert panel content appears), and the `title`
  assertions are removed.
- `getValuations` test: assert `targetLowPrice` / `targetHighPrice` pass through.

## Files

**New**
- `src/components/ui/DetailPanel.tsx`
- `src/components/ChipDetail.tsx`
- `src/lib/use-detail-selection.ts`

**Modified**
- `src/components/TreemapTooltip.tsx` (use `DetailPanel`; re-export `TileRect`)
- `src/components/AnalystSentimentCard.tsx` (chip → button, wire panel)
- `src/components/ValuationCard.tsx` (chip → button, wire panel)
- `src/types/index.ts` (`targetLowPrice` / `targetHighPrice`)
- `src/lib/yahoo-finance-valuations.ts` (fetch new fields)
- `src/lib/yahoo-finance-valuations-mock.ts` (mock new fields)
