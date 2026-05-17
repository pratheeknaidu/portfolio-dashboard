import Papa from "papaparse";
import type { ParsedHolding } from "./types";

export function parseCsv(csvText: string): {
  holdings: Map<string, ParsedHolding>;
  errors: string[];
} {
  const holdings = new Map<string, ParsedHolding>();
  const errors: string[] = [];

  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const isTransactionHistory = data.length > 0 && "Trans Code" in data[0];

  if (isTransactionHistory) {
    for (const row of data) {
      const ticker = (row["Instrument"] || "").trim().toUpperCase();
      const transCode = (row["Trans Code"] || "").trim();
      if (!ticker || (transCode !== "Buy" && transCode !== "Sell")) continue;

      const qty = parseFloat(row["Quantity"] || "0");
      const price = parseFloat((row["Price"] || "0").replace("$", ""));
      if (isNaN(qty) || qty <= 0 || isNaN(price)) continue;

      const existing = holdings.get(ticker) || { ticker, shares: 0, totalCost: 0, companyName: "" };
      if (transCode === "Buy") {
        existing.totalCost += qty * price;
        existing.shares += qty;
      } else {
        const costPerShare = existing.shares > 0 ? existing.totalCost / existing.shares : 0;
        existing.shares -= qty;
        existing.totalCost = existing.shares * costPerShare;
      }
      holdings.set(ticker, existing);
    }
  } else {
    for (const row of data) {
      const ticker = (row["Instrument"] || row["Symbol"] || "").trim().toUpperCase();
      const shares = parseFloat(row["Quantity"] || "0");
      const avgCost = parseFloat((row["Average Cost"] || "0").replace("$", ""));
      if (!ticker || isNaN(shares) || shares <= 0) {
        errors.push(`Invalid row: ${JSON.stringify(row)}`);
        continue;
      }
      holdings.set(ticker, { ticker, shares, totalCost: shares * avgCost, companyName: "" });
    }
  }

  return { holdings, errors };
}
