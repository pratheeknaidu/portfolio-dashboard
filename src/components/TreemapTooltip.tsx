"use client";
import { useIsMobile } from "@/lib/use-is-mobile";
import { Sheet } from "@/components/ui/Sheet";
import { tooltipPosition, type Rect } from "@/lib/design/tooltip-position";
import { money, signedMoney, signedPct } from "@/lib/design/format";
import type { PortfolioItem } from "@/types";

export type TileRect = Rect;

interface Props {
  item: PortfolioItem | null;
  tileRect: TileRect | null;
  /** Bounding box of the map body, in the same coordinate space as tileRect. */
  cardRect: TileRect | null;
  weightPct: number;
  onClose?: () => void;
}

function TileBody({ item, weightPct }: { item: PortfolioItem; weightPct: number }) {
  const dayDollar = item.quote.change * item.shares;
  const plClass = (v: number) => (v >= 0 ? "text-rd-gain" : "text-rd-loss");

  return (
    <>
      <div className="text-sm font-bold text-rd-text">{item.companyName}</div>
      <div className="font-mono text-[11px] text-rd-label mt-0.5 mb-3">
        {item.ticker} · {item.sector}
      </div>
      <div className="grid grid-cols-2 gap-y-1.5 text-xs tabular-nums">
        <span className="text-rd-label">Market value</span>
        <span className="text-right font-mono text-rd-text">{money(item.marketValue)}</span>

        <span className="text-rd-label">Today</span>
        <span className={`text-right font-mono ${plClass(dayDollar)}`}>
          {signedMoney(dayDollar)} ({signedPct(item.quote.changePercent)})
        </span>

        <span className="text-rd-label">Total P&L</span>
        <span className={`text-right font-mono ${plClass(item.totalPL)}`}>
          {signedMoney(item.totalPL)} ({signedPct(item.totalPLPercent)})
        </span>

        <span className="text-rd-label">Shares</span>
        <span className="text-right font-mono text-rd-body">
          {item.shares} @ {money(item.avgCost)}
        </span>

        <span className="text-rd-label">Weight</span>
        <span className="text-right font-mono text-rd-body">{weightPct.toFixed(2)}%</span>
      </div>
    </>
  );
}

export function TreemapTooltip({ item, tileRect, cardRect, weightPct, onClose }: Props) {
  const isMobile = useIsMobile();
  if (!item) return null;

  const body = <TileBody item={item} weightPct={weightPct} />;

  if (isMobile) {
    return (
      <Sheet open onClose={onClose ?? (() => {})}>
        <div className="p-5">{body}</div>
      </Sheet>
    );
  }

  if (!tileRect || !cardRect) return null;
  const { placement, centerPct, anchorPct } = tooltipPosition(tileRect, cardRect);

  return (
    <div
      data-testid="treemap-tooltip"
      data-placement={placement}
      className="absolute z-40 w-[250px] rounded-[11px] p-3.5 pointer-events-none"
      style={{
        left: `${centerPct}%`,
        top: `${anchorPct}%`,
        transform: `translate(-50%, ${placement === "below" ? "8px" : "calc(-100% - 8px)"})`,
        background: "#141a21",
        border: "1px solid var(--rd-border-stronger)",
        boxShadow: "0 14px 34px #00000099",
      }}
    >
      {body}
    </div>
  );
}
