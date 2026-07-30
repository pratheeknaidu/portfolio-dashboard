"use client";

interface EmptyPortfolioProps {
  onImportClick: () => void;
  onAddClick: () => void;
}

/** Fixed tile geometry for the ghost map — shape only, no data implied. */
const GHOST_TILES = [
  { w: "38%", h: "58%" },
  { w: "24%", h: "58%" },
  { w: "38%", h: "42%" },
  { w: "22%", h: "42%" },
  { w: "16%", h: "42%" },
];

/**
 * Empty state.
 *
 * Two real buttons: the shipped secondary was unstyled grey text with no
 * affordance, so people did not know it was clickable. The ghost map at 0.55
 * opacity shows the shape of what import produces — an empty state that only
 * says "nothing here" gives no reason to act.
 */
export function EmptyPortfolio({ onImportClick, onAddClick }: EmptyPortfolioProps) {
  return (
    <section className="rounded-xl border border-dashed border-rd-border-strong bg-rd-card p-8 text-center">
      <h2 className="text-lg font-semibold text-rd-text">No holdings yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-rd-muted">
        Import your Robinhood positions and this becomes a heat map of everything you own.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onImportClick}
          className="rd-focusable inline-flex min-h-[44px] items-center rounded-lg border border-rd-border-strong bg-rd-control px-5 text-sm font-medium text-rd-text hover:border-rd-border-stronger"
        >
          Import holdings
        </button>
        <button
          onClick={onAddClick}
          className="rd-focusable inline-flex min-h-[44px] items-center rounded-lg border border-rd-border-control px-5 text-sm font-medium text-rd-muted hover:text-rd-text"
        >
          Add a stock manually
        </button>
      </div>

      <div
        data-testid="ghost-map"
        aria-hidden="true"
        className="mt-8 flex h-40 w-full flex-wrap gap-1.5 overflow-hidden rounded-lg opacity-[0.55]"
      >
        {GHOST_TILES.map((t, i) => (
          <span
            key={i}
            style={{ width: t.w, height: t.h }}
            className="rounded bg-rd-flat-aggregate"
          />
        ))}
      </div>
    </section>
  );
}
