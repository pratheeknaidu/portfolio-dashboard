"use client";
import Link from "next/link";
import { sortHoldings } from "@/lib/design/sort-holdings";
import { money, signedPct } from "@/lib/design/format";
import type { PortfolioItem } from "@/types";

interface MobileHoldingsListProps {
  items: PortfolioItem[];
  totalValue: number;
  /** dashboard: 6 rows + "Show all"; holdings: all rows + total. */
  variant: "dashboard" | "holdings";
  onSelect: (item: PortfolioItem) => void;
  demo?: boolean;
}

const DASHBOARD_ROWS = 6;

function tone(v: number): string {
  if (v > 0) return "text-rd-gain";
  if (v < 0) return "text-rd-loss";
  return "text-rd-flat";
}

/**
 * Nav-aware because the mobile heat map's "+N smaller positions" strip (plan 4)
 * routes here: a Dashboard slice that stopped at 6 would send the user to a
 * screen that does not contain the position they tapped. On Holdings it shows
 * everything plus a total; on the Dashboard it shows the top 6 and links on.
 */
export function MobileHoldingsList({
  items,
  totalValue,
  variant,
  onSelect,
  demo = false,
}: MobileHoldingsListProps) {
  const sorted = sortHoldings(items, "marketValue", "desc", totalValue);
  const rows = variant === "dashboard" ? sorted.slice(0, DASHBOARD_ROWS) : sorted;
  const showAllHref = demo ? "/demo/holdings" : "/holdings";

  return (
    <div className="flex flex-col">
      {rows.map((item) => (
        <button
          key={item.ticker}
          data-testid="holding-row"
          onClick={() => onSelect(item)}
          className="rd-focusable flex min-h-[44px] items-center justify-between gap-3 border-b border-rd-border-hairline px-1 py-2 text-left"
        >
          <span className="min-w-0">
            <span className="font-mono text-sm font-semibold text-rd-text">{item.ticker}</span>
            <span className="ml-2 truncate text-xs text-rd-muted">{item.companyName}</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-mono text-sm tabular-nums text-rd-text">
              {money(item.marketValue)}
            </span>
            <span className={`block font-mono text-xs tabular-nums ${tone(item.totalPL)}`}>
              {signedPct(item.totalPLPercent)}
            </span>
          </span>
        </button>
      ))}

      {variant === "dashboard" && sorted.length > DASHBOARD_ROWS && (
        <Link
          href={showAllHref}
          className="rd-focusable mt-2 inline-flex min-h-[44px] items-center justify-center text-sm font-medium text-rd-text"
        >
          Show all {sorted.length} holdings →
        </Link>
      )}

      {variant === "holdings" && (
        <div
          data-testid="total-row"
          className="flex items-center justify-between px-1 py-3 text-sm font-semibold text-rd-text"
        >
          <span>Total</span>
          <span className="font-mono tabular-nums">{money(totalValue)}</span>
        </div>
      )}
    </div>
  );
}
