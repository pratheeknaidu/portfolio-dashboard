"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Sheet } from "@/components/ui/Sheet";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddHoldingModal({ onClose, onSuccess }: Props) {
  const { getIdToken } = useAuth();
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState<number>(NaN);
  const [avgCost, setAvgCost] = useState<number>(NaN);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valid = ticker.trim().length > 0
    && Number.isFinite(shares) && shares > 0
    && Number.isFinite(avgCost) && avgCost > 0;

  const handleAdd = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ticker: ticker.trim().toUpperCase(), shares, avgCost }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Add failed (${res.status})`);
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
    <Sheet open onClose={() => { if (!saving) onClose(); }} labelledBy="add-holding-title">
      <div className="p-5 md:p-6">
        <h2 id="add-holding-title" className="text-lg font-bold text-white mb-1">Add a stock</h2>
        <p className="text-sm text-gray-400 mb-4">Add a single position by hand.</p>

        <div className="space-y-4">
          <div>
            <label htmlFor="add-ticker" className="block text-xs text-gray-400 mb-1">Ticker</label>
            <input
              id="add-ticker"
              type="text"
              autoCapitalize="characters"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-white uppercase placeholder:normal-case focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="add-shares" className="block text-xs text-gray-400 mb-1">Shares</label>
            <input
              id="add-shares"
              type="number"
              step="any"
              value={Number.isFinite(shares) ? shares : ""}
              onChange={(e) => setShares(parseFloat(e.target.value))}
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="add-avgcost" className="block text-xs text-gray-400 mb-1">Avg Cost</label>
            <input
              id="add-avgcost"
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
            onClick={handleAdd}
            disabled={!valid || saving}
            className="px-4 py-2 text-sm bg-accent rounded-lg text-white disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
