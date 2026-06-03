"use client";
import { useEffect, useState, useCallback } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { SectorChart } from "@/components/SectorChart";
import { EquityAllocationChart } from "@/components/EquityAllocationChart";
import { PerformanceChart } from "@/components/PerformanceChart";
import { HoldingsTable } from "@/components/HoldingsTable";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { CsvImportModal } from "@/components/CsvImportModal";
import { AddHoldingModal } from "@/components/AddHoldingModal";
import { EditHoldingModal } from "@/components/EditHoldingModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AnalystSentimentCard } from "@/components/AnalystSentimentCard";
import { ValuationCard } from "@/components/ValuationCard";
import type { Holding, Quote, PortfolioItem, Snapshot, ValuationData } from "@/types";

export default function AnalyticsPage() {
  const { getIdToken } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [valuations, setValuations] = useState<Record<string, ValuationData>>({});
  const [showImport, setShowImport] = useState(false);
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [editing, setEditing] = useState<PortfolioItem | null>(null);
  const [deleting, setDeleting] = useState<PortfolioItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const holdingsRes = await fetch("/api/portfolio", { headers });
      if (!holdingsRes.ok) {
        toast.error(`Couldn't load your holdings (${holdingsRes.status}).`);
        return;
      }
      const holdings: Holding[] = await holdingsRes.json();

      if (Array.isArray(holdings) && holdings.length > 0) {
        const tickers = holdings.map((h) => h.ticker).join(",");
        const quotesRes = await fetch(`/api/quotes?tickers=${tickers}`, { headers });
        if (!quotesRes.ok) {
          toast.error("Quotes service is unavailable.");
        } else {
          const { quotes }: { quotes: Record<string, Quote>; failed: string[] } = await quotesRes.json();
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

          const valuationsRes = await fetch(`/api/valuations?tickers=${tickers}`, { headers });
          if (valuationsRes.ok) {
            setValuations(await valuationsRes.json());
          } else {
            setValuations({});
          }
        }
      } else {
        setItems([]);
        setValuations({});
      }

      const snapshotsRes = await fetch("/api/snapshot", { headers });
      if (snapshotsRes.ok) {
        const data = await snapshotsRes.json();
        setSnapshots(data);
      }
    } catch (err) {
      console.error("Analytics fetchData failed:", err);
      toast.error("Network error — couldn't load analytics.");
    }
  }, [getIdToken, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleting) return;
    setDeleteError(null);
    const token = await getIdToken();
    const res = await fetch(`/api/portfolio/${deleting.ticker}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDeleteError(body.error || `Delete failed (${res.status})`);
      return;
    }
    setDeleting(null);
    fetchData();
  }, [deleting, getIdToken, fetchData]);

  const totalValue = items.reduce((s, i) => s + i.marketValue, 0);
  const sectors = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.sector || "Unknown"] = (acc[i.sector || "Unknown"] || 0) + i.marketValue;
    return acc;
  }, {});

  return (
    <AuthGuard>
      <div className="flex flex-col h-screen">
        <Navbar
          onImportClick={() => setShowImport(true)}
          onAddClick={() => setShowAddHolding(true)}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6 md:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <section className="bg-surface-card rounded-lg p-4 md:p-6 border border-surface-border">
              <h2 className="text-lg font-semibold text-white mb-4">
                Sector Allocation
              </h2>
              <SectorChart sectors={sectors} />
            </section>
            <section className="bg-surface-card rounded-lg p-4 md:p-6 border border-surface-border">
              <h2 className="text-lg font-semibold text-white mb-4">
                Performance Over Time
              </h2>
              <PerformanceChart snapshots={snapshots} />
            </section>
          </div>
          <section className="bg-surface-card rounded-lg p-4 md:p-6 border border-surface-border">
            <h2 className="text-lg font-semibold text-white mb-4">
              Equity Allocation
            </h2>
            <EquityAllocationChart items={items} />
          </section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <AnalystSentimentCard items={items} valuations={valuations} />
            <ValuationCard items={items} valuations={valuations} />
          </div>
          <section className="bg-surface-card rounded-lg p-4 md:p-6 border border-surface-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Holdings</h2>
              <button
                type="button"
                onClick={() => setShowAddHolding(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-surface-bg border border-surface-border text-gray-300 hover:text-white hover:border-accent transition"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add
              </button>
            </div>
            <HoldingsTable
              items={items}
              totalValue={totalValue}
              onEdit={setEditing}
              onDelete={(item) => { setDeleteError(null); setDeleting(item); }}
            />
          </section>
        </main>
      </div>
      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onAddSingle={() => { setShowImport(false); setShowAddHolding(true); }}
          onSuccess={() => { setShowImport(false); fetchData(); }}
        />
      )}
      {showAddHolding && (
        <AddHoldingModal
          onClose={() => setShowAddHolding(false)}
          onSuccess={() => { setShowAddHolding(false); fetchData(); }}
        />
      )}
      {editing && (
        <EditHoldingModal
          holding={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); fetchData(); }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Remove holding?"
          message={
            deleteError
              ? `${deleteError} — try again, or cancel.`
              : `Remove ${deleting.ticker} from your portfolio?`
          }
          confirmLabel="Delete"
          destructive
          onConfirm={handleConfirmDelete}
          onCancel={() => { setDeleting(null); setDeleteError(null); }}
        />
      )}
    </AuthGuard>
  );
}
