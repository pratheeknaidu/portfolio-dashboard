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
