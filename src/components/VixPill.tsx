"use client";
import { useEffect, useRef, useState } from "react";
import { VIX_BANDS, type VixApiResponse, type VixTone } from "@/lib/vix-sentiment";

// accumulate and opportunity are both bullish (green); the stronger signal
// (opportunity) gets a more saturated fill — not a copy-paste bug.
const TONE_STYLES: Record<VixTone, string> = {
  caution:     "bg-amber-500/10 text-amber-400 border-amber-500/30",
  neutral:     "bg-surface-elevated/60 text-muted-foreground border-border/60",
  accumulate:  "bg-positive/10 text-positive border-positive/30",
  opportunity: "bg-positive/20 text-positive border-positive/50",
};

const DISCLAIMER =
  "Heuristic based on VIX, the market's expected 30-day volatility. " +
  "Not financial advice — VIX reflects market mood, not your portfolio.";

export function VixPill({ data }: { data: VixApiResponse | null }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the popover on Escape or any click outside the pill. The click
  // listener is deferred one tick so the click that OPENED it doesn't
  // immediately close it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    const timer = window.setTimeout(
      () => document.addEventListener("click", onClick),
      0,
    );
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
      window.clearTimeout(timer);
    };
  }, [open]);

  if (!data || data.value == null) return null;

  const tone: VixTone = data.tone ?? "neutral";
  const message = data.message ?? data.sentiment ?? "";
  const title = `VIX ${data.value.toFixed(1)}${message ? ` — ${message}.` : "."} ${DISCLAIMER}`;

  return (
    <div ref={rootRef} className="relative inline-flex">
      {/* The whole chip is one button so a single tap target works on mobile
          (compact: value + tone color) and desktop (full: value + message +
          info icon) alike. The message and icon are md:-only adornments. */}
      <button
        type="button"
        aria-label={`VIX ${data.value.toFixed(1)}${message ? ` — ${message}` : ""}. Show how VIX maps to market sentiment`}
        aria-expanded={open}
        aria-controls="vix-band-scale"
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`inline-flex items-center gap-2 h-10 px-3 md:px-3.5 rounded-full text-xs font-medium tracking-wide border transition-colors ${TONE_STYLES[tone]}`}
      >
        <span className="font-semibold">VIX {data.value.toFixed(1)}</span>
        <span className="hidden opacity-50 md:inline">·</span>
        <span className="hidden md:inline">{message}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="ml-0.5 hidden h-3.5 w-3.5 opacity-60 md:inline-block"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>

      {open && (
        <div
          id="vix-band-scale"
          role="dialog"
          aria-modal="true"
          aria-label="How VIX maps to market sentiment"
          className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border/60 bg-surface-elevated p-4 text-left shadow-xl shadow-black/20"
        >
          <p className="font-display text-sm font-semibold text-foreground">
            How this reads the market
          </p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            VIX is the market&rsquo;s expected 30-day volatility — its &ldquo;fear
            gauge.&rdquo; This uses a contrarian lens: the more fear, the better the
            opportunity.
          </p>
          <table className="mt-3 w-full border-collapse text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 pr-2 text-left font-medium">VIX</th>
                <th className="py-1 pr-2 text-left font-medium">Mood</th>
                <th className="py-1 text-left font-medium">What I&rsquo;d do</th>
              </tr>
            </thead>
            <tbody>
              {VIX_BANDS.map((b) => {
                const active = b.band === data.band;
                return (
                  <tr
                    key={b.band}
                    className={
                      active
                        ? "bg-positive/10 font-semibold text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    <td className="whitespace-nowrap py-1 pr-2 tabular-nums">{b.band}</td>
                    <td className="whitespace-nowrap py-1 pr-2">{b.sentiment}</td>
                    <td className="whitespace-nowrap py-1">
                      {b.message}
                      {active && (
                        <span
                          aria-label="current band"
                          className="ml-1 text-positive"
                        >
                          ◀ now
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
            {DISCLAIMER}
          </p>
        </div>
      )}
    </div>
  );
}
