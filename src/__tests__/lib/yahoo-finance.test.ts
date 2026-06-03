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
import { getQuotes, getVix, clearCache } from "@/lib/yahoo-finance";

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
    expect(result.quotes.AAPL).toEqual({
      price: 185.5,
      change: 2.3,
      changePercent: 1.25,
      previousClose: 183.2,
    });
    expect(result.failed).toEqual([]);
  });

  it("returns unfetched tickers in `failed`", async () => {
    mockQuote.mockImplementation((ticker: string) => {
      if (ticker === "AAPL") {
        return Promise.resolve({
          symbol: "AAPL",
          regularMarketPrice: 185.5,
          regularMarketChange: 2.3,
          regularMarketChangePercent: 1.25,
          regularMarketPreviousClose: 183.2,
        });
      }
      return Promise.reject(new Error("not found"));
    });

    const result = await getQuotes(["AAPL", "BOGUS"], "1D");
    expect(result.quotes.AAPL).toBeDefined();
    expect(result.quotes.BOGUS).toBeUndefined();
    expect(result.failed).toEqual(["BOGUS"]);
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
    expect(result.quotes.AAPL.changePercent).toBeCloseTo(5.56, 1);
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
    expect(result.quotes.AAPL).toBeDefined();
    expect(result.quotes.MSFT).toBeDefined();
    expect(result.quotes.BAD).toBeUndefined();
    expect(result.failed).toEqual(["BAD"]);
  });
});

describe("getVix", () => {
  beforeEach(() => {
    clearCache();
    mockQuote.mockReset();
  });

  it("returns normalized VIX value and previousClose", async () => {
    mockQuote.mockResolvedValue({
      symbol: "^VIX",
      regularMarketPrice: 18.4,
      regularMarketPreviousClose: 17.9,
    });
    const result = await getVix();
    expect(result).toEqual({ value: 18.4, previousClose: 17.9 });
  });

  it("returns null when the quote has no price", async () => {
    mockQuote.mockResolvedValue({ symbol: "^VIX" });
    expect(await getVix()).toBeNull();
  });

  it("returns null when Yahoo throws", async () => {
    mockQuote.mockRejectedValue(new Error("down"));
    expect(await getVix()).toBeNull();
  });
});
