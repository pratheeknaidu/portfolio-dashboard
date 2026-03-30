import type { PortfolioItem } from "@/types";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtSigned(n: number): string {
  const formatted = fmt(Math.abs(n));
  return n >= 0 ? `+${formatted}` : `-${formatted}`;
}

interface Props {
  items: PortfolioItem[];
}

export function Sidebar({ items }: Props) {
  const totalValue = items.reduce((sum, i) => sum + i.marketValue, 0);
  const todayChange = items.reduce((sum, i) => sum + i.quote.change * i.shares, 0);
  const allTimeReturn = items.reduce((sum, i) => sum + i.totalPL, 0);

  // Top 3 movers by absolute changePercent
  const topMovers = [...items]
    .sort((a, b) => Math.abs(b.quote.changePercent) - Math.abs(a.quote.changePercent))
    .slice(0, 3);

  // Sector allocation
  const sectorMap: Record<string, number> = {};
  for (const item of items) {
    sectorMap[item.sector] = (sectorMap[item.sector] ?? 0) + item.marketValue;
  }
  const sectors = Object.entries(sectorMap).sort((a, b) => b[1] - a[1]);

  const now = new Date();
  const lastUpdated = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto text-sm">
      {/* Total Value */}
      <div className="mb-4">
        <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">Portfolio Value</div>
        <div className="text-white text-2xl font-bold">{fmt(totalValue)}</div>
      </div>

      {/* Today's Change */}
      <div className="mb-2">
        <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">Today&apos;s Change</div>
        <div className={`font-semibold ${todayChange >= 0 ? "text-gain" : "text-loss"}`}>
          {fmtSigned(todayChange)}
        </div>
      </div>

      {/* All-Time Return */}
      <div className="mb-4">
        <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">All-Time Return</div>
        <div className={`font-semibold ${allTimeReturn >= 0 ? "text-gain" : "text-loss"}`}>
          {fmtSigned(allTimeReturn)}
        </div>
      </div>

      {/* Top Movers */}
      <div data-testid="top-movers" className="mb-4">
        <div className="text-gray-400 text-xs uppercase tracking-wide mb-2">Top Movers</div>
        {topMovers.map((item) => (
          <div key={item.ticker} className="flex justify-between items-center py-1">
            <span className="text-white font-medium">{item.ticker}</span>
            <span className={item.quote.changePercent >= 0 ? "text-gain" : "text-loss"}>
              {item.quote.changePercent >= 0 ? "+" : ""}
              {item.quote.changePercent.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      {/* Sector Allocation */}
      <div className="mb-4">
        <div className="text-gray-400 text-xs uppercase tracking-wide mb-2">Sector Allocation</div>
        {sectors.map(([sector, value]) => {
          const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
          return (
            <div key={sector} className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white">{sector}</span>
                <span className="text-gray-400">{pct.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-surface-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Last Updated */}
      <div className="mt-auto text-gray-500 text-xs">Last updated {lastUpdated}</div>
    </div>
  );
}
