"use client";
import type { PortfolioItem, RecommendationKey, ValuationData } from "@/types";
import { useDetailSelection } from "@/lib/use-detail-selection";
import { DetailPanel } from "@/components/ui/DetailPanel";
import { ChipDetail } from "@/components/ChipDetail";

interface Props {
  items: PortfolioItem[];
  valuations: Record<string, ValuationData>;
}

type BucketId = "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";

const BUCKETS: { id: BucketId; label: string; chipClass: string }[] = [
  { id: "strong_buy",  label: "Strong Buy",  chipClass: "bg-rd-gain/30 text-rd-gain border-rd-gain/40" },
  { id: "buy",         label: "Buy",         chipClass: "bg-rd-gain/15 text-rd-gain/90 border-rd-gain/25" },
  { id: "hold",        label: "Hold",        chipClass: "bg-rd-inset text-gray-300 border-rd-inset" },
  { id: "sell",        label: "Sell",        chipClass: "bg-rd-loss/15 text-rd-loss/90 border-rd-loss/25" },
  { id: "strong_sell", label: "Strong Sell", chipClass: "bg-rd-loss/30 text-rd-loss border-rd-loss/40" },
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

  const { selected, rect, select } = useDetailSelection<PortfolioItem>();

  return (
    <section className="bg-rd-card rounded-lg p-6 border border-rd-border">
      <h2 className="text-lg font-semibold text-white mb-4">Analyst Sentiment</h2>
      <div className="flex flex-col gap-4 md:grid md:grid-cols-5 md:gap-2">
        {BUCKETS.map(({ id, label, chipClass }) => (
          <div key={id} data-testid={`bucket-${id}`} className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              {label} ({bucketed[id].length})
            </h3>
            <div className="flex flex-wrap gap-1.5 md:flex-col md:gap-1.5">
              {bucketed[id].map(({ item }) => (
                <button
                  type="button"
                  key={item.ticker}
                  data-testid={`chip-${item.ticker}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    select(item, e.currentTarget.getBoundingClientRect());
                  }}
                  className={`text-xs font-semibold px-2 py-1 rounded border ${chipClass} text-center cursor-pointer`}
                >
                  {item.ticker}
                </button>
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
      {selected && valuations[selected.ticker] && (
        <DetailPanel rect={rect} onClose={() => select(selected, rect!)}>
          <ChipDetail item={selected} v={valuations[selected.ticker]} />
        </DetailPanel>
      )}
    </section>
  );
}
