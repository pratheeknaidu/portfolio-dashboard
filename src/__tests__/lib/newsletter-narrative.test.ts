/**
 * @jest-environment node
 */
import { privateReport, writeNarrative } from "@/lib/newsletter/narrative";
import type { NewsletterReport } from "@/lib/newsletter/build-report";

const mockGenerate = jest.fn();
jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent: mockGenerate } })),
}));

const report: NewsletterReport = {
  date: "2026-10-15",
  totals: {
    totalValue: 152383.12,
    costBasis: 134480.87,
    totalPL: 17902.25,
    totalPLPercent: 13.312,
    dayChange: 60.31,
    dayChangePercent: 0.0396,
  },
  benchmarkChangePercent: 0.42,
  gainers: [{ ticker: "JNJ", companyName: "Johnson & Johnson", sector: "Healthcare", contribution: 89.08, changePercent: 0.58 }],
  losers: [{ ticker: "PG", companyName: "Procter & Gamble", sector: "Consumer Defensive", contribution: -66.07, changePercent: -0.58 }],
  sectorDrivers: [{ sector: "Healthcare", contribution: 84.03, weightPct: 10.83 }],
  sectorsToWatch: [{ sector: "Energy", etf: "XLE", dayPct: 1, monthPct: 8, portfolioWeightPct: 7.9 }],
  takeProfit: [
    {
      ticker: "PLD",
      companyName: "Prologis",
      totalPL: 8528.69,
      totalPLPercent: 206.51,
      weightPct: 8.3,
      reasons: ["Trading at or above the analyst mean target ($340.34)", "Up +207% — a partial trim locks in the gain"],
    },
  ],
  review: [],
  failedTickers: [],
};

describe("privateReport", () => {
  it("contains no dollar figures", () => {
    const json = JSON.stringify(privateReport(report));
    for (const secret of ["152383", "134480", "17902", "60.31", "89.08", "66.07", "84.03", "8528", "$"]) {
      expect(json).not.toContain(secret);
    }
    expect(json).not.toMatch(/totalValue|costBasis|totalPL"|dayChange"|contribution/);
  });

  it("keeps the percentages, weights and reasons the briefing needs", () => {
    const p = privateReport(report);
    expect(p.dayChangePercent).toBe(0.04);
    expect(p.gainers[0]).toEqual({ ticker: "JNJ", companyName: "Johnson & Johnson", sector: "Healthcare", changePercent: 0.58 });
    expect(p.sectors[0]).toEqual({ sector: "Healthcare", weightPct: 10.83, direction: "up" });
    expect(p.takeProfit[0].reasons).toEqual(["Up +207% — a partial trim locks in the gain"]);
  });
});

describe("writeNarrative", () => {
  const env = process.env;
  beforeEach(() => {
    mockGenerate.mockReset();
    process.env = { ...env, GEMINI_API_KEY: "key" };
  });
  afterAll(() => {
    process.env = env;
  });

  it("reports a missing key without calling Gemini", async () => {
    delete process.env.GEMINI_API_KEY;
    expect(await writeNarrative(report)).toEqual({ text: null, error: "GEMINI_API_KEY is not set" });
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("sends only the private report to a search-grounded Flash model", async () => {
    mockGenerate.mockResolvedValue({ text: "  ### What drove today\n- **JNJ** up  " });
    expect(await writeNarrative(report)).toEqual({ text: "### What drove today\n- **JNJ** up" });

    const call = mockGenerate.mock.calls[0][0];
    expect(call.model).toBe("gemini-flash-latest");
    expect(call.config.tools).toEqual([{ googleSearch: {} }]);
    expect(call.contents).not.toContain("152383");
    expect(call.contents).not.toContain("$");
  });

  it("honours GEMINI_MODEL", async () => {
    process.env.GEMINI_MODEL = "gemini-other";
    mockGenerate.mockResolvedValue({ text: "x" });
    await writeNarrative(report);
    expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-other" }));
  });

  it("returns the error message on failures such as quota exhaustion", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockGenerate.mockRejectedValue(new Error("429 RESOURCE_EXHAUSTED"));
    expect(await writeNarrative(report)).toEqual({ text: null, error: "429 RESOURCE_EXHAUSTED" });
  });

  it("flags an empty response", async () => {
    mockGenerate.mockResolvedValue({ text: "  " });
    expect(await writeNarrative(report)).toEqual({ text: null, error: "Gemini returned an empty response" });
  });
});
