"use client";
import type { PortfolioItem, ValuationData } from "@/types";
import { useDetailSelection } from "@/lib/use-detail-selection";
import { DetailPanel } from "@/components/ui/DetailPanel";
import { ChipDetail } from "@/components/ChipDetail";

interface Props {
  items: PortfolioItem[];
  valuations: Record<string, ValuationData>;
}

type VBucketId = "deep_value" | "undervalued" | "fair" | "overvalued";

const BUCKETS: { id: VBucketId; label: string; chipClass: string }[] = [
  { id: "deep_value",  label: "Deep Value",    chipClass: "bg-positive/30 text-positive border-positive/40" },
  { id: "undervalued", label: "Undervalued",   chipClass: "bg-positive/15 text-positive/90 border-positive/25" },
  { id: "fair",        label: "Fairly Priced", chipClass: "bg-surface-border text-gray-300 border-surface-border" },
  { id: "overvalued",  label: "Overvalued",    chipClass: "bg-negative/20 text-negative/90 border-negative/30" },
];

function bucketFor(v: ValuationData | undefined): VBucketId | undefined {
  if (!v) return undefined;
  // Path 1: trust the Yahoo enum when present.
  switch (v.fairValueDescription) {
    case "Undervalued":     return "undervalued";
    case "Near Fair Value": return "fair";
    case "Overvalued":      return "overvalued";
  }
  // Path 2: fall back to numeric upside thresholds.
  const up = v.upsideToTargetPct;
  if (up === undefined) return undefined;
  if (up > 25) return "deep_value";
  if (up >= 10) return "undervalued";
  if (up >= -10) return "fair";
  return "overvalued";
}

function effectiveUpside(v: ValuationData): number {
  if (v.fairValueDiscountPct !== undefined) return v.fairValueDiscountPct;
  if (v.upsideToTargetPct !== undefined) return v.upsideToTargetPct;
  return Number.NEGATIVE_INFINITY; // missing data sorts to bottom of bucket
}

function formatPct(n: number): string {
  const rounded = Math.abs(n) >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

export function ValuationCard({ items, valuations }: Props) {
  const bucketed: Record<VBucketId, { item: PortfolioItem; v: ValuationData }[]> = {
    deep_value: [], undervalued: [], fair: [], overvalued: [],
  };
  const noCoverage: string[] = [];

  for (const item of items) {
    const v = valuations[item.ticker];
    const b = bucketFor(v);
    if (b && v) bucketed[b].push({ item, v });
    else noCoverage.push(item.ticker);
  }

  for (const id of Object.keys(bucketed) as VBucketId[]) {
    bucketed[id].sort((a, b) => {
      const diff = effectiveUpside(b.v) - effectiveUpside(a.v);
      if (diff !== 0) return diff;
      return a.item.ticker.localeCompare(b.item.ticker);
    });
  }

  const { selected, rect, select } = useDetailSelection<PortfolioItem>();

  return (
    <section className="bg-surface-card rounded-lg p-6 border border-surface-border">
      <h2 className="text-lg font-semibold text-white mb-4">Valuation</h2>
      <div className="flex flex-col gap-4 md:grid md:grid-cols-4 md:gap-2">
        {BUCKETS.map(({ id, label, chipClass }) => (
          <div key={id} data-testid={`vbucket-${id}`} className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              {label} ({bucketed[id].length})
            </h3>
            <div className="flex flex-wrap gap-1.5 md:flex-col md:gap-1.5">
              {bucketed[id].map(({ item, v }) => {
                const fvPart = v.fairValueDiscountPct !== undefined ? `FV: ${formatPct(v.fairValueDiscountPct)}` : null;
                const tgtPart = v.upsideToTargetPct !== undefined ? `Tgt: ${formatPct(v.upsideToTargetPct)}` : null;
                const subtext = [fvPart, tgtPart].filter(Boolean).join(" · ");
                return (
                  <button
                    type="button"
                    key={item.ticker}
                    data-testid={`chip-${item.ticker}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      select(item, e.currentTarget.getBoundingClientRect());
                    }}
                    className={`text-xs px-2 py-1 rounded border ${chipClass} text-center flex flex-col gap-0.5 cursor-pointer`}
                  >
                    <span className="font-semibold">{item.ticker}</span>
                    {subtext && <span className="text-[10px] opacity-75 font-normal">{subtext}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {noCoverage.length > 0 && (
        <div data-testid="no-coverage-strip" className="mt-4 text-xs text-gray-500">
          No coverage: {noCoverage.join(", ")}
        </div>
      )}
      {selected && valuations[selected.ticker] && (
        <DetailPanel rect={rect} onClose={() => select(selected, rect!)}>
          <ChipDetail item={selected} v={valuations[selected.ticker]} />
        </DetailPanel>
      )}
    </section>
  );
}
