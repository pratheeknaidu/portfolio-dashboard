import { parsePastedPositions } from "./parse-paste";
import { parseCsv } from "./parse-csv";
import { enrichHoldings } from "./enrich-holdings";
import { writeHoldings } from "./write-holdings";
import { ImportError, type ImportInput, type ImportResult } from "./types";

export const MAX_HOLDINGS = 200;

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

  const parsed = Array.from(holdings.values()).filter((h) => h.shares > 0);
  if (parsed.length === 0) {
    return { imported: [], updated: [], removed: [], errors };
  }

  const summaries = await enrichHoldings(parsed.map((h) => h.ticker));
  const { imported, updated, removed } = await writeHoldings(uid, parsed, summaries);

  return { imported, updated, removed, errors };
}

export { ImportError } from "./types";
export type { ImportInput, ImportResult } from "./types";
