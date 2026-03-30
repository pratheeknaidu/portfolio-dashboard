"use client";
import { useEffect, useState, useCallback } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { SectorChart } from "@/components/SectorChart";
import { PerformanceChart } from "@/components/PerformanceChart";
import { HoldingsTable } from "@/components/HoldingsTable";
import { useAuth } from "@/lib/auth-context";
import { CsvImportModal } from "@/components/CsvImportModal";
import type { Holding, Quote, PortfolioItem, Snapshot } from "@/types";

export default function AnalyticsPage() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [showImport, setShowImport] = useState(false);

  const fetchData = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    const holdingsRes = await fetch("/api/portfolio", { headers });
    const holdings: Holding[] = await holdingsRes.json();

    if (holdings.length > 0) {
      const tickers = holdings.map((h) => h.ticker).join(",");
      const quotesRes = await fetch(`/api/quotes?tickers=${tickers}`, { headers });
      const quotes: Record<string, Quote> = await quotesRes.json();

      setItems(
        holdings.filter((h) => quotes[h.ticker]).map((h) => {
          const q = quotes[h.ticker];
          const mv = h.shares * q.price;
          const cb = h.shares * h.avgCost;
          return {
            ...h,
            quote: q,
            marketValue: mv,
            totalPL: mv - cb,
            totalPLPercent: ((mv - cb) / cb) * 100,
          };
        })
      );
    }

    // Fetch snapshots
    const snapshotsRes = await fetch("/api/snapshot", { headers });
    if (snapshotsRes.ok) {
      const data = await snapshotsRes.json();
      setSnapshots(data);
    }
  }, [getIdToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalValue = items.reduce((s, i) => s + i.marketValue, 0);
  const sectors = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.sector || "Unknown"] = (acc[i.sector || "Unknown"] || 0) + i.marketValue;
    return acc;
  }, {});

  return (
    <AuthGuard>
      <div className="flex flex-col h-screen">
        <Navbar onImportClick={() => setShowImport(true)} />
        <main className="flex-1 overflow-auto p-6 space-y-8">
          <div className="grid grid-cols-2 gap-6">
            <section className="bg-surface-card rounded-lg p-6 border border-surface-border">
              <h2 className="text-lg font-semibold text-white mb-4">
                Sector Allocation
              </h2>
              <SectorChart sectors={sectors} />
            </section>
            <section className="bg-surface-card rounded-lg p-6 border border-surface-border">
              <h2 className="text-lg font-semibold text-white mb-4">
                Performance Over Time
              </h2>
              <PerformanceChart snapshots={snapshots} />
            </section>
          </div>
          <section className="bg-surface-card rounded-lg p-6 border border-surface-border">
            <h2 className="text-lg font-semibold text-white mb-4">Holdings</h2>
            <HoldingsTable items={items} totalValue={totalValue} />
          </section>
        </main>
      </div>
      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); fetchData(); }}
        />
      )}
    </AuthGuard>
  );
}
