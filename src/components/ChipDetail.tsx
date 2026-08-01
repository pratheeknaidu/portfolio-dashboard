"use client";
import type { PortfolioItem, RecommendationKey, ValuationData } from "@/types";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
function fmtWhole(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const REC_LABEL: Record<RecommendationKey, string> = {
  strong_buy: "Strong Buy",
  buy: "Buy",
  hold: "Hold",
  sell: "Sell",
  strong_sell: "Strong Sell",
  underperform: "Underperform",
};

function pct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function ChipDetail({ item, v }: { item: PortfolioItem; v: ValuationData }) {
  const dayChange = item.quote.change * item.shares;
  const hasRange = v.targetLowPrice !== undefined && v.targetHighPrice !== undefined;
  const recLabel = v.recommendationKey ? REC_LABEL[v.recommendationKey] : "—";

  let markerPct = 0;
  if (hasRange) {
    const lo = v.targetLowPrice as number;
    const hi = v.targetHighPrice as number;
    const span = hi - lo;
    markerPct = span <= 0 ? 50 : Math.max(0, Math.min(1, (item.quote.price - lo) / span)) * 100;
  }

  return (
    <div className="text-sm">
      <div className="text-base font-semibold text-rd-text">
        {item.companyName}
      </div>
      <div className="text-xs text-rd-muted mb-3 mt-0.5">
        <span className="font-mono">{item.ticker}</span>
        <span className="mx-1.5 opacity-40">·</span>
        {item.sector}
      </div>

      {/* Price */}
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-mono text-rd-text">{fmt(item.quote.price)}</span>
        <span className={`font-mono text-xs ${dayChange >= 0 ? "text-rd-gain" : "text-rd-loss"}`}>
          {fmt(dayChange)} ({item.quote.changePercent.toFixed(2)}%)
        </span>
      </div>

      {/* Analyst sentiment */}
      <div className="text-xs text-rd-muted uppercase tracking-wide mb-1">Analyst Rating</div>
      <div className="flex items-baseline justify-between mb-3 text-xs">
        <span className="text-rd-text font-medium">{recLabel}</span>
        <span className="font-mono text-rd-muted">
          {v.recommendationMean !== undefined ? v.recommendationMean.toFixed(1) : "—"}
          {v.numberOfAnalystOpinions ? ` · ${v.numberOfAnalystOpinions} analysts` : ""}
        </span>
      </div>

      {/* Price target range */}
      <div className="text-xs text-rd-muted uppercase tracking-wide mb-1">Price Target</div>
      {hasRange ? (
        <div className="mb-3">
          <div data-testid="target-range-bar" className="relative h-1.5 rounded-full bg-rd-inset my-2">
            <div
              data-testid="current-marker"
              className="absolute -top-1 w-1 h-3.5 rounded bg-rd-text"
              style={{ left: `${markerPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-rd-muted">
            <span>{fmtWhole(v.targetLowPrice as number)}</span>
            {v.targetMeanPrice !== undefined && (
              <span className="text-rd-text">avg {fmtWhole(v.targetMeanPrice)}</span>
            )}
            <span>{fmtWhole(v.targetHighPrice as number)}</span>
          </div>
          {v.upsideToTargetPct !== undefined && (
            <div className={`text-[11px] mt-1 text-right font-mono ${v.upsideToTargetPct >= 0 ? "text-rd-gain" : "text-rd-loss"}`}>
              {pct(v.upsideToTargetPct)} to avg
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-rd-muted mb-3">No price targets</div>
      )}

      {/* Fair value */}
      {v.fairValueDescription && (
        <div className="flex items-baseline justify-between mb-3 text-xs">
          <span className="text-rd-muted">Fair Value</span>
          <span className="text-rd-text">
            {v.fairValueDescription}
            {v.fairValueDiscountPct !== undefined ? ` (${pct(v.fairValueDiscountPct)})` : ""}
          </span>
        </div>
      )}

      {/* Your position */}
      <div className="text-xs text-rd-muted uppercase tracking-wide mb-1 mt-3">Your Position</div>
      <div className="grid grid-cols-2 gap-y-1.5 text-xs">
        <span className="text-rd-muted">Shares</span>
        <span className="text-right font-mono text-rd-text">{item.shares}</span>
        <span className="text-rd-muted">Market Value</span>
        <span className="text-right font-mono text-rd-text">{fmt(item.marketValue)}</span>
        <span className="text-rd-muted">Total P&L</span>
        <span className={`text-right font-mono ${item.totalPL >= 0 ? "text-rd-gain" : "text-rd-loss"}`}>
          {fmt(item.totalPL)} ({item.totalPLPercent.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}
