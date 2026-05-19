import { parsePastedPositions } from "./parse-paste";
import { parseCsv } from "./parse-csv";
import { enrichHoldings } from "./enrich-holdings";
import { writeHoldings } from "./write-holdings";
import { ImportError, type ImportInput, type ImportResult } from "./types";

export const MAX_HOLDINGS = 200;

/** Match parse-csv's epsilon so closed positions don't leak through. */
const SHARE_EPSILON = 1e-6;

/** Sanity ceiling: no real equity is priced at $1M/share. Anything above
 *  this avg cost means cost-basis tracking has gone wrong upstream. */
const MAX_REASONABLE_AVG_COST = 1_000_000;

export async function importHoldings(uid: string, input: ImportInput): Promise<ImportResult> {
  const { holdings, errors } =
    input.pasteText !== undefined ? parsePastedPositions(input.pasteText)
    : input.csvText !== undefined ? parseCsv(input.csvText)
    : (() => { throw new ImportError("No input provided", 400); })();

  if (holdings.size > MAX_HOLDINGS) {
    throw new ImportError(
      `Too many holdings (${holdings.size}). Maximum is ${MAX_HOLDINGS}.`,
      400,
    );
  }

  const parsed = Array.from(holdings.values()).filter((h) => {
    if (h.shares <= SHARE_EPSILON) return false;
    const avgCost = h.totalCost / h.shares;
    if (!isFinite(avgCost) || Math.abs(avgCost) > MAX_REASONABLE_AVG_COST) {
      errors.push(
        `Dropping ${h.ticker}: computed avg cost ${avgCost.toExponential(2)} is implausible — ` +
        `transaction history may contain unsupported events.`,
      );
      return false;
    }
    return true;
  });
  if (parsed.length === 0) {
    return { imported: [], updated: [], removed: [], errors };
  }

  const summaries = await enrichHoldings(parsed.map((h) => h.ticker));
  const { imported, updated, removed } = await writeHoldings(uid, parsed, summaries);

  return { imported, updated, removed, errors };
}

export { ImportError } from "./types";
export type { ImportInput, ImportResult } from "./types";
