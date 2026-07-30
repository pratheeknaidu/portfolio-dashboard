"use client";
import { useState } from "react";
import {
  HOLDING_COLUMNS,
  sortHoldings,
  type SortDir,
  type SortKey,
} from "@/lib/design/sort-holdings";
import { money, signedMoney, signedPct } from "@/lib/design/format";
import type { PortfolioItem } from "@/types";

interface PositionsTableProps {
  items: PortfolioItem[];
  totalValue: number;
  onSelect: (item: PortfolioItem) => void;
}

// Ticker | Company (1fr, truncates) | Sector | Shares | Avg | Price | Day | Value | P&L | %
const GRID = "grid-cols-[72px_minmax(0,1fr)_120px_72px_88px_88px_72px_104px_120px_72px]";

function glyph(v: number): string {
  if (v > 0) return "▲";
  if (v < 0) return "▼";
  return "◆";
}

function tone(v: number): string {
  if (v > 0) return "text-rd-gain";
  if (v < 0) return "text-rd-loss";
  return "text-rd-flat";
}

export function PositionsTable({ items, totalValue, onSelect }: PositionsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("marketValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  if (items.length === 0) {
    return <p className="p-6 text-sm text-rd-muted">No holdings to show.</p>;
  }

  const sorted = sortHoldings(items, sortKey, sortDir, totalValue);

  const onHeader = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      // A freshly clicked column opens descending: on a holdings table the
      // thing you want first is the largest position, gain or loss, not the
      // smallest. A second click flips to ascending.
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="overflow-x-auto">
      <div role="table" className="min-w-[900px]">
        <div role="row" className={`grid ${GRID} gap-2 border-b border-rd-border px-4 py-2`}>
          {HOLDING_COLUMNS.map((col) => {
            const active = col.key === sortKey;
            return (
              <div
                key={col.key}
                role="columnheader"
                aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                className={col.numeric ? "text-right" : "text-left"}
              >
                <button
                  type="button"
                  onClick={() => onHeader(col.key)}
                  className="rd-focusable font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label hover:text-rd-text"
                >
                  {col.label}
                  {active && <span aria-hidden="true">{sortDir === "asc" ? " ↑" : " ↓"}</span>}
                </button>
              </div>
            );
          })}
        </div>

        {sorted.map((item) => {
          const pct = totalValue > 0 ? (item.marketValue / totalValue) * 100 : 0;
          const dayPct = item.quote.changePercent;
          return (
            <div
              key={item.ticker}
              role="row"
              aria-label={item.ticker}
              tabIndex={0}
              onClick={() => onSelect(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(item);
                }
              }}
              className={`grid ${GRID} cursor-pointer items-center gap-2 border-b border-rd-border-hairline px-4 py-2.5 text-sm hover:bg-rd-row-hover rd-focusable`}
            >
              <div data-testid="cell-ticker" className="font-mono font-semibold text-rd-text">
                {item.ticker}
              </div>
              <div className="truncate text-rd-body">{item.companyName}</div>
              <div className="truncate text-rd-muted">{item.sector}</div>
              <div className="text-right font-mono tabular-nums text-rd-body">{item.shares}</div>
              <div className="text-right font-mono tabular-nums text-rd-body">{money(item.avgCost)}</div>
              <div className="text-right font-mono tabular-nums text-rd-body">{money(item.quote.price)}</div>
              <div className={`text-right font-mono tabular-nums ${tone(dayPct)}`}>
                <span aria-hidden="true">{glyph(dayPct)}</span> {signedPct(dayPct)}
              </div>
              <div className="text-right font-mono tabular-nums text-rd-text">{money(item.marketValue)}</div>
              <div
                data-testid="cell-totalPL"
                className={`text-right font-mono tabular-nums ${tone(item.totalPL)}`}
              >
                <span aria-hidden="true">{glyph(item.totalPL)}</span> {signedMoney(item.totalPL)}
              </div>
              <div className="text-right font-mono tabular-nums text-rd-muted">{pct.toFixed(1)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
