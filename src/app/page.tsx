"use client";
import { useEffect, useState, useCallback } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { Treemap } from "@/components/Treemap";
import { TreemapTooltip } from "@/components/TreemapTooltip";
import { Sidebar } from "@/components/Sidebar";
import { TimeRangeToggle } from "@/components/TimeRangeToggle";
import { useAuth } from "@/lib/auth-context";
import { isMarketOpen } from "@/lib/market-hours";
import { CsvImportModal } from "@/components/CsvImportModal";
import type { Holding, Quote, PortfolioItem, TimeRange } from "@/types";

export default function DashboardPage() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [range, setRange] = useState<TimeRange>("1D");
  const [hoveredItem, setHoveredItem] = useState<PortfolioItem | null>(null);
  const [showImport, setShowImport] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    const holdingsRes = await fetch("/api/portfolio", { headers });
    const holdings: Holding[] = await holdingsRes.json();
    if (holdings.length === 0) { setItems([]); return; }

    const tickers = holdings.map((h) => h.ticker).join(",");
    const quotesRes = await fetch(`/api/quotes?tickers=${tickers}&range=${range}`);
    const quotes: Record<string, Quote> = await quotesRes.json();

    const merged: PortfolioItem[] = holdings
      .filter((h) => quotes[h.ticker])
      .map((h) => {
        const q = quotes[h.ticker];
        const marketValue = h.shares * q.price;
        const costBasis = h.shares * h.avgCost;
        return {
          ...h,
          quote: q,
          marketValue,
          totalPL: marketValue - costBasis,
          totalPLPercent: ((marketValue - costBasis) / costBasis) * 100,
        };
      });

    setItems(merged);

    const totalValue = merged.reduce((sum, i) => sum + i.marketValue, 0);
    const holdingsMap = Object.fromEntries(merged.map((i) => [i.ticker, i.marketValue]));
    await fetch("/api/snapshot", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ totalValue, holdings: holdingsMap }),
    });
  }, [getIdToken, range]);

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(() => {
      if (isMarketOpen()) fetchPortfolio();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  return (
    <AuthGuard>
      <div className="flex flex-col h-screen">
        <Navbar onImportClick={() => setShowImport(true)} />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 p-4 relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white">Portfolio Heat Map</h2>
              <TimeRangeToggle selected={range} onChange={setRange} />
            </div>
            <div className="h-[calc(100%-3rem)]">
              <Treemap items={items} onHover={setHoveredItem} />
            </div>
            <TreemapTooltip item={hoveredItem} />
          </main>
          <aside className="w-60 border-l border-surface-border">
            <Sidebar items={items} />
          </aside>
        </div>
      </div>
      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); fetchPortfolio(); }}
        />
      )}
    </AuthGuard>
  );
}
