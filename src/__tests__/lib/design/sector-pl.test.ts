import { sectorPL } from "@/lib/design/sector-pl";
import { sectorColor } from "@/lib/design/sectors";
import type { PortfolioItem } from "@/types";

function item(sector: string, totalPL: number, ticker = sector.slice(0, 4)): PortfolioItem {
  return {
    ticker,
    companyName: `${ticker} Inc.`,
    sector,
    shares: 1,
    avgCost: 100,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: { price: 100 + totalPL, change: 0, changePercent: 0, previousClose: 100 },
    marketValue: 100 + totalPL,
    totalPL,
    totalPLPercent: totalPL,
  };
}

describe("sectorPL", () => {
  it("sums P&L per sector, largest absolute P&L first", () => {
    const rows = sectorPL([
      item("Technology", 100),
      item("Healthcare", -300),
      item("Technology", 50),
    ]);
    expect(rows.map((r) => [r.sector, r.pl])).toEqual([
      ["Healthcare", -300],
      ["Technology", 150],
    ]);
  });

  it("carries the sector palette colour", () => {
    const rows = sectorPL([item("Technology", 100)]);
    expect(rows[0].color).toBe(sectorColor("Technology"));
  });

  it("computes each sector's P&L as a percent of its cost basis", () => {
    // Technology cost basis 200 (2 x 100), P&L +100 -> +50%.
    const rows = sectorPL([item("Technology", 60), item("Technology", 40)]);
    expect(rows[0].plPercent).toBeCloseTo(50, 5);
  });

  it("buckets unknown sectors as Other rather than dropping their P&L", () => {
    const orphan = { ...item("Technology", 40), sector: "Nonexistent Sector" };
    const rows = sectorPL([item("Technology", 60), orphan]);
    const other = rows.find((r) => r.sector === "Other");
    expect(other?.pl).toBe(40);
  });

  it("returns an empty list for an empty portfolio", () => {
    expect(sectorPL([])).toEqual([]);
  });

  it("reports zero-percent rather than NaN when a sector's cost basis is zero", () => {
    const free = { ...item("Technology", 10), avgCost: 0, marketValue: 10 };
    const rows = sectorPL([free]);
    expect(Number.isFinite(rows[0].plPercent)).toBe(true);
    expect(rows[0].plPercent).toBe(0);
  });
});
