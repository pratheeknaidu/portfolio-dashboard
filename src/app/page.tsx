"use client";
import { useEffect, useState, useCallback } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { Treemap } from "@/components/Treemap";
import { TreemapTooltip, type TileRect } from "@/components/TreemapTooltip";
import { Sidebar } from "@/components/Sidebar";
import { TimeRangeToggle } from "@/components/TimeRangeToggle";
import { SizingToggle } from "@/components/SizingToggle";
import { useAuth } from "@/lib/auth-context";
import { isMarketOpen } from "@/lib/market-hours";
import { CsvImportModal } from "@/components/CsvImportModal";
import type { Holding, Quote, PortfolioItem, TimeRange, SizingMode } from "@/types";

export default function DashboardPage() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [range, setRange] = useState<TimeRange>("1D");
  const [sizing, setSizing] = useState<SizingMode>("equity");
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [tileRect, setTileRect] = useState<TileRect | null>(null);
  const [showImport, setShowImport] = useState(false);

  const handleSelect = useCallback((item: PortfolioItem | null, rect: TileRect | null) => {
    if (item && item.ticker === selectedItem?.ticker) {
      setSelectedItem(null);
      setTileRect(null);
    } else {
      setSelectedItem(item);
      setTileRect(rect);
    }
  }, [selectedItem]);

  const dismissSelection = useCallback(() => {
    setSelectedItem(null);
    setTileRect(null);
  }, []);

  const fetchPortfolio = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    const holdingsRes = await fetch("/api/portfolio", { headers });
    if (!holdingsRes.ok) { setItems([]); return; }
    const holdings: Holding[] = await holdingsRes.json();
    if (!Array.isArray(holdings) || holdings.length === 0) { setItems([]); return; }

    const tickers = holdings.map((h) => h.ticker).join(",");
    const quotesUrl = range === "ALL"
      ? `/api/quotes?tickers=${tickers}`
      : `/api/quotes?tickers=${tickers}&range=${range}`;
    const quotesRes = await fetch(quotesUrl, { headers });
    const quotes: Record<string, Quote> = await quotesRes.json();

    const merged: PortfolioItem[] = holdings
      .filter((h) => quotes[h.ticker])
      .map((h) => {
        const q = quotes[h.ticker];
        const marketValue = h.shares * q.price;
        const costBasis = h.shares * h.avgCost;
        const totalPL = marketValue - costBasis;
        const totalPLPercent = (totalPL / costBasis) * 100;
        const quote: Quote = range === "ALL"
          ? { ...q, change: q.price - h.avgCost, changePercent: totalPLPercent }
          : q;
        return {
          ...h,
          quote,
          marketValue,
          totalPL,
          totalPLPercent,
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
          <main className="flex-1 p-4 relative" onClick={dismissSelection}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white">Portfolio Heat Map</h2>
              <div className="flex items-center gap-3">
                <SizingToggle selected={sizing} onChange={setSizing} />
                <TimeRangeToggle selected={range} onChange={setRange} />
              </div>
            </div>
            <div className="h-[calc(100%-3rem)]">
              <Treemap items={items} sizing={sizing} onSelect={handleSelect} />
            </div>
            <TreemapTooltip item={selectedItem} tileRect={tileRect} />
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
