import type { RecommendationKey, ValuationData } from "@/types";

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Tickers that should land in the no-coverage strip in the sandbox.
// Includes the ETFs the real Yahoo API also returns nothing for.
const NO_COVERAGE = new Set(["SPY", "QQQ", "VOO", "VTI", "IWM"]);

// Tickers that intentionally lack a Yahoo fair-value description so they route
// through path 2 (upsideToTargetPct threshold) in ValuationCard.bucketFor.
// The big-upside values here ensure they land in the "Deep Value" bucket,
// so the sandbox exercises that column.
const NO_FV_DESCRIPTION = new Set(["PLTR", "SNOW", "RKLB"]);

const REC_BUCKETS: RecommendationKey[] = ["strong_buy", "buy", "hold", "sell", "strong_sell"];
const FV_BUCKETS = ["Undervalued", "Near Fair Value", "Overvalued"] as const;

export function getMockValuations(tickers: string[]): Record<string, ValuationData> {
  const result: Record<string, ValuationData> = {};

  for (const ticker of tickers) {
    if (NO_COVERAGE.has(ticker)) continue; // omit entirely → "no coverage" on the client

    const h = hashString(ticker);
    const recKey = REC_BUCKETS[h % REC_BUCKETS.length];
    // recommendationMean roughly centered on the bucket midpoint with a deterministic offset.
    const meanCenter = REC_BUCKETS.indexOf(recKey) + 1;            // 1..5
    const meanOffset = ((h % 100) / 100 - 0.5) * 0.6;              // ±0.3
    const recommendationMean = +(meanCenter + meanOffset).toFixed(2);

    const currentPrice = 30 + (h % 470);
    const numberOfAnalystOpinions = 5 + (h % 40);

    if (NO_FV_DESCRIPTION.has(ticker)) {
      // Route through ValuationCard's path 2 → Deep Value bucket.
      const upsidePct = 26 + (h % 25); // +26..+50
      const targetMeanPrice = +(currentPrice * (1 + upsidePct / 100)).toFixed(2);
      result[ticker] = {
        recommendationKey: recKey,
        recommendationMean,
        numberOfAnalystOpinions,
        targetMeanPrice,
        targetLowPrice: +(targetMeanPrice * 0.85).toFixed(2),
        targetHighPrice: +(targetMeanPrice * 1.2).toFixed(2),
        currentPrice,
        upsideToTargetPct: +upsidePct.toFixed(2),
        valuationSource: "analyst_target",
      };
      continue;
    }

    const fvDesc = FV_BUCKETS[h % FV_BUCKETS.length];
    // Discount % roughly: Undervalued +5..+50, Near 0 ±10, Overvalued -5..-30.
    let fvDisc: number;
    if (fvDesc === "Undervalued") fvDisc = 5 + (h % 46);
    else if (fvDesc === "Overvalued") fvDisc = -(5 + (h % 26));
    else fvDisc = ((h % 21) - 10);

    // Targets land roughly in line with fvDisc magnitude but always sign-positive for "Undervalued" etc.
    const upsidePct = fvDesc === "Undervalued" ? 10 + (h % 30) : fvDesc === "Overvalued" ? -(5 + (h % 25)) : (h % 21) - 10;
    const targetMeanPrice = +(currentPrice * (1 + upsidePct / 100)).toFixed(2);

    result[ticker] = {
      recommendationKey: recKey,
      recommendationMean,
      numberOfAnalystOpinions,
      fairValueDescription: fvDesc,
      fairValueDiscountPct: fvDisc,
      fairValueProvider: "Trading Central (mock)",
      targetMeanPrice,
      targetLowPrice: +(targetMeanPrice * 0.85).toFixed(2),
      targetHighPrice: +(targetMeanPrice * 1.2).toFixed(2),
      currentPrice,
      upsideToTargetPct: +upsidePct.toFixed(2),
      valuationSource: "both",
    };
  }

  return result;
}
