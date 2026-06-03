/**
 * @jest-environment node
 */
jest.mock("yahoo-finance2", () => {
  const quoteSummary = jest.fn();
  return {
    __esModule: true,
    default: jest.fn(() => ({ quoteSummary })),
  };
});

import YahooFinance from "yahoo-finance2";
import { enrichHoldings } from "@/lib/import/enrich-holdings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { quoteSummary: mockQuoteSummary } = new (YahooFinance as any)() as {
  quoteSummary: jest.Mock;
};

describe("enrichHoldings", () => {
  beforeEach(() => {
    mockQuoteSummary.mockReset();
  });

  it("enriches a plain equity from the bare symbol", async () => {
    mockQuoteSummary.mockResolvedValue({
      price: { shortName: "Apple Inc." },
      summaryProfile: { sector: "Technology" },
    });

    const result = await enrichHoldings(["AAPL"]);
    expect(result.AAPL).toEqual({ name: "Apple Inc.", sector: "Technology" });
  });

  it("resolves a bare crypto symbol via the -USD pair, keyed under the requested ticker", async () => {
    mockQuoteSummary.mockImplementation((symbol: string) => {
      if (symbol === "ETC-USD") {
        return Promise.resolve({
          price: { shortName: "Ethereum Classic USD" },
          summaryProfile: {},
        });
      }
      return Promise.reject(new Error(`No summary for ${symbol}`));
    });

    const result = await enrichHoldings(["ETC"]);
    expect(result.ETC).toEqual({ name: "Ethereum Classic USD", sector: "" });
  });
});
