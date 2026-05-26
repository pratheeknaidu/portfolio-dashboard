"use client";
import type { PortfolioItem, RecommendationKey, ValuationData } from "@/types";

interface Props {
  items: PortfolioItem[];
  valuations: Record<string, ValuationData>;
}

type BucketId = "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";

const BUCKETS: { id: BucketId; label: string; chipClass: string }[] = [
  { id: "strong_buy",  label: "Strong Buy",  chipClass: "bg-positive/30 text-positive border-positive/40" },
  { id: "buy",         label: "Buy",         chipClass: "bg-positive/15 text-positive/90 border-positive/25" },
  { id: "hold",        label: "Hold",        chipClass: "bg-surface-border text-gray-300 border-surface-border" },
  { id: "sell",        label: "Sell",        chipClass: "bg-negative/15 text-negative/90 border-negative/25" },
  { id: "strong_sell", label: "Strong Sell", chipClass: "bg-negative/30 text-negative border-negative/40" },
];

function bucketFor(key: RecommendationKey | undefined): BucketId | undefined {
  if (!key) return undefined;
  if (key === "underperform") return "strong_sell";
  return key;
}

export function AnalystSentimentCard({ items, valuations }: Props) {
  const bucketed: Record<BucketId, { item: PortfolioItem; v: ValuationData }[]> = {
    strong_buy: [], buy: [], hold: [], sell: [], strong_sell: [],
  };
  const noCoverage: string[] = [];

  for (const item of items) {
    const v = valuations[item.ticker];
    const b = bucketFor(v?.recommendationKey);
    if (b) bucketed[b].push({ item, v });
    else noCoverage.push(item.ticker);
  }

  for (const id of Object.keys(bucketed) as BucketId[]) {
    bucketed[id].sort((a, b) => {
      const am = a.v.recommendationMean ?? Number.POSITIVE_INFINITY;
      const bm = b.v.recommendationMean ?? Number.POSITIVE_INFINITY;
      if (am !== bm) return am - bm;
      return a.item.ticker.localeCompare(b.item.ticker);
    });
  }

  return (
    <section className="bg-surface-card rounded-lg p-6 border border-surface-border">
      <h2 className="text-lg font-semibold text-white mb-4">Analyst Sentiment</h2>
      <div className="flex flex-col gap-4 md:grid md:grid-cols-5 md:gap-2">
        {BUCKETS.map(({ id, label, chipClass }) => (
          <div key={id} data-testid={`bucket-${id}`} className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              {label} ({bucketed[id].length})
            </h3>
            <div className="flex flex-wrap gap-1.5 md:flex-col md:gap-1.5">
              {bucketed[id].map(({ item, v }) => (
                <span
                  key={item.ticker}
                  data-testid={`chip-${item.ticker}`}
                  title={
                    v.recommendationMean !== undefined
                      ? `Rec mean ${v.recommendationMean.toFixed(2)}${v.numberOfAnalystOpinions ? ` · ${v.numberOfAnalystOpinions} analysts` : ""}`
                      : item.ticker
                  }
                  className={`text-xs font-semibold px-2 py-1 rounded border ${chipClass} text-center`}
                >
                  {item.ticker}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {noCoverage.length > 0 && (
        <div data-testid="no-coverage-strip" className="mt-4 text-xs text-gray-500">
          No coverage: {noCoverage.join(", ")}
        </div>
      )}
    </section>
  );
}
