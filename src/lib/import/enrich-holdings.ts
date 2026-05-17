import YahooFinance from "yahoo-finance2";
import { getMockSummary } from "@/lib/yahoo-finance-mock";

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
      try {
        const summary = await yahooFinance.quoteSummary(ticker, {
          modules: ["price", "summaryProfile"],
        });
        result[ticker] = {
          name: summary.price?.shortName ?? "",
          sector: summary.summaryProfile?.sector ?? "",
        };
      } catch {
        // Skip — caller treats absence as "not enriched"
      }
    }),
  );
  return result;
}
