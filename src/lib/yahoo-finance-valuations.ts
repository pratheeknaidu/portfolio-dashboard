import YahooFinance from "yahoo-finance2";
import type { RecommendationKey, ValuationData } from "@/types";
import { getMockValuations } from "./yahoo-finance-valuations-mock";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const cache = new Map<string, { data: Record<string, ValuationData>; timestamp: number }>();
const CACHE_TTL = 60_000;

export function clearCache() {
  cache.clear();
}

export function parseFairValueDiscount(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const match = trimmed.match(/^([+-]?\d+(?:\.\d+)?)\s*%$/);
  if (!match) return undefined;
  const n = parseFloat(match[1]);
  return Number.isFinite(n) ? n : undefined;
}

const FV_DESCRIPTIONS = ["Undervalued", "Near Fair Value", "Overvalued"] as const;
type FvDescription = (typeof FV_DESCRIPTIONS)[number];

function normalizeFvDescription(raw: unknown): FvDescription | undefined {
  if (typeof raw !== "string") return undefined;
  return (FV_DESCRIPTIONS as readonly string[]).includes(raw) ? (raw as FvDescription) : undefined;
}

const REC_KEYS: RecommendationKey[] = ["strong_buy", "buy", "hold", "sell", "strong_sell", "underperform"];

function normalizeRecKey(raw: unknown): RecommendationKey | undefined {
  if (typeof raw !== "string") return undefined;
  return REC_KEYS.includes(raw as RecommendationKey) ? (raw as RecommendationKey) : undefined;
}

async function fetchOne(ticker: string): Promise<ValuationData | undefined> {
  const [insightsRes, summaryRes] = await Promise.allSettled([
    yahooFinance.insights(ticker),
    yahooFinance.quoteSummary(ticker, { modules: ["financialData"] }),
  ]);

  const data: ValuationData = { valuationSource: "none" };
  let touched = false;

  if (insightsRes.status === "fulfilled") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (insightsRes.value as any)?.instrumentInfo?.valuation;
    if (val) {
      const desc = normalizeFvDescription(val.description);
      if (desc) {
        data.fairValueDescription = desc;
        touched = true;
      }
      const discount = parseFairValueDiscount(val.discount);
      if (discount !== undefined) {
        data.fairValueDiscountPct = discount;
        touched = true;
      }
      if (typeof val.provider === "string") {
        data.fairValueProvider = val.provider;
        touched = true;
      }
    }
  }

  if (summaryRes.status === "fulfilled") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = (summaryRes.value as any)?.financialData;
    if (fd) {
      const key = normalizeRecKey(fd.recommendationKey);
      if (key) {
        data.recommendationKey = key;
        touched = true;
      }
      if (typeof fd.recommendationMean === "number") {
        data.recommendationMean = fd.recommendationMean;
        touched = true;
      }
      if (typeof fd.numberOfAnalystOpinions === "number") {
        data.numberOfAnalystOpinions = fd.numberOfAnalystOpinions;
        touched = true;
      }
      if (typeof fd.targetMeanPrice === "number") {
        data.targetMeanPrice = fd.targetMeanPrice;
        touched = true;
      }
      if (typeof fd.targetLowPrice === "number") {
        data.targetLowPrice = fd.targetLowPrice;
        touched = true;
      }
      if (typeof fd.targetHighPrice === "number") {
        data.targetHighPrice = fd.targetHighPrice;
        touched = true;
      }
      if (typeof fd.currentPrice === "number") {
        data.currentPrice = fd.currentPrice;
        touched = true;
      }
      if (data.targetMeanPrice !== undefined && data.currentPrice && data.currentPrice > 0) {
        data.upsideToTargetPct = ((data.targetMeanPrice - data.currentPrice) / data.currentPrice) * 100;
      }
    }
  }

  if (!touched) return undefined;

  const hasFv = data.fairValueDescription !== undefined;
  const hasTarget = data.upsideToTargetPct !== undefined;
  if (hasFv && hasTarget) data.valuationSource = "both";
  else if (hasFv) data.valuationSource = "fair_value";
  else if (hasTarget) data.valuationSource = "analyst_target";
  else data.valuationSource = "none";

  return data;
}

export async function getValuations(tickers: string[]): Promise<Record<string, ValuationData>> {
  if (process.env.SANDBOX_MODE === "true") {
    return getMockValuations(tickers);
  }

  const cacheKey = [...tickers].sort().join(",") + "_valuations";
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const results: Record<string, ValuationData> = {};

  await Promise.allSettled(
    tickers.map(async (ticker) => {
      try {
        const data = await fetchOne(ticker);
        if (data) results[ticker] = data;
      } catch {
        // Defensive — fetchOne already swallows per-call rejections.
      }
    })
  );

  cache.set(cacheKey, { data: results, timestamp: Date.now() });
  return results;
}
