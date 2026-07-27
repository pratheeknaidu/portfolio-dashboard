/**
 * U+2212 MINUS SIGN, not U+002D HYPHEN-MINUS.
 *
 * In a tabular-figures font the minus sign shares an advance width with the
 * digits; a hyphen does not. Using a hyphen knocks every negative number half a
 * pixel out of column in a right-aligned table.
 */
export const MINUS = "−";

function group(v: number, dp: number): string {
  return Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

/** `$155,876.26` / `−$60.97`. Two decimals unless overridden. */
export function money(v: number, dp = 2): string {
  return `${v < 0 ? `${MINUS}$` : "$"}${group(v, dp)}`;
}

/** `+$80.92` / `−$60.97`. Zero reads as a gain. */
export function signedMoney(v: number, dp = 2): string {
  return `${v < 0 ? `${MINUS}$` : "+$"}${group(v, dp)}`;
}

/** `+0.06%` / `−1.20%`. Always two decimals. */
export function signedPct(v: number): string {
  return `${v < 0 ? MINUS : "+"}${Math.abs(v).toFixed(2)}%`;
}

/**
 * `$165k`. The ONLY place in the product where a number may be abbreviated —
 * chart axis labels, where the precise value is available on hover anyway.
 */
export function axisMoney(v: number): string {
  const sign = v < 0 ? MINUS : "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}
