"use client";
import type { VixApiResponse, VixTone } from "@/lib/vix-sentiment";

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
  if (!data || data.value == null) return null;

  const tone: VixTone = data.tone ?? "neutral";
  const title = `VIX ${data.value.toFixed(1)} · ${data.sentiment} — ${data.action}. ${DISCLAIMER}`;

  return (
    <span
      title={title}
      className={`hidden md:inline-flex items-center gap-2 h-10 px-3.5 rounded-full text-xs font-medium tracking-wide border ${TONE_STYLES[tone]}`}
    >
      <span className="font-semibold">VIX {data.value.toFixed(1)}</span>
      <span className="opacity-50">·</span>
      <span>{data.sentiment}</span>
    </span>
  );
}
