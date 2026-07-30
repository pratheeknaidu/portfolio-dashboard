"use client";
import { FAILURE_HINTS, FAILURE_LABELS } from "@/lib/quote-failures";
import { money } from "@/lib/design/format";
import type { QuoteFailure } from "@/types";

interface FailedTickersStripProps {
  failures: QuoteFailure[];
  /** Cost basis of the excluded positions, so the total is not silently wrong. */
  excludedValue: number;
  onRetry: (ticker: string) => void;
  onRemove: (ticker: string) => void;
}

/**
 * Slim inline notice above a working map — never a page takeover.
 *
 * Amber rather than red, and `role="status"` rather than `alert`: a few quotes
 * failing is a data problem, and dressing it in loss colouring makes the user
 * read it as money lost.
 */
export function FailedTickersStrip({
  failures,
  excludedValue,
  onRetry,
  onRemove,
}: FailedTickersStripProps) {
  if (failures.length === 0) return null;

  const n = failures.length;

  return (
    <div
      role="status"
      className="mb-3 rounded-lg border border-rd-warning-border bg-rd-warning-surface px-4 py-3"
    >
      <p className="text-xs text-rd-body">
        <span className="font-semibold text-rd-warning">
          {n} position{n === 1 ? "" : "s"} couldn&apos;t be priced
        </span>{" "}
        — the rest of the map is up to date. {money(excludedValue)} of cost basis is excluded
        from the totals above.
      </p>

      <ul className="mt-2.5 flex flex-wrap gap-2">
        {failures.map((f) => (
          <li
            key={f.ticker}
            title={FAILURE_HINTS[f.reason]}
            className="inline-flex items-center gap-2 rounded-md border border-rd-border-control bg-rd-control px-2 py-1"
          >
            <span className="font-mono text-xs font-semibold text-rd-text">{f.ticker}</span>
            <span className="font-mono text-[10px] text-rd-muted">{FAILURE_LABELS[f.reason]}</span>
            <button
              onClick={() => onRetry(f.ticker)}
              aria-label={`Retry ${f.ticker}`}
              className="rd-focusable rounded px-1 text-[11px] text-rd-muted hover:text-rd-text"
            >
              Retry
            </button>
            <button
              onClick={() => onRemove(f.ticker)}
              aria-label={`Remove ${f.ticker}`}
              className="rd-focusable rounded px-1 text-[11px] text-rd-muted hover:text-rd-text"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
