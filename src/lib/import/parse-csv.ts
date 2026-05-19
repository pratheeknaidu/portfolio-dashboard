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

/**
 * Robinhood Trans Codes that represent cash-only events (dividends, fees,
 * transfers, interest, etc.) — verified not to affect share counts.
 * Anything outside SHARE_CHANGING_CODES ∪ KNOWN_CASH_CODES will be
 * collected and surfaced to the user so new codes Robinhood starts
 * emitting don't get silently dropped if they actually matter.
 */
const KNOWN_CASH_CODES = new Set([
  "CDIV", // Cash dividend
  "DTAX", // Dividend tax withholding
  "MDIV", // Manufactured dividend (on shares lent out)
  "INT",  // Interest
  "ACH",  // ACH bank transfer
  "GOLD", // Robinhood Gold subscription fee
  "GMPC", // Gold plan credit
  "RTP",  // Real-time payment
  "ITRF", // Inter-brokerage transfer
  "SLIP", // Stock lending income payment
  "DFEE", // Day-trading / regulatory fee
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
 * Parse a Price or Amount cell. Strips "$" and ",", treats "(...)" as
 * negative (Robinhood's accounting-style negative). Handles "(-$X)" and
 * other paren+sign combinations defensively by stripping the paren wrap
 * before sign handling. Returns 0 for empty/invalid input.
 */
function parseMoney(raw: string | undefined): number {
  if (!raw) return 0;
  let s = raw.trim().replace(/[$,\s]/g, "");
  if (s.startsWith("(") && s.endsWith(")")) {
    // "(...)" → negative. Strip the parens; if the inner content also has
    // a leading "-" (e.g. "(-10)"), don't double-negate — just drop the
    // parens and rely on parseFloat to see the inner sign.
    const inner = s.slice(1, -1);
    s = inner.startsWith("-") ? inner : "-" + inner;
  }
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
      const sharesAfter = h.shares - tx.qty;
      if (sharesAfter < -SHARE_EPSILON) {
        // Oversell: Sell qty > available shares. Almost always means the
        // CSV is missing earlier Buys (history window truncated, or the
        // user transferred a position IN without a Buy row). Treat the
        // position as closed rather than letting negative shares + a
        // poisoned basis propagate into a later Buy.
        h.shares = 0;
        h.totalCost = 0;
      } else {
        h.shares = sharesAfter;
        h.totalCost -= tx.qty * avgCost;
        // Clamp residual near-zero values to exactly zero
        if (Math.abs(h.shares) < SHARE_EPSILON) {
          h.shares = 0;
          h.totalCost = 0;
        }
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
      // Do NOT clamp to zero on small residuals here — the share count is
      // transiently zero BETWEEN the S and non-S rows of a pair, and a
      // clamp would wipe out the cost basis before the incoming row
      // restores the position.
      //
      // However, an unbalanced SPR pair (outgoing row present but
      // incoming row missing due to a truncated export) would leave
      // shares strongly negative with cost basis preserved. Treat that
      // as a closed position so we don't write a phantom-negative
      // holding that the downstream filter just silently drops.
      h.shares += tx.qtyIsOutgoing ? -tx.qty : tx.qty;
      if (h.shares < -SHARE_EPSILON) {
        h.shares = 0;
        h.totalCost = 0;
      }
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
        if (!KNOWN_CASH_CODES.has(code)) {
          // A code we don't recognize at all — could be a new Robinhood
          // event type that affects shares. Surface it so we can decide
          // whether to handle it, instead of silently dropping the row.
          unhandledCodes.add(code);
        }
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

    // Step 4: final cleanup. Any ticker that ended at ~zero shares but
    // with a non-zero cost-basis residue is a closed position with stale
    // basis — typically from an unbalanced SPR pair (outgoing row with no
    // incoming) or a MRGS without our paired MRGC handling. Normalize to
    // an unambiguous closed position so the downstream filter and the
    // dashboard see (0, 0) consistently.
    for (const h of holdings.values()) {
      if (Math.abs(h.shares) < SHARE_EPSILON) {
        h.shares = 0;
        h.totalCost = 0;
      }
    }

    // Step 5: surface any unrecognized trans codes (e.g. new Robinhood codes
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
