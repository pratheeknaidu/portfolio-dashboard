import YahooFinance from "yahoo-finance2";
import { getMockSummary } from "@/lib/yahoo-finance-mock";
import { candidateSymbols } from "@/lib/symbols";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface TickerSummary {
  name: string;
  sector: string;
}

/**
 * Look up companyName + sector for each ticker. Parallelized via Promise.allSettled
 * so one slow/failing ticker doesn't block the batch. Returns a partial map —
 * tickers that failed enrichment are simply absent from the result.
 */
export async function enrichHoldings(tickers: string[]): Promise<Record<string, TickerSummary>> {
  if (process.env.SANDBOX_MODE === "true") {
    return Object.fromEntries(tickers.map((t) => [t, getMockSummary(t)]));
  }

  const result: Record<string, TickerSummary> = {};
  await Promise.allSettled(
    tickers.map(async (ticker) => {
      // Try the bare symbol first, then the -USD crypto pair, mirroring how
      // getQuotes resolves crypto symbols (e.g. "ETC" → "ETC-USD"). Keyed by
      // the requested ticker so the holding's bare symbol stays the doc id.
      for (const symbol of candidateSymbols(ticker)) {
        try {
          const summary = await yahooFinance.quoteSummary(symbol, {
            modules: ["price", "summaryProfile"],
          });
          result[ticker] = {
            name: summary.price?.shortName ?? "",
            sector: summary.summaryProfile?.sector ?? "",
          };
          return;
        } catch {
          // Try the next candidate; absence means "not enriched" to the caller.
        }
      }
    }),
  );
  return result;
}
