"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { HeatMapCard } from "@/components/HeatMapCard";
import type { TileRect } from "@/components/TreemapTooltip";
import { SummaryCard } from "@/components/SummaryCard";
import { MoversCard } from "@/components/MoversCard";
import { AllocationStrip } from "@/components/AllocationStrip";
import { FailedTickersStrip } from "@/components/FailedTickersStrip";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { PositionsTable } from "@/components/PositionsTable";
import { MobileHoldingsList } from "@/components/MobileHoldingsList";
import { PositionSheet } from "@/components/PositionSheet";
import { EditHoldingModal } from "@/components/EditHoldingModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { useIsDemo } from "@/lib/demo-context";
import { useIsMobile } from "@/lib/use-is-mobile";
import { isMarketOpen } from "@/lib/market-hours";
import { usePortfolioData } from "@/lib/use-portfolio-data";
import { usePositionActions } from "@/lib/use-position-actions";
import { portfolioTotals } from "@/lib/design/portfolio-totals";
import { CsvImportModal } from "@/components/CsvImportModal";
import { AddHoldingModal } from "@/components/AddHoldingModal";
import { EmptyPortfolio } from "@/components/EmptyPortfolio";
import type { PortfolioItem, TimeRange, SizingMode } from "@/types";
import type { VixApiResponse } from "@/lib/vix-sentiment";

export default function DashboardPage() {
  const { getIdToken, signOut } = useAuth();
  const toast = useToast();
  const isDemo = useIsDemo();
  const [range, setRange] = useState<TimeRange>("1D");
  const [sizing, setSizing] = useState<SizingMode>("equity");
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [tileRect, setTileRect] = useState<TileRect | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [vix, setVix] = useState<VixApiResponse | null>(null);

  const {
    items,
    failed: failedTickers,
    status,
    snapshots,
    excludedValue,
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

  // The holdings table row → sheet → edit/remove flow, shared with /holdings so
  // the two screens cannot drift. The failed-tickers strip uses its direct
  // removeTicker (a delisted symbol is never in `items`).
  const actions = usePositionActions(fetchPortfolio);
  const isMobile = useIsMobile();

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

  const totals = portfolioTotals(items);

  return (
    <AuthGuard>
      <AppShell
        topBar={
          <TopBar
            onImportClick={openImport}
            onAddClick={openAddHolding}
            onSignOut={signOut}
            isDemo={isDemo}
            marketOpen={isMarketOpen()}
            vix={vix}
          />
        }
      >
        {status === "loading" ? (
          <DashboardSkeleton />
        ) : status === "empty" ? (
          <EmptyPortfolio onImportClick={openImport} onAddClick={openAddHolding} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
              <SummaryCard totals={totals} snapshots={snapshots} />
              <MoversCard items={items} />
            </div>

            {/* Tooltip dismiss is handled at document level (see useEffect
                above) so clicks anywhere outside a tile — including on the
                TopBar or other cards — also dismiss. */}
            <div className="mt-4">
              <FailedTickersStrip
                failures={failedTickers}
                excludedValue={excludedValue}
                onRetry={() => fetchPortfolio()}
                onRemove={actions.removeTicker}
              />
              <HeatMapCard
                items={items}
                sizing={sizing}
                range={range}
                onSizingChange={setSizing}
                onRangeChange={setRange}
                onSelect={handleSelect}
                selected={selectedItem}
                selectedRect={tileRect}
                onDismiss={dismissSelection}
              />
            </div>

            <div className="mt-4">
              <AllocationStrip items={items} />
            </div>

            <div className="mt-4 rounded-xl border border-rd-border bg-rd-card">
              <div className="flex items-center justify-between px-4 pt-4">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
                  Holdings
                </h2>
                {items.length > 10 && (
                  <Link
                    href={isDemo ? "/demo/holdings" : "/holdings"}
                    className="rd-focusable text-xs font-medium text-rd-muted hover:text-rd-text"
                  >
                    All holdings →
                  </Link>
                )}
              </div>
              {isMobile ? (
                <div className="p-4">
                  <MobileHoldingsList
                    items={items}
                    totalValue={totals.totalValue}
                    variant="dashboard"
                    onSelect={actions.select}
                    demo={isDemo}
                  />
                </div>
              ) : (
                <PositionsTable
                  items={[...items].sort((a, b) => b.marketValue - a.marketValue).slice(0, 10)}
                  totalValue={totals.totalValue}
                  onSelect={actions.select}
                />
              )}
            </div>
          </>
        )}
      </AppShell>

      <PositionSheet
        item={actions.selected}
        onClose={actions.dismiss}
        onEdit={actions.edit}
        onRemove={actions.remove}
      />
      {actions.editing && (
        <EditHoldingModal
          holding={actions.editing}
          onClose={actions.closeEdit}
          onSuccess={() => {
            actions.closeEdit();
            fetchPortfolio();
          }}
        />
      )}
      {actions.confirming && (
        <ConfirmDialog
          title={`Remove ${actions.confirming.ticker}?`}
          message="This deletes the holding from your portfolio."
          onConfirm={actions.confirmRemove}
          onCancel={actions.cancelRemove}
        />
      )}

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
