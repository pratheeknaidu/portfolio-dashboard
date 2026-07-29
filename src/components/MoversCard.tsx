import { topMovers } from "@/lib/design/movers";
import { signedMoney, signedPct } from "@/lib/design/format";
import type { PortfolioItem } from "@/types";

interface MoversCardProps {
  items: PortfolioItem[];
  limit?: number;
}

function glyph(v: number): string {
  return v > 0 ? "▲" : "▼";
}

/**
 * "What moved the number" — the companion to the day change in SummaryCard.
 *
 * Rows are ranked by dollar contribution, which is the only ranking that can
 * explain the headline. The previous percent ranking put a $200 position that
 * moved 9% above a $40,000 position that moved 1.2%, directly contradicting
 * the figure it sat beside.
 */
export function MoversCard({ items, limit = 5 }: MoversCardProps) {
  const movers = topMovers(items, limit);

  return (
    <section
      aria-label="What moved the number"
      className="flex h-full flex-col rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6"
    >
      <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
        What moved the number
      </h2>

      {movers.length === 0 ? (
        <p className="mt-4 text-sm text-rd-muted">Nothing moved today.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {movers.map(({ item, contribution }) => (
            <li
              key={item.ticker}
              data-testid="mover-row"
              className="flex items-baseline justify-between gap-3"
            >
              <span className="min-w-0">
                <span className="font-mono text-sm font-semibold text-rd-text">{item.ticker}</span>
                <span className="ml-2 truncate text-xs text-rd-muted">{item.companyName}</span>
              </span>
              <span
                className={`shrink-0 font-mono text-sm tabular-nums ${
                  contribution >= 0 ? "text-rd-gain" : "text-rd-loss"
                }`}
              >
                <span aria-hidden="true">{glyph(contribution)}</span> {signedMoney(contribution)}
                <span className="ml-2 text-rd-muted">{signedPct(item.quote.changePercent)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
