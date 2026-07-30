import { sectorAllocation } from "@/lib/design/allocation";
import { OTHER_COLOR, sectorColor } from "@/lib/design/sectors";
import type { PortfolioItem } from "@/types";

function item(sector: string, marketValue: number, ticker = sector.slice(0, 4)): PortfolioItem {
  return {
    ticker,
    companyName: `${ticker} Inc.`,
    sector,
    shares: 1,
    avgCost: 1,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: { price: marketValue, change: 0, changePercent: 0, previousClose: marketValue },
    marketValue,
    totalPL: 0,
    totalPLPercent: 0,
  };
}

describe("sectorAllocation", () => {
  it("aggregates market value by sector, largest first", () => {
    const slices = sectorAllocation([
      item("Technology", 100),
      item("Healthcare", 300),
      item("Technology", 250),
    ]);
    expect(slices.map((s) => [s.sector, s.value])).toEqual([
      ["Technology", 350],
      ["Healthcare", 300],
    ]);
  });

  it("reports each sector's share of the total", () => {
    const slices = sectorAllocation([item("Technology", 750), item("Energy", 250)]);
    expect(slices[0].pct).toBeCloseTo(75, 5);
    expect(slices[1].pct).toBeCloseTo(25, 5);
  });

  it("takes its colours from the shared sector palette", () => {
    const slices = sectorAllocation([item("Technology", 100)]);
    expect(slices[0].color).toBe(sectorColor("Technology"));
  });

  // Beyond the cap the strip becomes unreadable slivers. Rolling the tail into
  // one bucket keeps the percentages summing to 100 without lying about them.
  it("rolls everything past the limit into a single Other bucket", () => {
    const items = [
      item("Technology", 100),
      item("Healthcare", 90),
      item("Energy", 80),
      item("Utilities", 5),
      item("Industrials", 4),
      item("Real Estate", 3),
    ];
    const slices = sectorAllocation(items, 3);
    expect(slices).toHaveLength(4);
    expect(slices[3]).toEqual(
      expect.objectContaining({ sector: "Other", value: 12, color: OTHER_COLOR }),
    );
  });

  it("keeps percentages summing to 100 after the roll-up", () => {
    const items = [
      item("Technology", 100),
      item("Healthcare", 90),
      item("Energy", 80),
      item("Utilities", 5),
      item("Industrials", 4),
    ];
    const total = sectorAllocation(items, 3).reduce((s, x) => s + x.pct, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it("does not add an Other bucket when everything already fits", () => {
    const slices = sectorAllocation([item("Technology", 100), item("Energy", 50)], 3);
    expect(slices.map((s) => s.sector)).toEqual(["Technology", "Energy"]);
  });

  it("buckets missing sectors as Other rather than dropping the money", () => {
    const orphan = { ...item("Technology", 40), sector: "" };
    const slices = sectorAllocation([item("Technology", 60), orphan]);
    expect(slices.find((s) => s.sector === "Other")?.value).toBe(40);
  });

  // An empty-string sector takes the Other branch on the `i.sector &&` check
  // alone, so it never exercises the SECTOR_COLORS membership lookup. A
  // non-empty but unrecognised sector (stale imported data, a sector Yahoo
  // used to return and no longer does) must fold into Other too, rather than
  // forming its own one-off bucket.
  it("buckets a non-empty but unrecognised sector as Other rather than its own bucket", () => {
    const slices = sectorAllocation([item("Technology", 60), item("Conglomerates", 40)]);
    expect(slices.find((s) => s.sector === "Other")?.value).toBe(40);
  });

  // Basic Materials now has its own palette entry (fix above), so it must get
  // its own slice instead of folding into Other the way it used to.
  it("gives Basic Materials its own slice now that the palette covers it", () => {
    const slices = sectorAllocation([item("Technology", 60), item("Basic Materials", 40)]);
    expect(slices.find((s) => s.sector === "Basic Materials")).toEqual(
      expect.objectContaining({
        sector: "Basic Materials",
        value: 40,
        color: sectorColor("Basic Materials"),
      }),
    );
    expect(slices.find((s) => s.sector === "Other")).toBeUndefined();
  });

  it("returns an empty list for an empty portfolio", () => {
    expect(sectorAllocation([])).toEqual([]);
  });

  it("returns an empty list rather than dividing by a zero total", () => {
    expect(sectorAllocation([item("Technology", 0)])).toEqual([]);
  });

  // A pre-existing Other bucket (from an orphan sector) and a roll-up past the
  // limit both feed the same tail. If the roll-up forgets to exclude Other
  // from the sectors it re-sorts and slices, that bucket gets counted once as
  // a kept slice and a second time when it's folded into the tail — only
  // visible once both sources of Other are present at once.
  it("does not double-count a pre-existing Other bucket when also rolling up the tail", () => {
    const orphan = { ...item("Technology", 1), sector: "" };
    const items = [
      item("Technology", 100),
      item("Healthcare", 90),
      item("Energy", 80),
      item("Utilities", 5),
      orphan, // 1, unnamed sector -> Other
    ];
    const slices = sectorAllocation(items, 3);
    const otherSlices = slices.filter((s) => s.sector === "Other");
    expect(otherSlices).toHaveLength(1);
    expect(otherSlices[0].value).toBe(6); // Utilities (5) + orphan (1)
    expect(slices.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100, 5);
  });
});
