"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { Treemap, domainFor } from "@/components/Treemap";
import { TreemapTooltip, type TileRect } from "@/components/TreemapTooltip";
import { TimeRangeToggle } from "@/components/TimeRangeToggle";
import { SizingToggle } from "@/components/SizingToggle";
import { PortfolioHeroCard } from "@/components/PortfolioHeroCard";
import { MetricCard } from "@/components/MetricCard";
import { AllocationCard } from "@/components/AllocationCard";
import { MoversCard } from "@/components/MoversCard";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { useIsDemo } from "@/lib/demo-context";
import { isMarketOpen } from "@/lib/market-hours";
import { usePortfolioData } from "@/lib/use-portfolio-data";
import { CsvImportModal } from "@/components/CsvImportModal";
import { AddHoldingModal } from "@/components/AddHoldingModal";
import { EmptyPortfolio } from "@/components/EmptyPortfolio";
import { FailedTickersChip } from "@/components/FailedTickersChip";
import type { PortfolioItem, TimeRange, SizingMode } from "@/types";
import type { VixApiResponse } from "@/lib/vix-sentiment";

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
  const toast = useToast();
  const isDemo = useIsDemo();
  const [range, setRange] = useState<TimeRange>("1D");
  const [sizing, setSizing] = useState<SizingMode>("equity");
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [tileRect, setTileRect] = useState<TileRect | null>(null);
  const [cardRect, setCardRect] = useState<TileRect | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [vix, setVix] = useState<VixApiResponse | null>(null);
  const mapBodyRef = useRef<HTMLDivElement>(null);

  const {
    items,
    failed: failedTickers,
    status,
    refresh: fetchPortfolio,
  } = usePortfolioData(range);

  const handleSelect = useCallback(
    (item: PortfolioItem | null, rect: TileRect | null) => {
      if (item && item.ticker === selectedItem?.ticker) {
        setSelectedItem(null);
        setTileRect(null);
      } else {
        setSelectedItem(item);
        setTileRect(rect);
        // Captured at selection time, in the same viewport coordinate space
        // as `rect`, so tooltipPosition can express one against the other.
        const box = mapBodyRef.current?.getBoundingClientRect();
        setCardRect(
          box ? { top: box.top, left: box.left, width: box.width, height: box.height } : null,
        );
      }
    },
    [selectedItem],
  );

  const dismissSelection = useCallback(() => {
    setSelectedItem(null);
    setTileRect(null);
  }, []);

  // In demo mode the write modals would POST without a token and fail, so the
  // import/add affordances redirect intent to signing in instead.
  const openImport = useCallback(() => {
    if (isDemo) {
      toast.info("Sign in to import your own holdings.");
      return;
    }
    setShowImport(true);
  }, [isDemo, toast]);

  const openAddHolding = useCallback(() => {
    if (isDemo) {
      toast.info("Sign in to add your own holdings.");
      return;
    }
    setShowAddHolding(true);
  }, [isDemo, toast]);

  // Dismiss the pinned tooltip on Escape OR any click outside a tile.
  // Tile onClick handlers call stopPropagation, so clicks that reach the
  // document listener are guaranteed to be outside the treemap — that
  // covers Sidebar / Navbar / Hero card / empty-state / etc. without
  // each parent needing its own onClick={dismiss}.
  useEffect(() => {
    if (!selectedItem) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissSelection();
    };
    const handleClickOutside = () => dismissSelection();

    document.addEventListener("keydown", handleEsc);
    // Defer adding the click listener by one tick so the click that
    // SELECTED the tile (and bubbled up to document) doesn't immediately
    // re-dismiss it.
    const timer = window.setTimeout(
      () => document.addEventListener("click", handleClickOutside),
      0,
    );

    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.removeEventListener("click", handleClickOutside);
      window.clearTimeout(timer);
    };
  }, [selectedItem, dismissSelection]);

  const fetchVix = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    try {
      const res = await fetch("/api/market/vix", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data: VixApiResponse = await res.json();
      setVix(data);
    } catch (err) {
      console.error("fetchVix failed:", err);
    }
  }, [getIdToken]);

  // VIX is independent of the selected time range, so keep it on its own
  // effect/timer — otherwise a range toggle (which changes fetchPortfolio's
  // identity) would spuriously refetch VIX too. fetchVix's only dep is the
  // stable getIdToken, so this effect runs on mount and re-arms its timer once.
  useEffect(() => {
    fetchVix();
    const interval = setInterval(() => {
      if (isMarketOpen()) fetchVix();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchVix]);

  const totalCostBasis = items.reduce(
    (sum, i) => sum + i.shares * i.avgCost,
    0,
  );
  const totalValue = items.reduce((sum, i) => sum + i.marketValue, 0);
  const weightPct =
    selectedItem && totalValue > 0 ? (selectedItem.marketValue / totalValue) * 100 : 0;
  const unrealizedPL = totalValue - totalCostBasis;
  const unrealizedPLPct =
    totalCostBasis > 0 ? (unrealizedPL / totalCostBasis) * 100 : 0;

  return (
    <AuthGuard>
      <div className="min-h-screen flex flex-col">
        <Navbar
          onImportClick={openImport}
          onAddClick={openAddHolding}
          vix={vix}
        />

        <main className="flex-1 px-4 md:px-8 py-4 md:py-8 max-w-[1400px] w-full mx-auto">
          {/* Row 1: Hero (col-8) + 2 stacked metric cards (col-4) */}
          <div className="grid grid-cols-12 gap-4 mb-4">
            <div className="col-span-12 md:col-span-8">
              <PortfolioHeroCard items={items} />
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
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
          {/* Tooltip dismiss is handled at document level (see useEffect
              above) so clicks anywhere outside a tile — including on the
              Sidebar, Navbar, or other cards — also dismiss. */}
          <div className="bento-card p-5 mb-4">
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
            <FailedTickersChip tickers={failedTickers} onRetry={fetchPortfolio} />
            {/* The tooltip positions absolutely against THIS box, so it must
                live inside it — placement is card-relative, not viewport-
                relative, which is what keeps it from drifting off the map. */}
            <div
              ref={mapBodyRef}
              className="h-[360px] sm:h-[440px] md:h-[520px] relative"
            >
              {status === "empty" ? (
                <EmptyPortfolio
                  onImportClick={openImport}
                  onAddClick={openAddHolding}
                />
              ) : (
                <Treemap
                  items={items}
                  sizing={sizing}
                  domain={domainFor(items)}
                  onSelect={handleSelect}
                />
              )}
              <TreemapTooltip
                item={selectedItem}
                tileRect={tileRect}
                cardRect={cardRect}
                weightPct={weightPct}
                onClose={dismissSelection}
              />
            </div>
          </div>

          {/* Row 3: Allocation (col-5) + Movers (col-7) */}
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-5">
              <AllocationCard items={items} />
            </div>
            <div className="col-span-12 md:col-span-7">
              <MoversCard items={items} />
            </div>
          </div>
        </main>
      </div>

      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onAddSingle={() => {
            setShowImport(false);
            setShowAddHolding(true);
          }}
          onSuccess={() => {
            setShowImport(false);
            fetchPortfolio();
          }}
        />
      )}

      {showAddHolding && (
        <AddHoldingModal
          onClose={() => setShowAddHolding(false)}
          onSuccess={() => {
            setShowAddHolding(false);
            fetchPortfolio();
          }}
        />
      )}
    </AuthGuard>
  );
}
