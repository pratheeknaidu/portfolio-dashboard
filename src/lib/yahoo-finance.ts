import yahooFinance from "yahoo-finance2";
import type { Quote, TimeRange } from "@/types";

const CACHE_TTL = 60_000; // 60 seconds
const cache = new Map<string, { data: Record<string, Quote>; timestamp: number }>();

export function clearCache() {
  cache.clear();
}

function rangeToDate(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case "1W": return new Date(now.setDate(now.getDate() - 7));
    case "1M": return new Date(now.setMonth(now.getMonth() - 1));
    case "YTD": return new Date(now.getFullYear(), 0, 1);
    default: return new Date(now.setDate(now.getDate() - 1));
  }
}

export async function getQuotes(
  tickers: string[],
  range: TimeRange = "1D"
): Promise<Record<string, Quote>> {
  const cacheKey = `${tickers.sort().join(",")}_${range}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const results: Record<string, Quote> = {};

  const quotes = await yahooFinance.quote(tickers);
  const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

  for (const q of quotesArray) {
    results[q.symbol] = {
      price: q.regularMarketPrice,
      change: q.regularMarketChange ?? 0,
      changePercent: q.regularMarketChangePercent ?? 0,
      previousClose: q.regularMarketPreviousClose ?? 0,
    };
  }

  if (range !== "1D") {
    const startDate = rangeToDate(range);
    for (const ticker of tickers) {
      try {
        const history = await yahooFinance.historical(ticker, {
          period1: startDate,
          interval: "1d",
        });
        if (history.length > 0) {
          const startPrice = history[0].close;
          const currentPrice = results[ticker].price;
          results[ticker].change = currentPrice - startPrice;
          results[ticker].changePercent = ((currentPrice - startPrice) / startPrice) * 100;
        }
      } catch {
        // Keep the 1D values as fallback
      }
    }
  }

  cache.set(cacheKey, { data: results, timestamp: Date.now() });
  return results;
}
