"use client";
import { useState } from "react";
import type { PortfolioItem } from "@/types";

function fmt(value: number): string {
  return `$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

type SortKey =
  | "ticker"
  | "companyName"
  | "shares"
  | "avgCost"
  | "price"
  | "marketValue"
  | "dayChange"
  | "totalPL"
  | "portfolioPercent";

interface HoldingsTableProps {
  items: PortfolioItem[];
  totalValue: number;
}

export function HoldingsTable({ items, totalValue }: HoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [searchTerm, setSearchTerm] = useState("");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }


  const filtered = items.filter((item) => {
    const q = searchTerm.toLowerCase();
    return (
      item.ticker.toLowerCase().includes(q) ||
      item.companyName.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === null) return 0;

    let aVal: number | string;
    let bVal: number | string;

    switch (sortKey) {
      case "ticker": aVal = a.ticker; bVal = b.ticker; break;
      case "companyName": aVal = a.companyName; bVal = b.companyName; break;
      case "shares": aVal = a.shares; bVal = b.shares; break;
      case "avgCost": aVal = a.avgCost; bVal = b.avgCost; break;
      case "price": aVal = a.quote.price; bVal = b.quote.price; break;
      case "marketValue": aVal = a.marketValue; bVal = b.marketValue; break;
      case "dayChange": aVal = a.quote.changePercent; bVal = b.quote.changePercent; break;
      case "totalPL": aVal = a.totalPL; bVal = b.totalPL; break;
      case "portfolioPercent":
        aVal = totalValue > 0 ? a.marketValue / totalValue : 0;
        bVal = totalValue > 0 ? b.marketValue / totalValue : 0;
        break;
      default: return 0;
    }

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    return sortDir === "asc"
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  function SortHeader({
    label,
    col,
  }: {
    label: string;
    col: SortKey;
  }) {
    const active = sortKey !== null && sortKey === col;
    return (
      <th
        className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-gray-200 select-none"
        onClick={() => handleSort(col)}
      >
        {label}
        {active && (
          <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
        )}
      </th>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by ticker or company..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-xs px-3 py-1.5 bg-surface-border text-white text-sm rounded border border-surface-border focus:outline-none focus:ring-1 focus:ring-accent placeholder-gray-500"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              <SortHeader label="Ticker" col="ticker" />
              <SortHeader label="Company" col="companyName" />
              <SortHeader label="Shares" col="shares" />
              <SortHeader label="Avg Cost" col="avgCost" />
              <SortHeader label="Current Price" col="price" />
              <SortHeader label="Market Value" col="marketValue" />
              <SortHeader label="Day Change" col="dayChange" />
              <SortHeader label="Total P&L" col="totalPL" />
              <SortHeader label="% of Portfolio" col="portfolioPercent" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const portfolioPct =
                totalValue > 0
                  ? ((item.marketValue / totalValue) * 100).toFixed(1)
                  : "0.0";
              const dayPositive = item.quote.changePercent >= 0;
              const plPositive = item.totalPL >= 0;

              return (
                <tr
                  key={item.ticker}
                  className="border-b border-surface-border hover:bg-surface-border/30"
                >
                  <td className="px-3 py-2 font-mono font-semibold text-white">
                    {item.ticker}
                  </td>
                  <td className="px-3 py-2 text-gray-300">{item.companyName}</td>
                  <td className="px-3 py-2 text-gray-300">{item.shares}</td>
                  <td className="px-3 py-2 text-gray-300">
                    ${item.avgCost.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-gray-300">
                    ${item.quote.price.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-gray-300">
                    {fmt(item.marketValue)}
                  </td>
                  <td
                    className={`px-3 py-2 ${
                      dayPositive ? "text-gain" : "text-loss"
                    }`}
                  >
                    {dayPositive ? "+" : ""}
                    {item.quote.changePercent.toFixed(2)}%
                  </td>
                  <td
                    className={`px-3 py-2 ${
                      plPositive ? "text-gain" : "text-loss"
                    }`}
                  >
                    {plPositive ? "" : "-"}
                    {fmt(item.totalPL)}
                  </td>
                  <td className="px-3 py-2 text-gray-300">{portfolioPct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="text-center py-8 text-gray-500">No holdings found</div>
        )}
      </div>
    </div>
  );
}
