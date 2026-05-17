import type { PortfolioItem } from "@/types";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export interface TileRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_W = 256;
const TOOLTIP_H = 220;
const GAP = 8;

function position(rect: TileRect | null) {
  if (!rect) return { top: 0, left: 0 };
  const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080;

  let top = rect.top - TOOLTIP_H - GAP;
  if (top < GAP) top = rect.top + rect.height + GAP;
  if (top + TOOLTIP_H > vh - GAP) top = Math.max(GAP, vh - TOOLTIP_H - GAP);

  let left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
  left = Math.max(GAP, Math.min(left, vw - TOOLTIP_W - GAP));

  return { top, left };
}

interface Props {
  item: PortfolioItem | null;
  tileRect: TileRect | null;
}

export function TreemapTooltip({ item, tileRect }: Props) {
  if (!item) return null;
  const { top, left } = position(tileRect);
  const dayChange = item.quote.change * item.shares;

  return (
    <div
      className="fixed z-50 bg-surface-card border border-surface-border rounded-lg p-4 shadow-xl text-sm pointer-events-none transition-[top,left] duration-100 ease-out"
      style={{ top, left, width: TOOLTIP_W }}
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
