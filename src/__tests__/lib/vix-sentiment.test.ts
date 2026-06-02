import { vixSentiment } from "@/lib/vix-sentiment";

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
