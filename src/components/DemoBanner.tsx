"use client";
import Link from "next/link";

/**
 * Slim strip shown above the app in demo mode. Sets expectations (this is
 * sample data, not the visitor's own) and offers the one meaningful action —
 * sign in to use the real thing.
 */
export function DemoBanner() {
  return (
    <div className="relative z-40 flex items-center justify-center gap-x-3 gap-y-1 flex-wrap px-4 py-2 text-xs font-medium bg-rd-control text-rd-body border-b border-rd-border">
      <span>
        <span className="font-semibold text-rd-text">Demo</span> — you&rsquo;re
        exploring a sample portfolio with mock market data.
      </span>
      <Link
        href="/"
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold text-rd-text bg-rd-control border border-rd-border-strong hover:-translate-y-px transition-transform"
      >
        Sign in to track your own →
      </Link>
    </div>
  );
}
