"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { PortfolioItem } from "@/types";

interface Props {
  holding: PortfolioItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditHoldingModal({ holding, onClose, onSuccess }: Props) {
  const { getIdToken } = useAuth();
  const [shares, setShares] = useState<number>(holding.shares);
  const [avgCost, setAvgCost] = useState<number>(holding.avgCost);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valid = Number.isFinite(shares) && shares > 0
    && Number.isFinite(avgCost) && avgCost > 0;

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/portfolio/${holding.ticker}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shares, avgCost }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Update failed (${res.status})`);
        return;
      }
      onSuccess();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface-card border border-surface-border rounded-xl p-6 w-[400px] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="edit-holding-title">
        <h2 id="edit-holding-title" className="text-lg font-bold text-white mb-1">Edit holding</h2>
        <p className="text-sm text-gray-400 mb-4">{holding.ticker} &middot; {holding.companyName}</p>

        <div className="space-y-4">
          <div>
            <label htmlFor="edit-shares" className="block text-xs text-gray-400 mb-1">Shares</label>
            <input
              id="edit-shares"
              type="number"
              step="any"
              value={Number.isFinite(shares) ? shares : ""}
              onChange={(e) => setShares(parseFloat(e.target.value))}
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="edit-avgcost" className="block text-xs text-gray-400 mb-1">Avg Cost</label>
            <input
              id="edit-avgcost"
              type="number"
              step="any"
              value={Number.isFinite(avgCost) ? avgCost : ""}
              onChange={(e) => setAvgCost(parseFloat(e.target.value))}
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {error && <p className="text-loss text-sm mt-3">{error}</p>}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!valid || saving}
            className="px-4 py-2 text-sm bg-accent rounded-lg text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
