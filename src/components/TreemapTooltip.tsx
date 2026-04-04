import type { PortfolioItem } from "@/types";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

interface Props {
  item: PortfolioItem | null;
  x: number;
  y: number;
}

export function TreemapTooltip({ item, x, y }: Props) {
  if (!item) return null;

  const dayChange = item.quote.change * item.shares;

  return (
    <div
      className="fixed z-50 bg-surface-card border border-surface-border rounded-lg p-4 shadow-xl text-sm w-64 pointer-events-none"
      style={{ left: x + 16, top: y + 16 }}
    >
      <div className="font-bold text-white text-base">{item.companyName}</div>
      <div className="text-gray-400 mb-2">{item.ticker} &middot; {item.sector}</div>
      <div className="grid grid-cols-2 gap-y-1">
        <span className="text-gray-400">Shares</span>
        <span className="text-right">{item.shares} shares</span>
        <span className="text-gray-400">Avg Cost</span>
        <span className="text-right">{fmt(item.avgCost)}</span>
        <span className="text-gray-400">Price</span>
        <span className="text-right">{fmt(item.quote.price)}</span>
        <span className="text-gray-400">Market Value</span>
        <span className="text-right">{fmt(item.marketValue)}</span>
        <span className="text-gray-400">Total P&L</span>
        <span className={`text-right ${item.totalPL >= 0 ? "text-gain" : "text-loss"}`}>
          {fmt(item.totalPL)} ({item.totalPLPercent.toFixed(1)}%)
        </span>
        <span className="text-gray-400">Day Change</span>
        <span className={`text-right ${dayChange >= 0 ? "text-gain" : "text-loss"}`}>
          {fmt(dayChange)} ({item.quote.changePercent.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}
