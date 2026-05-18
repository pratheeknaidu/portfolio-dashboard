"use client";
import { useState, useEffect, useRef } from "react";
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
  onEdit?: (item: PortfolioItem) => void;
  onDelete?: (item: PortfolioItem) => void;
}

export function HoldingsTable({ items, totalValue, onEdit, onDelete }: HoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [searchTerm, setSearchTerm] = useState("");
  const [openMenuTicker, setOpenMenuTicker] = useState<string | null>(null);
  const [menuDirection, setMenuDirection] = useState<"down" | "up">("down");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const showActions = Boolean(onEdit || onDelete);
  // Approx height of the dropdown (Edit + Delete @ ~37px each). If less than
  // this much room exists below the kebab button, flip the menu upward so it
  // is not clipped by ancestor `overflow-*` containers.
  const MENU_HEIGHT = 100;

  useEffect(() => {
    if (!openMenuTicker) return;
    const handleDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuTicker(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuTicker(null);
    };
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openMenuTicker]);

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
              {showActions && <th className="px-3 py-2" aria-label="Actions" />}
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
                  {showActions && (
                    <td className="px-3 py-2 relative">
                      <button
                        type="button"
                        aria-label={`Actions for ${item.ticker}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openMenuTicker === item.ticker) {
                            setOpenMenuTicker(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          const spaceBelow = window.innerHeight - rect.bottom;
                          setMenuDirection(spaceBelow < MENU_HEIGHT ? "up" : "down");
                          setOpenMenuTicker(item.ticker);
                        }}
                        className="text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-surface-border"
                      >
                        ⋯
                      </button>
                      {openMenuTicker === item.ticker && (
                        <div
                          ref={menuRef}
                          className={`absolute right-0 ${menuDirection === "up" ? "bottom-full mb-1" : "top-full mt-1"} bg-surface-card border border-surface-border rounded-md shadow-lg z-10 min-w-[120px]`}
                        >
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => { setOpenMenuTicker(null); onEdit(item); }}
                              className="block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-surface-border"
                            >
                              Edit
                            </button>
                          )}
                          {onDelete && (
                            <button
                              type="button"
                              onClick={() => { setOpenMenuTicker(null); onDelete(item); }}
                              className="block w-full text-left px-3 py-2 text-sm text-loss hover:bg-surface-border"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
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
