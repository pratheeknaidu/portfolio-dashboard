"use client";

interface Props {
  onImportClick: () => void;
}

export function EmptyPortfolio({ onImportClick }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-16 h-16 rounded-full bg-surface-card border border-surface-border flex items-center justify-center mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-400"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="8" height="8" rx="1" />
          <rect x="13" y="3" width="8" height="5" rx="1" />
          <rect x="13" y="10" width="8" height="11" rx="1" />
          <rect x="3" y="13" width="8" height="8" rx="1" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">No holdings yet</h2>
      <p className="text-sm text-gray-400 mb-6 max-w-sm">
        Import your portfolio from Robinhood to see your positions as a heat map.
      </p>
      <button
        onClick={onImportClick}
        className="px-5 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-dark transition"
      >
        Import holdings
      </button>
    </div>
  );
}
