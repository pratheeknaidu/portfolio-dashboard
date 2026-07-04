import {
  DEMO_HOLDINGS,
  DEMO_SNAPSHOTS,
  buildDemoItems,
  getDemoValuations,
} from "@/lib/demo-data";

describe("demo-data fixture", () => {
  it("resolves a quote-backed PortfolioItem for every holding", () => {
    const items = buildDemoItems("1D");
    expect(items).toHaveLength(DEMO_HOLDINGS.length);
    for (const item of items) {
      expect(item.quote.price).toBeGreaterThan(0);
      expect(Number.isFinite(item.marketValue)).toBe(true);
      expect(Number.isFinite(item.totalPL)).toBe(true);
      expect(Number.isFinite(item.totalPLPercent)).toBe(true);
    }
  });

  it("uses cost basis as the reference for the ALL range", () => {
    for (const item of buildDemoItems("ALL")) {
      expect(item.quote.change).toBeCloseTo(item.quote.price - item.avgCost, 6);
      expect(item.quote.changePercent).toBeCloseTo(item.totalPLPercent, 6);
    }
  });

  it("provides a valid valuation for every holding", () => {
    const valuations = getDemoValuations();
    for (const h of DEMO_HOLDINGS) {
      const v = valuations[h.ticker];
      expect(v).toBeDefined();
      expect(v.recommendationKey).toBeDefined();
      expect(v.valuationSource).toBe("analyst_target");
    }
  });

  it("has weekday-only snapshots in ascending date order with positive totals", () => {
    expect(DEMO_SNAPSHOTS.length).toBeGreaterThan(0);
    let prev = "";
    for (const s of DEMO_SNAPSHOTS) {
      const day = new Date(`${s.date}T00:00:00Z`).getUTCDay();
      expect(day).not.toBe(0); // Sunday
      expect(day).not.toBe(6); // Saturday
      expect(s.totalValue).toBeGreaterThan(0);
      expect(s.date > prev).toBe(true);
      prev = s.date;
    }
  });
});
