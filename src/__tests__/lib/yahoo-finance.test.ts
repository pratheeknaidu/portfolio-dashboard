/**
 * @jest-environment node
 */
jest.mock("yahoo-finance2", () => {
  const quote = jest.fn();
  const chart = jest.fn();
  return {
    __esModule: true,
    default: jest.fn(() => ({ quote, chart })),
  };
});

import YahooFinance from "yahoo-finance2";
import { getQuotes, clearCache } from "@/lib/yahoo-finance";

// Constructor returns the shared { quote, chart } closure used by the
// production module's single YahooFinance instance — same references.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { quote: mockQuote, chart: mockChart } = new (YahooFinance as any)() as {
  quote: jest.Mock;
  chart: jest.Mock;
};

describe("getQuotes", () => {
  beforeEach(() => {
    clearCache();
    mockQuote.mockReset();
    mockChart.mockReset();
  });

  it("fetches quotes for given tickers and returns normalized shape", async () => {
    mockQuote.mockResolvedValue({
      symbol: "AAPL",
      regularMarketPrice: 185.5,
      regularMarketChange: 2.3,
      regularMarketChangePercent: 1.25,
      regularMarketPreviousClose: 183.2,
    });

    const result = await getQuotes(["AAPL"], "1D");
    expect(result.AAPL).toEqual({
      price: 185.5,
      change: 2.3,
      changePercent: 1.25,
      previousClose: 183.2,
    });
  });

  it("returns cached data within TTL", async () => {
    mockQuote.mockResolvedValue({
      symbol: "AAPL",
      regularMarketPrice: 185.5,
      regularMarketChange: 2.3,
      regularMarketChangePercent: 1.25,
      regularMarketPreviousClose: 183.2,
    });

    await getQuotes(["AAPL"], "1D");
    await getQuotes(["AAPL"], "1D");

    expect(mockQuote).toHaveBeenCalledTimes(1);
  });

  it("for non-1D ranges, fetches chart history and computes change from period start", async () => {
    mockQuote.mockResolvedValue({
      symbol: "AAPL",
      regularMarketPrice: 190,
      regularMarketPreviousClose: 189,
    });
    mockChart.mockResolvedValue({
      quotes: [
        { date: new Date("2026-03-19"), close: 180 },
        { date: new Date("2026-03-26"), close: 190 },
      ],
    });

    const result = await getQuotes(["AAPL"], "1W");
    expect(result.AAPL.changePercent).toBeCloseTo(5.56, 1);
    expect(mockChart).toHaveBeenCalledWith("AAPL", expect.objectContaining({ period1: expect.any(Date) }));
  });

  it("skips tickers whose quote() rejects without poisoning the batch", async () => {
    mockQuote.mockImplementation((ticker: string) => {
      if (ticker === "BAD") return Promise.reject(new Error("Invalid"));
      return Promise.resolve({
        symbol: ticker,
        regularMarketPrice: 100,
        regularMarketChange: 1,
        regularMarketChangePercent: 1,
        regularMarketPreviousClose: 99,
      });
    });

    const result = await getQuotes(["AAPL", "BAD", "MSFT"], "1D");
    expect(result.AAPL).toBeDefined();
    expect(result.MSFT).toBeDefined();
    expect(result.BAD).toBeUndefined();
  });
});
