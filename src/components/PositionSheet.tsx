"use client";
import { Sheet } from "@/components/ui/Sheet";
import { money, signedMoney, signedPct } from "@/lib/design/format";
import type { PortfolioItem } from "@/types";

interface PositionSheetProps {
  item: PortfolioItem | null;
  onClose: () => void;
  onEdit: (item: PortfolioItem) => void;
  onRemove: (item: PortfolioItem) => void;
}

function tone(v: number): string {
  if (v > 0) return "text-rd-gain";
  if (v < 0) return "text-rd-loss";
  return "text-rd-flat";
}

/**
 * The single detail-and-actions surface for a position. Opened today from a
 * table row; built surface-agnostic so plan 4 can open it from a tile tap and
 * a mover row unchanged.
 *
 * It renders rd-styled content inside the shared `Sheet` shell rather than
 * restyling `Sheet` itself — `Sheet` is still on the legacy `ChipDetail` path
 * on Analytics, which plan 4 migrates.
 */
export function PositionSheet({ item, onClose, onEdit, onRemove }: PositionSheetProps) {
  if (!item) return null;

  const dayChange = item.quote.change * item.shares;

  return (
    <Sheet open onClose={onClose} labelledBy="position-sheet-title">
      <div className="bg-rd-card p-5">
        <h2 id="position-sheet-title" className="text-base font-semibold text-rd-text">
          {item.companyName}
        </h2>
        <p className="mt-0.5 text-xs text-rd-muted">
          <span className="font-mono">{item.ticker}</span>
          <span className="mx-1.5 opacity-40">·</span>
          {item.sector}
        </p>

        <div className="mt-4 flex items-baseline justify-between">
          <span className="font-mono text-lg tabular-nums text-rd-text">
            {money(item.quote.price)}
          </span>
          <span className={`font-mono text-sm tabular-nums ${tone(dayChange)}`}>
            {signedMoney(dayChange)} ({signedPct(item.quote.changePercent)})
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-y-2 border-t border-rd-border-hairline pt-4 text-sm">
          <dt className="text-rd-muted">Shares</dt>
          <dd className="text-right font-mono tabular-nums text-rd-body">{item.shares}</dd>
          <dt className="text-rd-muted">Market value</dt>
          <dd className="text-right font-mono tabular-nums text-rd-text">
            {money(item.marketValue)}
          </dd>
          <dt className="text-rd-muted">Total P&amp;L</dt>
          <dd className={`text-right font-mono tabular-nums ${tone(item.totalPL)}`}>
            {signedMoney(item.totalPL)} ({signedPct(item.totalPLPercent)})
          </dd>
        </dl>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => onEdit(item)}
            className="rd-focusable inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-rd-border-control bg-rd-control text-sm font-medium text-rd-text hover:border-rd-border-strong"
          >
            Edit
          </button>
          <button
            onClick={() => onRemove(item)}
            className="rd-focusable inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-rd-border-control text-sm font-medium text-rd-loss hover:border-rd-border-strong"
          >
            Remove
          </button>
        </div>
      </div>
    </Sheet>
  );
}
