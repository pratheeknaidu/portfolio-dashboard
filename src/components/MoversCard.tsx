import type { PortfolioItem } from "@/types";

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtCurrencySigned(n: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
  return n >= 0 ? `+${formatted}` : `−${formatted}`;
}

interface Props {
  items: PortfolioItem[];
  limit?: number;
}

export function MoversCard({ items, limit = 5 }: Props) {
  const movers = [...items]
    .sort(
      (a, b) =>
        Math.abs(b.quote.changePercent) - Math.abs(a.quote.changePercent),
    )
    .slice(0, limit);

  return (
    <div className="bento-card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Today&apos;s Movers
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
          By abs % change
        </span>
      </div>

      {movers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          No movers yet
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {movers.map((item) => {
            const positive = item.quote.changePercent >= 0;
            const dollarChange = item.quote.change * item.shares;
            return (
              <li
                key={item.ticker}
                className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-surface-elevated/40 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-surface-elevated flex items-center justify-center font-mono text-xs font-semibold text-foreground border border-border/30">
                  {item.ticker.slice(0, 4)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-medium text-foreground truncate">
                    {item.ticker}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.companyName || item.sector || "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-mono text-sm font-semibold ${positive ? "text-positive" : "text-negative"}`}
                  >
                    {fmtPct(item.quote.changePercent)}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {fmtCurrencySigned(dollarChange)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
