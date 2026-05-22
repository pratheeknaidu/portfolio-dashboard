/**
 * @jest-environment node
 */
jest.mock("yahoo-finance2", () => {
  const insights = jest.fn();
  const quoteSummary = jest.fn();
  return {
    __esModule: true,
    default: jest.fn(() => ({ insights, quoteSummary })),
  };
});

import YahooFinance from "yahoo-finance2";
import { parseFairValueDiscount } from "@/lib/yahoo-finance-valuations";

describe("parseFairValueDiscount", () => {
  it("parses signed percent strings", () => {
    expect(parseFairValueDiscount("-17%")).toBe(-17);
    expect(parseFairValueDiscount("+47%")).toBe(47);
    expect(parseFairValueDiscount("16%")).toBe(16);
    expect(parseFairValueDiscount("0%")).toBe(0);
  });

  it("handles whitespace and decimal values", () => {
    expect(parseFairValueDiscount(" -7.5% ")).toBe(-7.5);
  });

  it("returns undefined for empty or malformed input", () => {
    expect(parseFairValueDiscount("")).toBeUndefined();
    expect(parseFairValueDiscount(undefined)).toBeUndefined();
    expect(parseFairValueDiscount("not a number")).toBeUndefined();
    expect(parseFairValueDiscount("%")).toBeUndefined();
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { insights: mockInsights, quoteSummary: mockQuoteSummary } = new (YahooFinance as any)() as {
  insights: jest.Mock;
  quoteSummary: jest.Mock;
};

// Helper builders so tests stay readable.
function buildInsights(opts: { description?: string; discount?: string; provider?: string } = {}) {
  return {
    symbol: "AAPL",
    instrumentInfo: {
      valuation: {
        description: opts.description,
        discount: opts.discount,
        provider: opts.provider ?? "Trading Central",
      },
    },
  };
}

function buildFinancialData(opts: {
  recommendationKey?: string;
  recommendationMean?: number;
  targetMeanPrice?: number;
  currentPrice?: number;
  numberOfAnalystOpinions?: number;
} = {}) {
  return {
    financialData: {
      recommendationKey: opts.recommendationKey,
      recommendationMean: opts.recommendationMean,
      targetMeanPrice: opts.targetMeanPrice,
      currentPrice: opts.currentPrice,
      numberOfAnalystOpinions: opts.numberOfAnalystOpinions,
    },
  };
}

describe("getValuations", () => {
  beforeEach(() => {
    const { clearCache } = jest.requireActual("@/lib/yahoo-finance-valuations") as typeof import("@/lib/yahoo-finance-valuations");
    clearCache();
    mockInsights.mockReset();
    mockQuoteSummary.mockReset();
  });

  it("merges insights + quoteSummary into a normalized ValuationData", async () => {
    const { getValuations } = await import("@/lib/yahoo-finance-valuations");
    mockInsights.mockResolvedValue(buildInsights({ description: "Undervalued", discount: "+47%" }));
    mockQuoteSummary.mockResolvedValue(buildFinancialData({
      recommendationKey: "strong_buy",
      recommendationMean: 1.29,
      targetMeanPrice: 278.03,
      currentPrice: 215.33,
      numberOfAnalystOpinions: 51,
    }));

    const result = await getValuations(["NVDA"]);

    expect(result.NVDA).toEqual({
      recommendationKey: "strong_buy",
      recommendationMean: 1.29,
      numberOfAnalystOpinions: 51,
      fairValueDescription: "Undervalued",
      fairValueDiscountPct: 47,
      fairValueProvider: "Trading Central",
      targetMeanPrice: 278.03,
      currentPrice: 215.33,
      upsideToTargetPct: expect.closeTo(29.12, 1),
      valuationSource: "both",
    });
  });

  it("sets valuationSource = 'fair_value' when only the description is present", async () => {
    const { getValuations } = await import("@/lib/yahoo-finance-valuations");
    mockInsights.mockResolvedValue(buildInsights({ description: "Overvalued" }));
    mockQuoteSummary.mockResolvedValue(buildFinancialData({ recommendationKey: "buy", recommendationMean: 2.0 }));

    const result = await getValuations(["X"]);
    expect(result.X.valuationSource).toBe("fair_value");
    expect(result.X.upsideToTargetPct).toBeUndefined();
  });

  it("sets valuationSource = 'analyst_target' when only target is present", async () => {
    const { getValuations } = await import("@/lib/yahoo-finance-valuations");
    mockInsights.mockResolvedValue({ symbol: "Y", instrumentInfo: {} });
    mockQuoteSummary.mockResolvedValue(buildFinancialData({ targetMeanPrice: 110, currentPrice: 100 }));

    const result = await getValuations(["Y"]);
    expect(result.Y.valuationSource).toBe("analyst_target");
    expect(result.Y.upsideToTargetPct).toBeCloseTo(10, 5);
    expect(result.Y.fairValueDescription).toBeUndefined();
  });

  it("returns no entry when both API calls succeed with empty payloads", async () => {
    const { getValuations } = await import("@/lib/yahoo-finance-valuations");
    mockInsights.mockResolvedValue({ symbol: "SPY", instrumentInfo: {} });
    mockQuoteSummary.mockResolvedValue({ financialData: {} });

    const result = await getValuations(["SPY"]);
    // Mirrors getQuotes behaviour: tickers with no usable data are simply
    // absent from the result map — the UI treats "missing" as "no coverage".
    expect(result.SPY).toBeUndefined();
  });

  it("does not poison the batch when one ticker's insights call rejects", async () => {
    const { getValuations } = await import("@/lib/yahoo-finance-valuations");
    mockInsights.mockImplementation((t: string) =>
      t === "BAD" ? Promise.reject(new Error("Invalid")) : Promise.resolve(buildInsights({ description: "Undervalued" }))
    );
    mockQuoteSummary.mockImplementation((t: string) =>
      Promise.resolve(buildFinancialData({ recommendationKey: "buy", recommendationMean: 2 }))
    );

    const result = await getValuations(["AAPL", "BAD", "MSFT"]);
    expect(result.AAPL.fairValueDescription).toBe("Undervalued");
    expect(result.MSFT.fairValueDescription).toBe("Undervalued");
    // BAD's insights failed but quoteSummary succeeded → still gets a (partial) entry
    expect(result.BAD.fairValueDescription).toBeUndefined();
    expect(result.BAD.recommendationKey).toBe("buy");
  });

  it("returns no entry when BOTH insights and quoteSummary reject for a ticker", async () => {
    const { getValuations } = await import("@/lib/yahoo-finance-valuations");
    mockInsights.mockRejectedValue(new Error("down"));
    mockQuoteSummary.mockRejectedValue(new Error("down"));

    const result = await getValuations(["GHOST"]);
    expect(result.GHOST).toBeUndefined();
  });
});
