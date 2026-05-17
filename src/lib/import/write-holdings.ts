import { adminDb } from "@/lib/firebase-admin";
import type { ParsedHolding } from "./types";
import type { TickerSummary } from "./enrich-holdings";

/**
 * Atomically write all holdings for a user. Reads existing docs first to
 * differentiate imported vs. updated, then commits in a single WriteBatch
 * so the operation either fully succeeds or fully fails — no partial state.
 */
export async function writeHoldings(
  uid: string,
  parsed: ParsedHolding[],
  summaries: Record<string, TickerSummary>,
): Promise<{ imported: string[]; updated: string[] }> {
  const holdingsRef = adminDb.collection("users").doc(uid).collection("holdings");
  const imported: string[] = [];
  const updated: string[] = [];

  const existingSnaps = await Promise.all(
    parsed.map((h) => holdingsRef.doc(h.ticker).get()),
  );

  const batch = adminDb.batch();
  const now = new Date().toISOString();

  parsed.forEach((h, i) => {
    if (h.shares <= 0) return;

    const summary = summaries[h.ticker];
    const avgCost = h.totalCost / h.shares;
    const payload: Record<string, unknown> = {
      ticker: h.ticker,
      companyName: summary?.name || h.companyName || "",
      sector: summary?.sector || "",
      shares: h.shares,
      avgCost,
    };

    const exists = existingSnaps[i].exists;
    if (!exists) payload.addedAt = now;

    batch.set(holdingsRef.doc(h.ticker), payload, { merge: true });

    if (exists) updated.push(h.ticker);
    else imported.push(h.ticker);
  });

  await batch.commit();
  return { imported, updated };
}
