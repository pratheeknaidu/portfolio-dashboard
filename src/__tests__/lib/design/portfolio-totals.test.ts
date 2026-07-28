import { portfolioTotals } from "@/lib/design/portfolio-totals";
import type { PortfolioItem } from "@/types";

function item(over: Partial<PortfolioItem> = {}): PortfolioItem {
  const shares = over.shares ?? 100;
  const avgCost = over.avgCost ?? 100;
  const quote = { price: 110, change: 2, changePercent: 1.85, previousClose: 108, ...over.quote };
  return {
    ticker: "AAPL",
    companyName: "Apple Inc.",
    sector: "Technology",
    shares,
    avgCost,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote,
    marketValue: shares * quote.price,
    totalPL: shares * (quote.price - avgCost),
    totalPLPercent: ((quote.price - avgCost) / avgCost) * 100,
    ...over,
  };
}

describe("portfolioTotals", () => {
  it("sums market value and cost basis across positions", () => {
    const t = portfolioTotals([
      item({ shares: 100, avgCost: 100, quote: { price: 110, change: 2, changePercent: 1.85, previousClose: 108 } }),
      item({ shares: 50, avgCost: 200, quote: { price: 220, change: -5, changePercent: -2.22, previousClose: 225 } }),
    ]);
    expect(t.totalValue).toBe(100 * 110 + 50 * 220);
    expect(t.costBasis).toBe(100 * 100 + 50 * 200);
  });

  it("derives P&L from value minus cost", () => {
    const t = portfolioTotals([item({ shares: 100, avgCost: 100 })]);
    expect(t.totalPL).toBe(1000);
    expect(t.totalPLPercent).toBeCloseTo(10, 5);
  });

  // The denominator is yesterday's close, not today's value. Dividing by today
  // understates every move, and the error grows with the size of the move.
  it("measures the day change against yesterday's value", () => {
    const t = portfolioTotals([
      item({ shares: 100, quote: { price: 110, change: 10, changePercent: 10, previousClose: 100 } }),
    ]);
    expect(t.dayChange).toBe(1000);
    expect(t.dayChangePercent).toBeCloseTo(10, 5);
  });

  it("nets gainers against losers in the day change", () => {
    const t = portfolioTotals([
      item({ shares: 100, quote: { price: 110, change: 10, changePercent: 10, previousClose: 100 } }),
      item({ shares: 100, quote: { price: 90, change: -10, changePercent: -10, previousClose: 100 } }),
    ]);
    expect(t.dayChange).toBe(0);
    expect(t.dayChangePercent).toBe(0);
  });

  it("returns zeros for an empty portfolio without dividing by zero", () => {
    const t = portfolioTotals([]);
    expect(t).toEqual({
      totalValue: 0,
      costBasis: 0,
      totalPL: 0,
      totalPLPercent: 0,
      dayChange: 0,
      dayChangePercent: 0,
    });
  });

  // A fully written-off position leaves costBasis at 0; percent must not be Infinity.
  it("reports zero percent rather than Infinity when cost basis is zero", () => {
    const t = portfolioTotals([item({ shares: 10, avgCost: 0 })]);
    expect(Number.isFinite(t.totalPLPercent)).toBe(true);
    expect(t.totalPLPercent).toBe(0);
  });

  // One bad quote must not poison the sum for the whole portfolio.
  it("ignores a non-finite quote.change rather than propagating NaN", () => {
    const t = portfolioTotals([
      item({ shares: 100, quote: { price: 110, change: NaN, changePercent: NaN, previousClose: 108 } }),
      item({ shares: 100, quote: { price: 110, change: 10, changePercent: 10, previousClose: 100 } }),
    ]);
    expect(Number.isFinite(t.dayChange)).toBe(true);
    expect(t.dayChange).toBe(1000);
  });

  // Mirrors the zero-cost-basis case above, but for the day-change guard: a
  // position worth nothing today and yesterday must not divide 0 by 0.
  it("reports zero percent rather than NaN when previous value is zero", () => {
    const t = portfolioTotals([
      item({ shares: 10, quote: { price: 0, change: 0, changePercent: 0, previousClose: 0 } }),
    ]);
    expect(Number.isFinite(t.dayChangePercent)).toBe(true);
    expect(t.dayChangePercent).toBe(0);
  });
});
