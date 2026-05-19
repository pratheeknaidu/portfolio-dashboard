import Papa from "papaparse";
import type { ParsedHolding } from "./types";

/**
 * Floating-point share residuals smaller than this are treated as exactly zero.
 * Prevents the "divide-by-epsilon" trap where a long buy/sell history can
 * leave `shares` at 6e-16 and a subsequent sell computes
 * `costPerShare = totalCost / 6e-16 = 1e18`, producing a poisoned cost basis.
 *
 * 1e-6 = one millionth of a share — well below any real fractional position
 * (Robinhood fractionals are typically 1e-4 shares minimum).
 */
const SHARE_EPSILON = 1e-6;

/**
 * Robinhood Trans Code values that change a position's share count.
 * Anything not in this set is a cash event (CDIV, INT, ACH, GOLD, SLIP, ...)
 * and can be ignored for cost-basis tracking.
 */
const SHARE_CHANGING_CODES = new Set([
  "Buy",
  "Sell",
  "SPL",  // Stock split — adds shares, cost basis unchanged
  "REC",  // Receive (e.g. referral free share) — adds shares at $0 cost
  "MRGS", // Merger sent — outgoing shares (with "S" suffix on Quantity)
  "MRGC", // Merger cash received — cash-only, no share change
  "LIQ",  // Cash liquidation — closes the position
  "SPR",  // Spinoff / reissue — paired S (outgoing) + non-S (incoming) rows
]);

interface TxRow {
  date: Date;
  ticker: string;
  code: string;
  qty: number;
  qtyIsOutgoing: boolean;
  price: number;
  raw: Record<string, string>;
}

/**
 * Parse a Quantity cell. Robinhood uses an "S" suffix on MRGS/SPR rows to
 * indicate shares going OUT of the account (e.g. "3575S" = 3575 shares sent).
 * Returns { qty, isOutgoing } where qty is always positive.
 */
function parseQuantity(raw: string | undefined): { qty: number; isOutgoing: boolean } {
  if (!raw) return { qty: 0, isOutgoing: false };
  const s = raw.trim();
  const isOutgoing = s.endsWith("S");
  const num = parseFloat((isOutgoing ? s.slice(0, -1) : s).replace(/,/g, ""));
  return { qty: isNaN(num) ? 0 : num, isOutgoing };
}

/**
 * Parse a Price or Amount cell. Strips "$" and ",", treats "(...)" as negative.
 * Returns 0 for empty/invalid input.
 */
function parseMoney(raw: string | undefined): number {
  if (!raw) return 0;
  let s = raw.trim().replace(/[$,]/g, "");
  if (s.startsWith("(") && s.endsWith(")")) s = "-" + s.slice(1, -1);
  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse Robinhood's M/D/YYYY date format. Returns null on failure (which
 * sorts row to the end via Number.NaN fallback in the sort comparator).
 */
function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Apply one share-changing transaction to a running holding state.
 * Returns the mutated holding (same reference for in-place update).
 *
 * Cost-basis handling per trans code:
 * - Buy:  totalCost += qty * price; shares += qty
 * - Sell: realize avg cost on the sold shares; totalCost -= qty * avgCost
 * - SPL:  shares += qty (cost basis preserved; avg cost per share falls)
 * - REC:  shares += qty (free shares — no cost added)
 * - MRGS: position closes (shares = 0, totalCost = 0) — the cash recovered
 *         via the paired MRGC row realizes the original basis
 * - MRGC: no-op for share tracking (cash side; not reflected in holdings)
 * - LIQ:  position closes (shares = 0, totalCost = 0)
 * - SPR:  share swap — outgoing (S-suffix) subtracts, incoming adds;
 *         cost basis preserved
 */
function applyTransaction(h: ParsedHolding, tx: TxRow): void {
  switch (tx.code) {
    case "Buy": {
      h.totalCost += tx.qty * tx.price;
      h.shares += tx.qty;
      break;
    }
    case "Sell": {
      // Realize cost on the SOLD shares (qty * avg cost), not via the
      // shares-after-sell multiplication trick that explodes on epsilon.
      const avgCost = h.shares > SHARE_EPSILON ? h.totalCost / h.shares : 0;
      h.shares -= tx.qty;
      h.totalCost -= tx.qty * avgCost;
      // Clamp residual near-zero values to exactly zero
      if (Math.abs(h.shares) < SHARE_EPSILON) {
        h.shares = 0;
        h.totalCost = 0;
      }
      break;
    }
    case "SPL":
    case "REC": {
      // Adds shares without adding cost (split: same basis, more shares;
      // referral: free shares).
      h.shares += tx.qty;
      break;
    }
    case "SPR": {
      // Spinoff/reissue: paired rows, S-suffix = outgoing, plain = incoming.
      // Cost basis preserved; we just net the share count.
      // Do NOT clamp to zero here — the share count is transiently zero
      // BETWEEN the S and non-S rows of a pair, and clamping would wipe
      // out the cost basis before the incoming row restores the position.
      h.shares += tx.qtyIsOutgoing ? -tx.qty : tx.qty;
      break;
    }
    case "MRGS":
    case "LIQ": {
      // Position closed via merger or cash liquidation.
      h.shares = 0;
      h.totalCost = 0;
      break;
    }
    case "MRGC":
      // Cash-only side of a merger — no share-count change.
      break;
  }
}

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
    // Step 1: collect share-changing rows with parsed values
    const txs: TxRow[] = [];
    const unhandledCodes = new Set<string>();

    for (const row of data) {
      const ticker = (row["Instrument"] || "").trim().toUpperCase();
      const code = (row["Trans Code"] || "").trim();
      if (!ticker || !code) continue;

      if (!SHARE_CHANGING_CODES.has(code)) {
        // Track non-cash unknown codes only — CDIV/INT/etc. are expected
        // cash events and don't need to be flagged.
        continue;
      }

      const date = parseDate(row["Activity Date"]);
      const { qty, isOutgoing } = parseQuantity(row["Quantity"]);
      const price = Math.abs(parseMoney(row["Price"]));

      // Buy/Sell require a positive qty and price; SPL/REC/SPR require qty;
      // MRGS/MRGC/LIQ have no qty/price requirement.
      if ((code === "Buy" || code === "Sell") && (qty <= 0 || price <= 0)) {
        continue;
      }
      if ((code === "SPL" || code === "REC" || code === "SPR") && qty <= 0) {
        continue;
      }

      if (!date) {
        errors.push(`Skipping ${ticker} ${code} row with unparseable date: ${row["Activity Date"]}`);
        continue;
      }

      txs.push({ date, ticker, code, qty, qtyIsOutgoing: isOutgoing, price, raw: row });
    }

    // Step 2: sort chronologically (oldest first). This is the critical fix
    // for the "Sell before Buy" corruption — Robinhood exports newest-first.
    txs.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Step 3: apply each transaction in order
    for (const tx of txs) {
      const h = holdings.get(tx.ticker) || {
        ticker: tx.ticker,
        shares: 0,
        totalCost: 0,
        companyName: "",
      };
      applyTransaction(h, tx);
      holdings.set(tx.ticker, h);
    }

    // Step 4: surface any unrecognized trans codes (e.g. new Robinhood codes
    // we haven't classified yet) as informational warnings, not silent drops.
    if (unhandledCodes.size > 0) {
      errors.push(
        `Skipped rows with unrecognized trans codes: ${Array.from(unhandledCodes).sort().join(", ")}`,
      );
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
