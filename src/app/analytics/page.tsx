"use client";
import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { PerformanceCard } from "@/components/PerformanceCard";
import { AllocationStrip } from "@/components/AllocationStrip";
import { SectorPLCard } from "@/components/SectorPLCard";
import { AnalystSentimentCard } from "@/components/AnalystSentimentCard";
import { ValuationCard } from "@/components/ValuationCard";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { EmptyPortfolio } from "@/components/EmptyPortfolio";
import { CsvImportModal } from "@/components/CsvImportModal";
import { AddHoldingModal } from "@/components/AddHoldingModal";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { useIsDemo } from "@/lib/demo-context";
import { usePortfolioData } from "@/lib/use-portfolio-data";
import { isMarketOpen } from "@/lib/market-hours";
import { getDemoValuations } from "@/lib/demo-data";
import type { ValuationData } from "@/types";

export default function AnalyticsPage() {
  const { getIdToken, signOut } = useAuth();
  const toast = useToast();
  const isDemo = useIsDemo();
  const { items, status, snapshots, refresh } = usePortfolioData("1D");
  const [valuations, setValuations] = useState<Record<string, ValuationData>>({});
  const [showImport, setShowImport] = useState(false);
  const [showAddHolding, setShowAddHolding] = useState(false);

  // The two valuation cards are the only consumers of valuation data, and
  // usePortfolioData does not fetch it — so keep a dedicated fetch here, keyed
  // off the holdings the hook returns. Demo mode stays fully offline.
  const fetchValuations = useCallback(async () => {
    if (isDemo) {
      setValuations(getDemoValuations());
      return;
    }
    if (items.length === 0) {
      setValuations({});
      return;
    }
    const token = await getIdToken();
    if (!token) return;
    const tickers = items.map((i) => i.ticker).join(",");
    try {
      const res = await fetch(`/api/valuations?tickers=${tickers}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setValuations(res.ok ? await res.json() : {});
    } catch (err) {
      console.error("Analytics fetchValuations failed:", err);
      setValuations({});
    }
  }, [isDemo, items, getIdToken]);

  useEffect(() => {
    fetchValuations();
  }, [fetchValuations]);

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
            vix={null}
          />
        }
      >
        {status === "loading" ? (
          <DashboardSkeleton />
        ) : status === "empty" ? (
          <EmptyPortfolio onImportClick={openImport} onAddClick={openAddHolding} />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PerformanceCard snapshots={snapshots} />
            <AllocationStrip items={items} />
            <SectorPLCard items={items} />
            <div className="flex flex-col gap-4">
              <AnalystSentimentCard items={items} valuations={valuations} />
              <ValuationCard items={items} valuations={valuations} />
            </div>
          </div>
        )}
      </AppShell>

      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onAddSingle={() => {
            setShowImport(false);
            setShowAddHolding(true);
          }}
          onSuccess={() => {
            setShowImport(false);
            refresh();
          }}
        />
      )}
      {showAddHolding && (
        <AddHoldingModal
          onClose={() => setShowAddHolding(false)}
          onSuccess={() => {
            setShowAddHolding(false);
            refresh();
          }}
        />
      )}
    </AuthGuard>
  );
}
