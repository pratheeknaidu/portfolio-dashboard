"use client";
import { useIsMobile } from "@/lib/use-is-mobile";
import { Sheet } from "@/components/ui/Sheet";
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
  /** Called when the mobile sheet overlay is tapped or Escape pressed. Desktop tooltip ignores. */
  onClose?: () => void;
}

function TileBody({ item }: { item: PortfolioItem }) {
  const dayChange = item.quote.change * item.shares;
  return (
    <>
      <div className="font-display text-base font-semibold text-foreground">
        {item.companyName}
      </div>
      <div className="text-xs text-muted-foreground mb-3 mt-0.5">
        <span className="font-mono">{item.ticker}</span>
        <span className="mx-1.5 opacity-40">·</span>
        {item.sector}
      </div>
      <div className="grid grid-cols-2 gap-y-1.5 text-xs">
        <span className="text-muted-foreground">Shares</span>
        <span className="text-right font-mono text-foreground">{item.shares}</span>
        <span className="text-muted-foreground">Avg Cost</span>
        <span className="text-right font-mono text-foreground">{fmt(item.avgCost)}</span>
        <span className="text-muted-foreground">Price</span>
        <span className="text-right font-mono text-foreground">{fmt(item.quote.price)}</span>
        <span className="text-muted-foreground">Market Value</span>
        <span className="text-right font-mono text-foreground">{fmt(item.marketValue)}</span>
        <span className="text-muted-foreground">Total P&L</span>
        <span className={`text-right font-mono ${item.totalPL >= 0 ? "text-positive" : "text-negative"}`}>
          {fmt(item.totalPL)} ({item.totalPLPercent.toFixed(1)}%)
        </span>
        <span className="text-muted-foreground">Day Change</span>
        <span className={`text-right font-mono ${dayChange >= 0 ? "text-positive" : "text-negative"}`}>
          {fmt(dayChange)} ({item.quote.changePercent.toFixed(2)}%)
        </span>
      </div>
    </>
  );
}

export function TreemapTooltip({ item, tileRect, onClose }: Props) {
  const isMobile = useIsMobile();
  if (!item) return null;

  if (isMobile) {
    return (
      <Sheet open onClose={onClose ?? (() => {})}>
        <div className="p-5">
          <TileBody item={item} />
        </div>
      </Sheet>
    );
  }

  const { top, left } = position(tileRect);
  return (
    <div
      className="bento-card fixed z-50 p-5 text-sm pointer-events-none transition-[top,left] duration-100 ease-out"
      style={{ top, left, width: TOOLTIP_W }}
    >
      <TileBody item={item} />
    </div>
  );
}
