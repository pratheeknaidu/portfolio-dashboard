import { sectorAllocation } from "@/lib/design/allocation";
import { money } from "@/lib/design/format";
import type { PortfolioItem } from "@/types";

interface AllocationStripProps {
  items: PortfolioItem[];
}

/**
 * Sector allocation as a direct-labelled bar.
 *
 * The donut this replaces required a legend, the legend required its own
 * colours, and those colours sat beside P&L greens and reds carrying unrelated
 * meaning. A labelled bar needs no legend, so the collision disappears with it.
 */
export function AllocationStrip({ items }: AllocationStripProps) {
  const slices = sectorAllocation(items);

  if (slices.length === 0) {
    return (
      <section
        aria-label="Allocation"
        className="rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6"
      >
        <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
          Allocation
        </h2>
        <p className="mt-4 text-sm text-rd-muted">No positions to allocate.</p>
      </section>
    );
  }

  return (
    <section
      aria-label="Allocation"
      className="rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6"
    >
      <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
        Allocation
      </h2>

      <div
        data-testid="allocation-bar"
        aria-hidden="true"
        className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-rd-inset"
      >
        {slices.map((s) => (
          <span
            key={s.sector}
            data-testid={`segment-${s.sector}`}
            style={{ width: `${s.pct}%`, backgroundColor: s.color }}
          />
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {slices.map((s) => (
          <li key={s.sector} className="flex items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate text-sm text-rd-body">{s.sector}</span>
            </span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-rd-muted">
              <span className="text-rd-text">{s.pct.toFixed(1)}%</span> {money(s.value)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
