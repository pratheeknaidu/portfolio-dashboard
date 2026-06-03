import { vixSentiment, VIX_BANDS } from "@/lib/vix-sentiment";

describe("vixSentiment", () => {
  it.each([
    [8,    "Complacent", "Caution — don't chase",      "none",        "caution"],
    [11.99,"Complacent", "Caution — don't chase",      "none",        "caution"],
    [12,   "Calm",       "Hold",                       "none",        "neutral"],
    [15,   "Steady",     "Neutral",                    "none",        "neutral"],
    [17.99,"Steady",     "Neutral",                    "none",        "neutral"],
    [18,   "Watchful",   "Mild buy · accumulate",      "weak",        "accumulate"],
    [21.99,"Watchful",   "Mild buy · accumulate",      "weak",        "accumulate"],
    [22,   "Unsettled",  "Buy",                        "building",    "accumulate"],
    [27,   "Fearful",    "Strong buy",                 "strong",      "opportunity"],
    [33,   "High fear",  "Aggressive buy",             "very-strong", "opportunity"],
    [45,   "Panic",      "Max buy",                    "strongest",   "opportunity"],
    [80,   "Panic",      "Max buy",                    "strongest",   "opportunity"],
  ])("maps VIX %p correctly", (value, sentiment, action, strength, tone) => {
    const r = vixSentiment(value as number);
    expect(r.sentiment).toBe(sentiment);
    expect(r.action).toBe(action);
    expect(r.strength).toBe(strength);
    expect(r.tone).toBe(tone);
  });

  it("clamps negatives into the lowest (caution) band", () => {
    expect(vixSentiment(-5).tone).toBe("caution");
  });

  it("returns a band label", () => {
    expect(vixSentiment(19).band).toBe("18–22");
  });
});

describe("VIX_BANDS", () => {
  it("exposes all 8 bands in ascending order", () => {
    expect(VIX_BANDS).toHaveLength(8);
    expect(VIX_BANDS.map((b) => b.band)).toEqual([
      "<12", "12–15", "15–18", "18–22", "22–27", "27–33", "33–45", "45+",
    ]);
  });

  it("is the source of truth vixSentiment derives from", () => {
    for (const b of VIX_BANDS) {
      // pick a value that falls inside this band's [lo, hi) range
      const probe = Number.isFinite(b.lo) ? b.lo : b.hi - 1;
      const r = vixSentiment(probe);
      expect(r.band).toBe(b.band);
      expect(r.sentiment).toBe(b.sentiment);
      expect(r.action).toBe(b.action);
      expect(r.message).toBe(b.message);
      expect(r.strength).toBe(b.strength);
      expect(r.tone).toBe(b.tone);
    }
  });

  it("gives every band a conversational message", () => {
    for (const b of VIX_BANDS) {
      expect(typeof b.message).toBe("string");
      expect(b.message.length).toBeGreaterThan(0);
    }
  });
});
