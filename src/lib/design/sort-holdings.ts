import type { PortfolioItem } from "@/types";

export type SortKey =
  | "ticker"
  | "companyName"
  | "sector"
  | "shares"
  | "avgCost"
  | "price"
  | "dayChangePercent"
  | "marketValue"
  | "totalPL"
  | "portfolioPercent";

export type SortDir = "asc" | "desc";

export interface HoldingColumn {
  key: SortKey;
  label: string;
  /** Right-aligned, tabular-figures, sorted numerically. */
  numeric: boolean;
}

/**
 * One row of column metadata drives both the header and the grid template, so
 * the two can never drift out of alignment. Order here is column order on
 * screen.
 */
export const HOLDING_COLUMNS: HoldingColumn[] = [
  { key: "ticker", label: "Ticker", numeric: false },
  { key: "companyName", label: "Company", numeric: false },
  { key: "sector", label: "Sector", numeric: false },
  { key: "shares", label: "Shares", numeric: true },
  { key: "avgCost", label: "Avg cost", numeric: true },
  { key: "price", label: "Price", numeric: true },
  { key: "dayChangePercent", label: "Day", numeric: true },
  { key: "marketValue", label: "Value", numeric: true },
  { key: "totalPL", label: "Total P&L", numeric: true },
  { key: "portfolioPercent", label: "% Port.", numeric: true },
];

function value(item: PortfolioItem, key: SortKey, totalValue: number): number | string {
  switch (key) {
    case "ticker":
      return item.ticker;
    case "companyName":
      return item.companyName;
    case "sector":
      return item.sector;
    case "shares":
      return item.shares;
    case "avgCost":
      return item.avgCost;
    case "price":
      return item.quote.price;
    case "dayChangePercent":
      return item.quote.changePercent;
    case "marketValue":
      return item.marketValue;
    case "totalPL":
      return item.totalPL;
    case "portfolioPercent":
      return totalValue > 0 ? (item.marketValue / totalValue) * 100 : 0;
  }
}

/**
 * Sort a copy of `items` by one column.
 *
 * Non-finite numbers always sink to the bottom rather than sorting to an end,
 * so one bad quote never steals the top row the eye lands on first. The
 * comparator is applied to a copy, and JS sort is stable (ES2019+), so equal
 * rows keep their prior order — important because the table re-sorts on every
 * header click and a shuffling tie is disorienting.
 */
export function sortHoldings(
  items: PortfolioItem[],
  key: SortKey,
  dir: SortDir,
  totalValue: number,
): PortfolioItem[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...items].sort((x, y) => {
    const a = value(x, key, totalValue);
    const b = value(y, key, totalValue);
    if (typeof a === "string" || typeof b === "string") {
      return sign * String(a).localeCompare(String(b), "en", { sensitivity: "base" });
    }
    const aBad = !Number.isFinite(a);
    const bBad = !Number.isFinite(b);
    if (aBad || bBad) return aBad === bBad ? 0 : aBad ? 1 : -1; // bad always last
    return sign * (a - b);
  });
}
