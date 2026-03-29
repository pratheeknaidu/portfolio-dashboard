/**
 * @jest-environment node
 */
import { getQuotes, clearCache } from "@/lib/yahoo-finance";

jest.mock("yahoo-finance2", () => ({
  __esModule: true,
  default: {
    quote: jest.fn(),
    historical: jest.fn(),
  },
}));

import yahooFinance from "yahoo-finance2";

describe("getQuotes", () => {
  beforeEach(() => {
    clearCache();
    jest.clearAllMocks();
  });

  it("fetches quotes for given tickers and returns normalized shape", async () => {
    (yahooFinance.quote as jest.Mock).mockResolvedValue([
      {
        symbol: "AAPL",
        regularMarketPrice: 185.5,
        regularMarketChange: 2.3,
        regularMarketChangePercent: 1.25,
        regularMarketPreviousClose: 183.2,
      },
    ]);

    const result = await getQuotes(["AAPL"], "1D");
    expect(result.AAPL).toEqual({
      price: 185.5,
      change: 2.3,
      changePercent: 1.25,
      previousClose: 183.2,
    });
  });

  it("returns cached data within TTL", async () => {
    (yahooFinance.quote as jest.Mock).mockResolvedValue([
      { symbol: "AAPL", regularMarketPrice: 185.5, regularMarketChange: 2.3, regularMarketChangePercent: 1.25, regularMarketPreviousClose: 183.2 },
    ]);

    await getQuotes(["AAPL"], "1D");
    await getQuotes(["AAPL"], "1D");

    expect(yahooFinance.quote).toHaveBeenCalledTimes(1);
  });

  it("for non-1D ranges, fetches historical and computes change from period start", async () => {
    (yahooFinance.quote as jest.Mock).mockResolvedValue([
      { symbol: "AAPL", regularMarketPrice: 190 },
    ]);
    (yahooFinance.historical as jest.Mock).mockResolvedValue([
      { date: new Date("2026-03-19"), close: 180 },
      { date: new Date("2026-03-26"), close: 190 },
    ]);

    const result = await getQuotes(["AAPL"], "1W");
    expect(result.AAPL.changePercent).toBeCloseTo(5.56, 1);
  });
});
