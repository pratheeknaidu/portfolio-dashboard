import { adminDb } from "@/lib/firebase-admin";
import type { ParsedHolding } from "./types";
import type { TickerSummary } from "./enrich-holdings";

/**
 * Replace the user's holdings with `parsed`. Tickers present before but
 * absent from `parsed` are deleted; tickers in both are updated in place
 * (preserving their original addedAt via merge); new tickers get addedAt
 * stamped now. All deletes + writes commit in one WriteBatch so the
 * portfolio is never in a half-replaced state.
 *
 * MAX_HOLDINGS caps `parsed` at 200, so deletes + writes stay under
 * Firestore's 500-op batch limit even when the prior portfolio is full.
 */
export async function writeHoldings(
  uid: string,
  parsed: ParsedHolding[],
  summaries: Record<string, TickerSummary>,
): Promise<{ imported: string[]; updated: string[]; removed: string[] }> {
  const holdingsRef = adminDb.collection("users").doc(uid).collection("holdings");

  const existingSnap = await holdingsRef.get();
  const existingTickers = new Set(existingSnap.docs.map((d) => d.id));
  const parsedByTicker = new Map(
    parsed.filter((h) => h.shares > 0).map((h) => [h.ticker, h]),
  );

  const imported: string[] = [];
  const updated: string[] = [];
  const removed: string[] = [];

  const batch = adminDb.batch();
  const now = new Date().toISOString();

  for (const ticker of existingTickers) {
    if (!parsedByTicker.has(ticker)) {
      batch.delete(holdingsRef.doc(ticker));
      removed.push(ticker);
    }
  }

  for (const [ticker, h] of parsedByTicker) {
    const summary = summaries[ticker];
    const avgCost = h.totalCost / h.shares;
    const existed = existingTickers.has(ticker);

    const payload: Record<string, unknown> = {
      ticker,
      companyName: summary?.name || h.companyName || "",
      sector: summary?.sector || "",
      shares: h.shares,
      avgCost,
    };
    if (!existed) payload.addedAt = now;

    batch.set(holdingsRef.doc(ticker), payload, { merge: true });

    if (existed) updated.push(ticker);
    else imported.push(ticker);
  }

  await batch.commit();
  return { imported, updated, removed };
}
