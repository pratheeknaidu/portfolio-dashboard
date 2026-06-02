export type VixStrength =
  | "none" | "weak" | "building" | "strong" | "very-strong" | "strongest";

// One value per visual stop so the pill color is fully determined by this
// field — no band-string parsing in the component.
export type VixTone = "caution" | "neutral" | "accumulate" | "opportunity";

export interface VixSentiment {
  band: string;        // e.g. "18–22"
  sentiment: string;   // e.g. "Watchful"
  action: string;      // e.g. "Mild buy · accumulate"
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
  strength?: VixStrength;
  tone?: VixTone;
}

interface Band extends VixSentiment {
  lo: number; // inclusive
  hi: number; // exclusive
}

// Contrarian / mean-reversion bands. Boundaries: value >= lo && value < hi.
const BANDS: Band[] = [
  { lo: -Infinity, hi: 12, band: "<12",  sentiment: "Complacent", action: "Caution — don't chase", strength: "none",        tone: "caution"     },
  { lo: 12, hi: 15,        band: "12–15", sentiment: "Calm",      action: "Hold",                  strength: "none",        tone: "neutral"     },
  { lo: 15, hi: 18,        band: "15–18", sentiment: "Steady",    action: "Neutral",               strength: "none",        tone: "neutral"     },
  { lo: 18, hi: 22,        band: "18–22", sentiment: "Watchful",  action: "Mild buy · accumulate", strength: "weak",        tone: "accumulate"  },
  { lo: 22, hi: 27,        band: "22–27", sentiment: "Unsettled", action: "Buy",                   strength: "building",    tone: "accumulate"  },
  { lo: 27, hi: 33,        band: "27–33", sentiment: "Fearful",   action: "Strong buy",            strength: "strong",      tone: "opportunity" },
  { lo: 33, hi: 45,        band: "33–45", sentiment: "High fear", action: "Aggressive buy",        strength: "very-strong", tone: "opportunity" },
  { lo: 45, hi: Infinity,  band: "45+",   sentiment: "Panic",     action: "Max buy",               strength: "strongest",   tone: "opportunity" },
];

export function vixSentiment(value: number): VixSentiment {
  const b =
    BANDS.find((x) => value >= x.lo && value < x.hi) ?? BANDS[0];
  return {
    band: b.band,
    sentiment: b.sentiment,
    action: b.action,
    strength: b.strength,
    tone: b.tone,
  };
}
