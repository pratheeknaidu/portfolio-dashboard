export interface Holding {
  ticker: string;
  companyName: string;
  sector: string;
  shares: number;
  avgCost: number;
  addedAt: string; // ISO timestamp
}

export interface Quote {
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  marketCap?: number;
}

export interface Snapshot {
  date: string;
  totalValue: number;
  holdings: Record<string, number>;
}

export interface PortfolioItem extends Holding {
  quote: Quote;
  marketValue: number;
  totalPL: number;
  totalPLPercent: number;
}

export type TimeRange = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";
export type SizingMode = "equity" | "profit";
export type AnalyticsRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "All";

export type RecommendationKey =
  | "strong_buy"
  | "buy"
  | "hold"
  | "sell"
  | "strong_sell"
  | "underperform";

export interface ValuationData {
  // Card 1 (Analyst Sentiment)
  recommendationKey?: RecommendationKey;
  recommendationMean?: number;       // 1.0 strongest buy → 5.0 strongest sell
  numberOfAnalystOpinions?: number;  // surfaced in tooltip only

  // Card 2 (Valuation)
  fairValueDescription?: "Undervalued" | "Near Fair Value" | "Overvalued";
  fairValueDiscountPct?: number;     // signed %; positive = below fair value
  fairValueProvider?: string;        // e.g. "Trading Central"
  targetMeanPrice?: number;
  currentPrice?: number;             // included so client can verify upside calc
  upsideToTargetPct?: number;        // (target - current) / current * 100

  valuationSource: "fair_value" | "analyst_target" | "both" | "none";
}
