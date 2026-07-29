import { money, signedMoney, signedPct } from "@/lib/design/format";
import { Sparkline } from "@/components/Sparkline";
import type { PortfolioTotals } from "@/lib/design/portfolio-totals";
import type { Snapshot } from "@/types";

interface SummaryCardProps {
  totals: PortfolioTotals;
  snapshots: Snapshot[];
}

function glyph(v: number): string {
  if (v > 0) return "▲";
  if (v < 0) return "▼";
  return "◆";
}

function toneClass(v: number): string {
  if (v > 0) return "text-rd-gain";
  if (v < 0) return "text-rd-loss";
  return "text-rd-flat";
}

/**
 * The hero. Portfolio value at 40px and today's change at 27px are the two
 * largest elements on the page — the review's headline finding was that
 * today's change, the number people open the app for, was smaller than three
 * separate pieces of chrome.
 *
 * Direction is carried by a glyph as well as a colour, so the card survives
 * greyscale and colour vision deficiency.
 */
export function SummaryCard({ totals, snapshots }: SummaryCardProps) {
  const { totalValue, dayChange, dayChangePercent, costBasis, totalPL, totalPLPercent } = totals;

  return (
    <section
      aria-label="Portfolio summary"
      className="rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
        Portfolio value
      </p>

      <p className="mt-1 font-mono text-[40px] font-bold leading-none tabular-nums text-rd-text">
        {money(totalValue)}
      </p>

      <p
        data-testid="day-change"
        className={`mt-3 font-mono text-[27px] font-semibold leading-none tabular-nums ${toneClass(dayChange)}`}
      >
        <span aria-hidden="true">{glyph(dayChange)}</span> {signedMoney(dayChange)}{" "}
        <span className="text-[18px]">({signedPct(dayChangePercent)})</span>
        <span className="ml-2 font-sans text-[13px] font-normal text-rd-muted">today</span>
      </p>

      <div className="mt-5">
        <Sparkline values={snapshots.map((s) => s.totalValue)} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-rd-border-hairline pt-4">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
            Cost basis
          </dt>
          <dd
            data-testid="cost-basis"
            className="mt-1 font-mono text-[15px] tabular-nums text-rd-body"
          >
            {money(costBasis)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
            Unrealized P&amp;L
          </dt>
          <dd className={`mt-1 font-mono text-[15px] tabular-nums ${toneClass(totalPL)}`}>
            {signedMoney(totalPL)}{" "}
            <span className="text-rd-muted">({signedPct(totalPLPercent)})</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
