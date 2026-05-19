"use client";

interface Props {
  tickers: string[];
  onRetry?: () => void;
}

export function FailedTickersChip({ tickers, onRetry }: Props) {
  if (tickers.length === 0) return null;
  const preview = tickers.slice(0, 5).join(", ");
  const more = tickers.length > 5 ? ` +${tickers.length - 5} more` : "";
  return (
    <div
      role="alert"
      className="flex items-center gap-3 px-3 py-2 mb-3 bg-loss/10 border border-loss/40 rounded-md text-xs text-loss"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span className="flex-1">
        Couldn&apos;t load {tickers.length === 1 ? "quote" : "quotes"} for{" "}
        <span className="font-medium">
          {preview}
          {more}
        </span>
        . These tickers are excluded from the heat map.
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-2 py-0.5 border border-loss/60 rounded hover:bg-loss/20 transition"
        >
          Retry
        </button>
      )}
    </div>
  );
}
