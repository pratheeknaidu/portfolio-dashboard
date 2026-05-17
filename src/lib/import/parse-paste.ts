import type { ParsedHolding } from "./types";

/**
 * Robinhood positions paste format: each stock is 7 lines:
 *   Company Name, SYMBOL, shares, $price, $avgCost, $totalReturn, $equity
 * Header lines (Stocks, Name, Symbol, Shares, Price, Average cost, Total return,
 * Equity) appear at the top and are auto-skipped.
 */
const HEADER_WORDS = new Set([
  "stocks", "name", "symbol", "shares",
  "price", "average cost", "total return", "equity",
]);

export function parsePastedPositions(text: string): {
  holdings: Map<string, ParsedHolding>;
  errors: string[];
} {
  const holdings = new Map<string, ParsedHolding>();
  const errors: string[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let i = 0;
  while (i < lines.length && HEADER_WORDS.has(lines[i].toLowerCase())) i++;

  while (i + 6 < lines.length) {
    const companyName = lines[i];
    const ticker = lines[i + 1].toUpperCase();
    const sharesVal = parseFloat(lines[i + 2].replace(",", ""));
    const avgCost = parseFloat(lines[i + 4].replace("$", "").replace(",", ""));

    if (ticker && /^[A-Z.]+$/.test(ticker) && !isNaN(sharesVal) && sharesVal > 0 && !isNaN(avgCost)) {
      holdings.set(ticker, { ticker, shares: sharesVal, totalCost: sharesVal * avgCost, companyName });
      i += 7;
    } else {
      errors.push(`Could not parse near: ${companyName}`);
      i++;
    }
  }

  return { holdings, errors };
}
