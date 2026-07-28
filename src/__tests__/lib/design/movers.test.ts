import { topMovers } from "@/lib/design/movers";
import type { PortfolioItem } from "@/types";

function item(ticker: string, shares: number, change: number, price = 100): PortfolioItem {
  return {
    ticker,
    companyName: `${ticker} Inc.`,
    sector: "Technology",
    shares,
    avgCost: 90,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: {
      price,
      change,
      changePercent: (change / (price - change)) * 100,
      previousClose: price - change,
    },
    marketValue: shares * price,
    totalPL: shares * (price - 90),
    totalPLPercent: ((price - 90) / 90) * 100,
  };
}

describe("topMovers", () => {
  // The card sits beside the headline day change and claims to explain it. A
  // percent ranking contradicts that headline: a tiny position with a big
  // percent move outranks the position that actually moved the number.
  it("ranks by dollar contribution, not percent", () => {
    const big = item("BIG", 400, 1.2); // +$480
    const tiny = item("TINY", 2, 9); // +$18
    expect(topMovers([tiny, big]).map((m) => m.item.ticker)).toEqual(["BIG", "TINY"]);
  });

  it("reports each position's signed dollar contribution", () => {
    const movers = topMovers([item("AAPL", 100, 2)]);
    expect(movers[0].contribution).toBe(200);
  });

  it("ranks by absolute contribution so big losers surface too", () => {
    const gainer = item("UP", 100, 1); // +$100
    const loser = item("DOWN", 100, -5); // -$500
    expect(topMovers([gainer, loser]).map((m) => m.item.ticker)).toEqual(["DOWN", "UP"]);
  });

  it("keeps the sign on the contribution after ranking by magnitude", () => {
    const movers = topMovers([item("DOWN", 100, -5)]);
    expect(movers[0].contribution).toBe(-500);
  });

  it("caps the list at the requested limit", () => {
    const items = ["A", "B", "C", "D", "E", "F", "G"].map((t, n) => item(t, 100, n + 1));
    expect(topMovers(items, 5)).toHaveLength(5);
    expect(topMovers(items, 3)).toHaveLength(3);
  });

  it("defaults to five, the number the card has room for", () => {
    const items = ["A", "B", "C", "D", "E", "F", "G"].map((t, n) => item(t, 100, n + 1));
    expect(topMovers(items)).toHaveLength(5);
  });

  it("drops positions that did not move, which explain nothing", () => {
    const movers = topMovers([item("FLAT", 100, 0), item("MOVED", 100, 1)]);
    expect(movers.map((m) => m.item.ticker)).toEqual(["MOVED"]);
  });

  it("returns an empty list for an empty portfolio", () => {
    expect(topMovers([])).toEqual([]);
  });

  it("ignores non-finite changes so one bad quote cannot take the top slot", () => {
    const bad = item("BAD", 100, NaN);
    const good = item("GOOD", 100, 1);
    expect(topMovers([bad, good]).map((m) => m.item.ticker)).toEqual(["GOOD"]);
  });
});
