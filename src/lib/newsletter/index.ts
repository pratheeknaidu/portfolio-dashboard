import type { Holding } from "@/types";
import { adminDb } from "@/lib/firebase-admin";
import { getQuotes } from "@/lib/yahoo-finance";
import { getValuations } from "@/lib/yahoo-finance-valuations";
import { mergeHoldingsWithQuotes } from "@/lib/design/merge-quotes";
import { BENCHMARK, SECTOR_ETFS, buildReport, type EtfMove, type NewsletterReport } from "./build-report";
import { writeNarrative } from "./narrative";
import { renderHtml, renderText, subjectFor } from "./render-email";

export interface Newsletter {
  report: NewsletterReport;
  narrative: string | null;
  /** Why the AI briefing is missing, when it is. */
  narrativeError?: string;
  subject: string;
  html: string;
  text: string;
}

const ETFS = [BENCHMARK, ...Object.values(SECTOR_ETFS)];

/** Sector ETF + benchmark moves. Shared across recipients — fetch once per run. */
export async function getEtfMoves(): Promise<Record<string, EtfMove>> {
  // getQuotes sorts its argument in place; hand it copies.
  const [day, month] = await Promise.all([getQuotes([...ETFS], "1D"), getQuotes([...ETFS], "1M")]);
  const moves: Record<string, EtfMove> = {};
  for (const etf of ETFS) {
    const d = day.quotes[etf];
    const m = month.quotes[etf];
    if (d && m) moves[etf] = { dayPct: d.changePercent, monthPct: m.changePercent };
  }
  return moves;
}

/** Builds one user's email. Returns null when they hold nothing. */
export async function buildNewsletter(
  uid: string,
  date: string,
  etfMoves: Record<string, EtfMove>,
): Promise<Newsletter | null> {
  const snap = await adminDb.collection("users").doc(uid).collection("holdings").get();
  const holdings = snap.docs.map((d) => d.data() as Holding);
  if (holdings.length === 0) return null;

  const tickers = holdings.map((h) => h.ticker);
  const [{ quotes, failed }, valuations] = await Promise.all([
    getQuotes([...tickers], "1D"),
    getValuations(tickers),
  ]);

  const items = mergeHoldingsWithQuotes(holdings, quotes, "1D");
  const report = buildReport({
    date,
    items,
    valuations,
    etfMoves,
    failedTickers: failed.map((f) => f.ticker),
  });
  const { text: narrative, error: narrativeError } = await writeNarrative(report);

  return {
    report,
    narrative,
    narrativeError,
    subject: subjectFor(report),
    html: renderHtml(report, narrative),
    text: renderText(report, narrative),
  };
}
