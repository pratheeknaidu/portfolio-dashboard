/**
 * Yahoo Finance quotes crypto under a `-USD` pair (Ethereum Classic is
 * `ETC-USD`, Bitcoin is `BTC-USD`), but Robinhood exports — and we therefore
 * store — crypto holdings as the bare symbol (`ETC`). A bare lookup for a
 * crypto symbol returns no equity, so the holding can never be quoted.
 *
 * We can't reliably tell crypto from equity at import time (Robinhood's symbol
 * column doesn't flag it, and there's no static list worth maintaining), so we
 * defer the decision to lookup time: try the symbol as-is first — real equities
 * win — and fall back to the `-USD` pair only when the bare lookup yields
 * nothing.
 *
 * Only pure-alphanumeric symbols get the fallback. Anything already carrying a
 * separator (`BRK.B`, `BRK-B`, `ETC-USD`) or a prefix (`^VIX`) is never a bare
 * Robinhood crypto symbol, so appending `-USD` would only waste a request.
 */
export function candidateSymbols(ticker: string): string[] {
  if (/^[A-Z0-9]+$/.test(ticker)) {
    return [ticker, `${ticker}-USD`];
  }
  return [ticker];
}
