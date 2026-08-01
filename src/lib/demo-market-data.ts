import { getQuotes, getChartCloses, type QuotesResult } from "@/lib/yahoo-finance";
import { getValuations } from "@/lib/yahoo-finance-valuations";
import { getMockQuotes } from "@/lib/yahoo-finance-mock";
import {
  DEMO_HOLDINGS,
  DEMO_TICKERS,
  DEMO_YAHOO_SYMBOL,
  DEMO_SNAPSHOTS,
  getDemoValuations,
} from "@/lib/demo-data";
import { portfolioHistory, type TickerCloses } from "@/lib/demo-history";
import type { Snapshot, TimeRange, ValuationData } from "@/types";

/** ~90 trading days of history; fetch a wider calendar window to cover it. */
const HISTORY_LOOKBACK_DAYS = 130;
const MIN_HISTORY_POINTS = 5;

/** Live quotes for the fixed demo set, or the mock fixture on any failure. */
export async function demoQuotes(range: TimeRange): Promise<QuotesResult> {
  try {
    return await getQuotes(DEMO_TICKERS, range);
  } catch {
    return { quotes: getMockQuotes(DEMO_TICKERS, range), failed: [] };
  }
}

/** Live valuations for the fixed demo set, or the fixture on any failure. */
export async function demoValuations(): Promise<Record<string, ValuationData>> {
  try {
    return await getValuations(DEMO_TICKERS);
  } catch {
    return getDemoValuations();
  }
}

/**
 * Real ~90-day performance history: Σ shares × historical close per day. Under
 * SANDBOX_MODE (and on any upstream failure or too-sparse result) it returns
 * the synthetic fixture, so sandbox/tests stay deterministic and the public
 * demo never renders an empty chart.
 */
export async function demoHistory(): Promise<Snapshot[]> {
  if (process.env.SANDBOX_MODE === "true") return DEMO_SNAPSHOTS;
  try {
    const period1 = new Date(Date.now() - HISTORY_LOOKBACK_DAYS * 86_400_000);
    const closes: TickerCloses = {};
    await Promise.all(
      DEMO_HOLDINGS.map(async (h) => {
        const symbol = DEMO_YAHOO_SYMBOL[h.ticker] ?? h.ticker;
        closes[h.ticker] = await getChartCloses(symbol, period1);
      }),
    );
    const series = portfolioHistory(DEMO_HOLDINGS, closes);
    return series.length >= MIN_HISTORY_POINTS ? series : DEMO_SNAPSHOTS;
  } catch {
    return DEMO_SNAPSHOTS;
  }
}
