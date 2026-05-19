"use client";
import { useEffect, useState, useCallback } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { Treemap } from "@/components/Treemap";
import { TreemapTooltip, type TileRect } from "@/components/TreemapTooltip";
import { TimeRangeToggle } from "@/components/TimeRangeToggle";
import { SizingToggle } from "@/components/SizingToggle";
import { PortfolioHeroCard } from "@/components/PortfolioHeroCard";
import { MetricCard } from "@/components/MetricCard";
import { AllocationCard } from "@/components/AllocationCard";
import { MoversCard } from "@/components/MoversCard";
import { useAuth } from "@/lib/auth-context";
import { isMarketOpen } from "@/lib/market-hours";
import { CsvImportModal } from "@/components/CsvImportModal";
import type { Holding, Quote, PortfolioItem, TimeRange, SizingMode } from "@/types";

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtCurrencySigned(n: number): string {
  const formatted = fmtCurrency(Math.abs(n));
  return n >= 0 ? `+${formatted}` : `−${formatted}`;
}

export default function DashboardPage() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [range, setRange] = useState<TimeRange>("1D");
  const [sizing, setSizing] = useState<SizingMode>("equity");
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [tileRect, setTileRect] = useState<TileRect | null>(null);
  const [showImport, setShowImport] = useState(false);

  const handleSelect = useCallback(
    (item: PortfolioItem | null, rect: TileRect | null) => {
      if (item && item.ticker === selectedItem?.ticker) {
        setSelectedItem(null);
        setTileRect(null);
      } else {
        setSelectedItem(item);
        setTileRect(rect);
      }
    },
    [selectedItem],
  );

  const dismissSelection = useCallback(() => {
    setSelectedItem(null);
    setTileRect(null);
  }, []);

  const fetchPortfolio = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    const holdingsRes = await fetch("/api/portfolio", { headers });
    if (!holdingsRes.ok) {
      setItems([]);
      return;
    }
    const holdings: Holding[] = await holdingsRes.json();
    if (!Array.isArray(holdings) || holdings.length === 0) {
      setItems([]);
      return;
    }

    const tickers = holdings.map((h) => h.ticker).join(",");
    const quotesUrl =
      range === "ALL"
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
        const quote: Quote =
          range === "ALL"
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
    const holdingsMap = Object.fromEntries(
      merged.map((i) => [i.ticker, i.marketValue]),
    );
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

  const totalCostBasis = items.reduce(
    (sum, i) => sum + i.shares * i.avgCost,
    0,
  );
  const totalValue = items.reduce((sum, i) => sum + i.marketValue, 0);
  const unrealizedPL = totalValue - totalCostBasis;
  const unrealizedPLPct =
    totalCostBasis > 0 ? (unrealizedPL / totalCostBasis) * 100 : 0;

  return (
    <AuthGuard>
      <div className="min-h-screen flex flex-col">
        <Navbar onImportClick={() => setShowImport(true)} />

        <main className="flex-1 px-4 md:px-8 py-8 max-w-[1400px] w-full mx-auto">
          {/* Row 1: Hero (col-8) + 2 stacked metric cards (col-4) */}
          <div className="grid grid-cols-12 gap-4 mb-4">
            <div className="col-span-12 lg:col-span-8">
              <PortfolioHeroCard items={items} />
            </div>
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
              <MetricCard
                label="Cost Basis"
                value={fmtCurrency(totalCostBasis)}
              />
              <MetricCard
                label="Unrealized P&L"
                value={fmtCurrencySigned(unrealizedPL)}
                delta={{
                  text: `${unrealizedPLPct >= 0 ? "+" : ""}${unrealizedPLPct.toFixed(2)}%`,
                  positive: unrealizedPL >= 0,
                }}
              />
            </div>
          </div>

          {/* Row 2: Treemap (col-12) wrapped in bento */}
          <div className="bento-card p-5 mb-4" onClick={dismissSelection}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">
                  Heat Map
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tile size by {sizing === "equity" ? "market value" : "profit"} ·
                  color by {range} change
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <SizingToggle selected={sizing} onChange={setSizing} />
                <TimeRangeToggle selected={range} onChange={setRange} />
              </div>
            </div>
            <div className="h-[440px] md:h-[520px] relative">
              <Treemap
                items={items}
                sizing={sizing}
                onSelect={handleSelect}
              />
            </div>
            <TreemapTooltip item={selectedItem} tileRect={tileRect} />
          </div>

          {/* Row 3: Allocation (col-5) + Movers (col-7) */}
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-5">
              <AllocationCard items={items} />
            </div>
            <div className="col-span-12 lg:col-span-7">
              <MoversCard items={items} />
            </div>
          </div>
        </main>
      </div>

      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            setShowImport(false);
            fetchPortfolio();
          }}
        />
      )}
    </AuthGuard>
  );
}
