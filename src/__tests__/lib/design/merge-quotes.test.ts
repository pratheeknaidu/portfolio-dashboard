import { mergeHoldingsWithQuotes } from "@/lib/design/merge-quotes";
import type { Holding, Quote } from "@/types";

const h = (over: Partial<Holding> = {}): Holding => ({
  ticker: "AAPL", companyName: "Apple Inc.", sector: "Technology",
  shares: 10, avgCost: 100, addedAt: "2026-01-02T00:00:00.000Z", ...over,
});
const q = (over: Partial<Quote> = {}): Quote => ({
  price: 150, change: 2, changePercent: 1.35, previousClose: 148, ...over,
});

describe("mergeHoldingsWithQuotes", () => {
  it("computes market value, P&L, and P&L percent from shares and cost", () => {
    const [item] = mergeHoldingsWithQuotes([h()], { AAPL: q() }, "1D");
    expect(item.marketValue).toBe(1500);
    expect(item.totalPL).toBe(500);
    expect(item.totalPLPercent).toBeCloseTo(50, 5);
  });

  it("drops holdings with no quote", () => {
    expect(mergeHoldingsWithQuotes([h()], {}, "1D")).toEqual([]);
  });

  it("in ALL range, rewrites change to lifetime move off cost basis", () => {
    const [item] = mergeHoldingsWithQuotes([h({ avgCost: 100 })], { AAPL: q({ price: 150 }) }, "ALL");
    expect(item.quote.change).toBe(50);
    expect(item.quote.changePercent).toBeCloseTo(50, 5);
  });

  it("in non-ALL range, leaves the quote's own change untouched", () => {
    const [item] = mergeHoldingsWithQuotes([h()], { AAPL: q({ change: 2, changePercent: 1.35 }) }, "1D");
    expect(item.quote.change).toBe(2);
    expect(item.quote.changePercent).toBe(1.35);
  });
});
