import type { Quote, TimeRange } from "@/types";

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function priceAt(ticker: string, daysAgo: number): number {
  const h = hashString(ticker);
  const base = 30 + (h % 470);
  const dayIndex = Math.floor(Date.now() / 86_400_000) - daysAgo;
  const slow = Math.sin(dayIndex * 0.013 + h * 0.001) * 0.08;
  const med = Math.sin(dayIndex * 0.07 + h * 0.003) * 0.04;
  const fast = Math.sin(dayIndex * 0.31 + h * 0.005) * 0.02;
  const driftPerDay = ((h % 11) - 5) / 10_000;
  const drift = 1 + driftPerDay * (dayIndex - 20_000);
  return Math.max(1, base * drift * (1 + slow + med + fast));
}

function rangeToDaysAgo(range: TimeRange): number {
  switch (range) {
    case "1W": return 7;
    case "1M": return 30;
    case "3M": return 91;
    case "YTD": {
      const now = new Date();
      const jan1 = new Date(now.getFullYear(), 0, 1);
      return Math.floor((now.getTime() - jan1.getTime()) / 86_400_000);
    }
    case "1Y": return 365;
    default: return 1;
  }
}

const KNOWN: Record<string, { name: string; sector: string }> = {
  AAPL:  { name: "Apple Inc.",            sector: "Technology" },
  MSFT:  { name: "Microsoft Corp.",       sector: "Technology" },
  GOOGL: { name: "Alphabet Inc.",         sector: "Technology" },
  AMZN:  { name: "Amazon.com Inc.",       sector: "Consumer Cyclical" },
  NVDA:  { name: "NVIDIA Corp.",          sector: "Technology" },
  JPM:   { name: "JPMorgan Chase",        sector: "Financial Services" },
  JNJ:   { name: "Johnson & Johnson",     sector: "Healthcare" },
  XOM:   { name: "Exxon Mobil Corp.",     sector: "Energy" },
  TSLA:  { name: "Tesla Inc.",            sector: "Consumer Cyclical" },
  META:  { name: "Meta Platforms",        sector: "Communication Services" },
  BRK:   { name: "Berkshire Hathaway",    sector: "Financial Services" },
  V:     { name: "Visa Inc.",             sector: "Financial Services" },
  UNH:   { name: "UnitedHealth Group",    sector: "Healthcare" },
  PG:    { name: "Procter & Gamble",      sector: "Consumer Defensive" },
  KO:    { name: "Coca-Cola Co.",         sector: "Consumer Defensive" },
  NEE:   { name: "NextEra Energy",        sector: "Utilities" },
  CAT:   { name: "Caterpillar Inc.",      sector: "Industrials" },
  HD:    { name: "Home Depot Inc.",       sector: "Consumer Cyclical" },
  PLD:   { name: "Prologis Inc.",         sector: "Real Estate" },
  NFLX:  { name: "Netflix Inc.",          sector: "Communication Services" },
};

export function getMockQuotes(
  tickers: string[],
  range: TimeRange = "1D",
): Record<string, Quote> {
  const daysAgo = rangeToDaysAgo(range);
  const result: Record<string, Quote> = {};
  for (const ticker of tickers) {
    const price = priceAt(ticker, 0);
    const prev = priceAt(ticker, daysAgo);
    result[ticker] = {
      price,
      change: price - prev,
      changePercent: ((price - prev) / prev) * 100,
      previousClose: priceAt(ticker, 1),
    };
  }
  return result;
}

export function getMockSummary(ticker: string): { name: string; sector: string } {
  return KNOWN[ticker] ?? { name: `${ticker} Inc.`, sector: "Unknown" };
}

export function getMockVix(): { value: number; previousClose: number } {
  return { value: 18.4, previousClose: 17.9 };
}
