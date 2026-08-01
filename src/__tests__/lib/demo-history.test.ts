import { portfolioHistory, type TickerCloses } from "@/lib/demo-history";
import type { Holding } from "@/types";

const h = (ticker: string, shares: number): Holding => ({
  ticker, companyName: `${ticker} Inc.`, sector: "Technology",
  shares, avgCost: 100, addedAt: "2026-01-02T00:00:00.000Z",
});

describe("portfolioHistory", () => {
  it("sums shares x close per date across holdings", () => {
    const closes: TickerCloses = {
      AAA: [{ date: "2026-07-01", close: 10 }, { date: "2026-07-02", close: 12 }],
      BBB: [{ date: "2026-07-01", close: 20 }, { date: "2026-07-02", close: 25 }],
    };
    const series = portfolioHistory([h("AAA", 2), h("BBB", 1)], closes);
    // 2026-07-01: 2*10 + 1*20 = 40; 2026-07-02: 2*12 + 1*25 = 49
    expect(series).toEqual([
      { date: "2026-07-01", totalValue: 40, holdings: {} },
      { date: "2026-07-02", totalValue: 49, holdings: {} },
    ]);
  });

  it("includes only dates every holding has a close for (no partial totals)", () => {
    const closes: TickerCloses = {
      AAA: [{ date: "2026-07-01", close: 10 }, { date: "2026-07-02", close: 12 }],
      BBB: [{ date: "2026-07-01", close: 20 }],
    };
    const series = portfolioHistory([h("AAA", 1), h("BBB", 1)], closes);
    expect(series.map((s) => s.date)).toEqual(["2026-07-01"]);
  });

  it("returns dates ascending regardless of input order", () => {
    const closes: TickerCloses = {
      AAA: [{ date: "2026-07-03", close: 3 }, { date: "2026-07-01", close: 1 }],
    };
    const series = portfolioHistory([h("AAA", 1)], closes);
    expect(series.map((s) => s.date)).toEqual(["2026-07-01", "2026-07-03"]);
  });

  it("returns empty for no holdings or missing closes", () => {
    expect(portfolioHistory([], {})).toEqual([]);
    expect(portfolioHistory([h("AAA", 1)], {})).toEqual([]);
  });
});
