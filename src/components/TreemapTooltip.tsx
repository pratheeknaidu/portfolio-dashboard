"use client";
import { DetailPanel, type TileRect } from "@/components/ui/DetailPanel";
import type { PortfolioItem } from "@/types";

export type { TileRect };

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
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
  if (!item) return null;
  return (
    <DetailPanel rect={tileRect} onClose={onClose ?? (() => {})}>
      <TileBody item={item} />
    </DetailPanel>
  );
}
