import YahooFinance from "yahoo-finance2";
import type { Quote, TimeRange } from "@/types";
import { getMockQuotes, getMockVix } from "./yahoo-finance-mock";
import { candidateSymbols } from "./symbols";
import { classifyFailure, type FailureReason, type QuoteFailure } from "./quote-failures";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface QuotesResult {
  quotes: Record<string, Quote>;
  failed: QuoteFailure[];
}

const CACHE_TTL = 60_000; // 60 seconds
const cache = new Map<string, { data: QuotesResult; timestamp: number }>();

export interface VixResult {
  value: number;
  previousClose: number;
}

const vixCache = new Map<string, { data: VixResult; timestamp: number }>();
const VIX_CACHE_KEY = "__VIX__";

export function clearCache() {
  cache.clear();
  vixCache.clear();
}

export async function getVix(): Promise<VixResult | null> {
  if (process.env.SANDBOX_MODE === "true") {
    return getMockVix();
  }

  const cached = vixCache.get(VIX_CACHE_KEY);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const q = await yahooFinance.quote("^VIX");
    if (q && typeof q.regularMarketPrice === "number") {
      const data: VixResult = {
        value: q.regularMarketPrice,
        previousClose: q.regularMarketPreviousClose ?? q.regularMarketPrice,
      };
      vixCache.set(VIX_CACHE_KEY, { data, timestamp: Date.now() });
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

function rangeToDate(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case "1W": { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    case "1M": { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d; }
    case "3M": { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d; }
    case "YTD": return new Date(now.getFullYear(), 0, 1);
    case "1Y": { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d; }
    default: { const d = new Date(now); d.setDate(d.getDate() - 1); return d; }
  }
}

export async function getQuotes(
  tickers: string[],
  range: TimeRange = "1D"
): Promise<QuotesResult> {
  if (process.env.SANDBOX_MODE === "true") {
    return { quotes: getMockQuotes(tickers, range), failed: [] };
  }

  const cacheKey = `${tickers.sort().join(",")}_${range}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const quotes: Record<string, Quote> = {};
  // Maps the requested ticker → the Yahoo symbol that actually resolved it
  // (e.g. "ETC" → "ETC-USD"), so the chart pass below fetches history for the
  // same symbol the spot quote came from.
  const resolvedSymbol: Record<string, string> = {};
  // Reason from the most recent candidate's throw, per ticker. A ticker can
  // pick up an entry here and still end up with a quote (candidate 1 throws,
  // candidate 2 resolves) — that is expected and handled below: this map is
  // only consulted for tickers that have no quote once the whole loop is
  // done, so a since-resolved ticker's stale entry is simply never read.
  const lastFailureReason: Record<string, FailureReason> = {};

  // Fetch each ticker individually to avoid one bad ticker breaking the batch.
  await Promise.allSettled(
    tickers.map(async (ticker) => {
      for (const symbol of candidateSymbols(ticker)) {
        try {
          const q = await yahooFinance.quote(symbol);
          if (q && q.regularMarketPrice) {
            // Key by the requested ticker, not q.symbol: the client looks
            // quotes up by the holding's ticker (the bare "ETC"), and the
            // crypto fallback resolves under a different symbol ("ETC-USD").
            quotes[ticker] = {
              price: q.regularMarketPrice,
              change: q.regularMarketChange ?? 0,
              changePercent: q.regularMarketChangePercent ?? 0,
              previousClose: q.regularMarketPreviousClose ?? 0,
            };
            resolvedSymbol[ticker] = symbol;
            return;
          }
        } catch (err) {
          // Record the reason but keep trying the next candidate symbol (e.g.
          // the -USD crypto pair) — this ticker may still resolve.
          lastFailureReason[ticker] = classifyFailure(err);
        }
      }
    })
  );

  if (range !== "1D") {
    const startDate = rangeToDate(range);
    await Promise.allSettled(
      tickers.map(async (ticker) => {
        if (!quotes[ticker]) return;
        try {
          const chart = await yahooFinance.chart(resolvedSymbol[ticker], { period1: startDate });
          if (chart.quotes.length > 0) {
            const startPrice = chart.quotes[0].close!;
            const currentPrice = quotes[ticker].price;
            quotes[ticker].change = currentPrice - startPrice;
            quotes[ticker].changePercent = ((currentPrice - startPrice) / startPrice) * 100;
          }
        } catch {
          // Keep the 1D values as fallback
        }
      })
    );
  }

  // A ticker with no quote and no recorded throw resolved (candidate did not
  // throw) but carried a falsy regularMarketPrice — that's the no_price case.
  const failed: QuoteFailure[] = tickers
    .filter((t) => !quotes[t])
    .map((ticker) => ({ ticker, reason: lastFailureReason[ticker] ?? "no_price" }));
  const result: QuotesResult = { quotes, failed };
  cache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

/**
 * Daily closes for a symbol back to `period1`, normalised to `{ date, close }`.
 * The one place chart history is fetched, so the yahoo-finance2 instance and
 * its typing stay with the other Yahoo calls.
 */
export async function getChartCloses(
  symbol: string,
  period1: Date,
): Promise<{ date: string; close: number }[]> {
  const chart = await yahooFinance.chart(symbol, { period1 });
  return chart.quotes
    .filter((q) => q.close != null && q.date != null)
    .map((q) => ({
      date: new Date(q.date).toISOString().split("T")[0],
      close: q.close as number,
    }));
}
