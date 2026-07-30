"use client";
import { useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { PositionsTable } from "@/components/PositionsTable";
import { MobileHoldingsList } from "@/components/MobileHoldingsList";
import { PositionSheet } from "@/components/PositionSheet";
import { EmptyPortfolio } from "@/components/EmptyPortfolio";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { EditHoldingModal } from "@/components/EditHoldingModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CsvImportModal } from "@/components/CsvImportModal";
import { AddHoldingModal } from "@/components/AddHoldingModal";
import { usePortfolioData } from "@/lib/use-portfolio-data";
import { usePositionActions } from "@/lib/use-position-actions";
import { useIsMobile } from "@/lib/use-is-mobile";
import { useIsDemo } from "@/lib/demo-context";
import { useAuth } from "@/lib/auth-context";
import { isMarketOpen } from "@/lib/market-hours";

export default function HoldingsPage() {
  const { items, status, refresh } = usePortfolioData("1D");
  const { signOut } = useAuth();
  const isDemo = useIsDemo();
  const isMobile = useIsMobile();
  const actions = usePositionActions(refresh);
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const totalValue = items.reduce((sum, i) => sum + i.marketValue, 0);

  const openImport = () => {
    if (!isDemo) setShowImport(true);
  };
  const openAdd = () => {
    if (!isDemo) setShowAdd(true);
  };

  return (
    <AuthGuard>
      <AppShell
        topBar={
          <TopBar
            onImportClick={openImport}
            onAddClick={openAdd}
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
          <EmptyPortfolio onImportClick={openImport} onAddClick={openAdd} />
        ) : (
          <section aria-label="Holdings" className="rounded-xl border border-rd-border bg-rd-card">
            {isMobile ? (
              <div className="p-4">
                <MobileHoldingsList
                  items={items}
                  totalValue={totalValue}
                  variant="holdings"
                  onSelect={actions.select}
                  demo={isDemo}
                />
              </div>
            ) : (
              <PositionsTable items={items} totalValue={totalValue} onSelect={actions.select} />
            )}
          </section>
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
            refresh();
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
            setShowAdd(true);
          }}
          onSuccess={() => {
            setShowImport(false);
            refresh();
          }}
        />
      )}
      {showAdd && (
        <AddHoldingModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            refresh();
          }}
        />
      )}
    </AuthGuard>
  );
}
