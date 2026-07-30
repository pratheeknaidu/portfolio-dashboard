export type FailureReason = "unlisted" | "timeout" | "no_price";

export interface QuoteFailure {
  ticker: string;
  reason: FailureReason;
}

/** Human wording for the failed-ticker strip. */
export const FAILURE_LABELS: Record<FailureReason, string> = {
  unlisted: "Not found",
  timeout: "Timed out",
  no_price: "No price",
};

/** What the user can actually do about it, per reason. */
export const FAILURE_HINTS: Record<FailureReason, string> = {
  unlisted: "Symbol may be delisted or misspelled.",
  timeout: "The quote service was slow. Retrying usually works.",
  no_price: "The symbol resolved but returned no price.",
};

/**
 * Map an upstream throw onto a reason the user can act on.
 *
 * `no_price` is the fallback rather than `unlisted` on purpose: telling someone
 * their holding does not exist is the one wrong answer that prompts them to
 * delete a position they should keep.
 */
export function classifyFailure(err: unknown): FailureReason {
  const message = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();

  if (message.includes("not found") || message.includes("delisted")) return "unlisted";
  if (
    message.includes("timeout") ||
    message.includes("etimedout") ||
    message.includes("aborted") ||
    message.includes("socket")
  ) {
    return "timeout";
  }
  return "no_price";
}
