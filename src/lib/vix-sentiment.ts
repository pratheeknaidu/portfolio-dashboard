export type VixStrength =
  | "none" | "weak" | "building" | "strong" | "very-strong" | "strongest";

// One value per visual stop so the pill color is fully determined by this
// field — no band-string parsing in the component.
export type VixTone = "caution" | "neutral" | "accumulate" | "opportunity";

export interface VixSentiment {
  band: string;        // e.g. "18–22"
  sentiment: string;   // mood word, e.g. "Watchful"
  action: string;      // terse recommendation, e.g. "Mild buy · accumulate"
  message: string;     // conversational, user-facing guidance, e.g. "Ease in here"
  strength: VixStrength;
  tone: VixTone;
}

// Wire shape returned by GET /api/market/vix and consumed by VixPill.
export interface VixApiResponse {
  value: number | null;
  previousClose?: number;
  band?: string;
  sentiment?: string;
  action?: string;
  message?: string;
  strength?: VixStrength;
  tone?: VixTone;
}

export interface VixBand extends VixSentiment {
  lo: number; // inclusive
  hi: number; // exclusive
}

// Contrarian / mean-reversion bands. Boundaries: value >= lo && value < hi.
// Single source of truth: both vixSentiment() and the VixPill info popover
// render from this list, so the scale only ever needs editing in one place.
export const VIX_BANDS: VixBand[] = [
  { lo: -Infinity, hi: 12, band: "<12",  sentiment: "Complacent", action: "Caution — don't chase", message: "Don't chase the rally", strength: "none",        tone: "caution"     },
  { lo: 12, hi: 15,        band: "12–15", sentiment: "Calm",      action: "Hold",                  message: "Sit tight",            strength: "none",        tone: "neutral"     },
  { lo: 15, hi: 18,        band: "15–18", sentiment: "Steady",    action: "Neutral",               message: "Stay the course",      strength: "none",        tone: "neutral"     },
  { lo: 18, hi: 22,        band: "18–22", sentiment: "Watchful",  action: "Mild buy · accumulate", message: "Ease in here",         strength: "weak",        tone: "accumulate"  },
  { lo: 22, hi: 27,        band: "22–27", sentiment: "Unsettled", action: "Buy",                   message: "Start buying",         strength: "building",    tone: "accumulate"  },
  { lo: 27, hi: 33,        band: "27–33", sentiment: "Fearful",   action: "Strong buy",            message: "Lean into the fear",   strength: "strong",      tone: "opportunity" },
  { lo: 33, hi: 45,        band: "33–45", sentiment: "High fear", action: "Aggressive buy",        message: "Buy the fear",         strength: "very-strong", tone: "opportunity" },
  { lo: 45, hi: Infinity,  band: "45+",   sentiment: "Panic",     action: "Max buy",               message: "Be greedy now",        strength: "strongest",   tone: "opportunity" },
];

export function vixSentiment(value: number): VixSentiment {
  // Pull only the VixSentiment fields, leaving the internal lo/hi bounds behind.
  const { band, sentiment, action, message, strength, tone } =
    VIX_BANDS.find((x) => value >= x.lo && value < x.hi) ?? VIX_BANDS[0];
  return { band, sentiment, action, message, strength, tone };
}
