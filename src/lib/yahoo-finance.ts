import YahooFinance from "yahoo-finance2";
import type { Quote, TimeRange } from "@/types";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const CACHE_TTL = 60_000; // 60 seconds
const cache = new Map<string, { data: Record<string, Quote>; timestamp: number }>();

export function clearCache() {
  cache.clear();
}

function rangeToDate(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case "1W": { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    case "1M": { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d; }
    case "YTD": return new Date(now.getFullYear(), 0, 1);
    default: { const d = new Date(now); d.setDate(d.getDate() - 1); return d; }
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

  // Fetch each ticker individually to avoid one bad ticker breaking the batch
  await Promise.allSettled(
    tickers.map(async (ticker) => {
      try {
        const q = await yahooFinance.quote(ticker);
        if (q && q.regularMarketPrice) {
          results[q.symbol] = {
            price: q.regularMarketPrice,
            change: q.regularMarketChange ?? 0,
            changePercent: q.regularMarketChangePercent ?? 0,
            previousClose: q.regularMarketPreviousClose ?? 0,
          };
        }
      } catch {
        // Skip tickers that fail validation
      }
    })
  );

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
