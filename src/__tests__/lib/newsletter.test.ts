import type { PortfolioItem } from "@/types";
import { buildReport } from "@/lib/newsletter/build-report";
import { narrativeToHtml, renderHtml, subjectFor } from "@/lib/newsletter/render-email";

function item(over: Partial<PortfolioItem> & { ticker: string }): PortfolioItem {
  const shares = over.shares ?? 10;
  const avgCost = over.avgCost ?? 100;
  const price = over.quote?.price ?? 100;
  const marketValue = shares * price;
  const totalPL = marketValue - shares * avgCost;
  return {
    companyName: `${over.ticker} Inc`,
    sector: "Technology",
    addedAt: "2026-01-01T00:00:00Z",
    shares,
    avgCost,
    marketValue,
    totalPL,
    totalPLPercent: (totalPL / (shares * avgCost)) * 100,
    ...over,
    quote: { price, change: 0, changePercent: 0, previousClose: price, ...over.quote },
  };
}

const etfMoves = {
  SPY: { dayPct: 0.5, monthPct: 2 },
  XLK: { dayPct: 1, monthPct: 6 },
  XLE: { dayPct: -1, monthPct: 8 },
  XLF: { dayPct: 0.2, monthPct: 1 },
  XLV: { dayPct: 0.1, monthPct: -3 },
};

describe("buildReport", () => {
  it("ranks drivers by dollar contribution, not percent", () => {
    const report = buildReport({
      date: "2026-10-15",
      items: [
        item({ ticker: "BIG", shares: 100, quote: { price: 100, change: 2, changePercent: 2, previousClose: 98 } }),
        item({ ticker: "SMALL", shares: 1, quote: { price: 100, change: 9, changePercent: 9, previousClose: 91 } }),
        item({ ticker: "DOWN", shares: 50, quote: { price: 100, change: -3, changePercent: -3, previousClose: 103 } }),
      ],
      valuations: {},
      etfMoves,
    });

    expect(report.gainers.map((g) => g.ticker)).toEqual(["BIG", "SMALL"]);
    expect(report.losers.map((l) => l.ticker)).toEqual(["DOWN"]);
    expect(report.totals.dayChange).toBe(200 + 9 - 150);
    expect(report.benchmarkChangePercent).toBe(0.5);
  });

  it("aggregates sector contribution and picks top 1M sector momentum", () => {
    const report = buildReport({
      date: "2026-10-15",
      items: [
        item({ ticker: "A", sector: "Technology", quote: { price: 100, change: 1, changePercent: 1, previousClose: 99 } }),
        item({ ticker: "B", sector: "Technology", quote: { price: 100, change: 2, changePercent: 2, previousClose: 98 } }),
        item({ ticker: "C", sector: "Mystery", quote: { price: 100, change: -1, changePercent: -1, previousClose: 101 } }),
      ],
      valuations: { A: { valuationSource: "analyst_target", upsideToTargetPct: 10 } },
      etfMoves,
    });

    expect(report.sectorDrivers[0]).toMatchObject({ sector: "Technology", contribution: 30 });
    expect(report.sectorDrivers[1]).toMatchObject({ sector: "Other", contribution: -10 });
    expect(report.sectorsToWatch.map((s) => s.etf)).toEqual(["XLE", "XLK", "XLF"]);
    expect(report.sectorsToWatch[1].avgUpsidePct).toBe(10);
    expect(report.sectorsToWatch[0].portfolioWeightPct).toBe(0);
  });

  it("flags winners for profit-taking only with a concrete reason", () => {
    const report = buildReport({
      date: "2026-10-15",
      items: [
        // +50%, above analyst target
        item({ ticker: "HOT", avgCost: 100, quote: { price: 150, change: 0, changePercent: 0, previousClose: 150 } }),
        // +50%, no signal at all — not flagged (shares tiny to avoid concentration)
        item({ ticker: "FINE", shares: 0.1, avgCost: 100, quote: { price: 150, change: 0, changePercent: 0, previousClose: 150 } }),
        // +10% but overvalued — below the gain floor
        item({ ticker: "MEH", avgCost: 100, quote: { price: 110, change: 0, changePercent: 0, previousClose: 110 } }),
        item({ ticker: "FILL", shares: 1000, avgCost: 100 }),
      ],
      valuations: {
        HOT: { valuationSource: "analyst_target", targetMeanPrice: 140 },
        MEH: { valuationSource: "fair_value", fairValueDescription: "Overvalued" },
      },
      etfMoves,
    });

    expect(report.takeProfit.map((f) => f.ticker)).toEqual(["HOT"]);
    expect(report.takeProfit[0].reasons[0]).toMatch(/analyst mean target/);
  });

  it("flags concentrated big winners and bearish big losers", () => {
    const report = buildReport({
      date: "2026-10-15",
      items: [
        item({ ticker: "WHALE", shares: 100, avgCost: 50, quote: { price: 100, change: 0, changePercent: 0, previousClose: 100 } }),
        item({ ticker: "DOG", shares: 10, avgCost: 100, quote: { price: 60, change: 0, changePercent: 0, previousClose: 60 } }),
      ],
      valuations: { DOG: { valuationSource: "none", recommendationKey: "sell" } },
      etfMoves,
    });

    expect(report.takeProfit[0].ticker).toBe("WHALE");
    expect(report.takeProfit[0].reasons.join(" ")).toMatch(/concentration/);
    expect(report.takeProfit[0].reasons.join(" ")).toMatch(/partial trim/);
    expect(report.review.map((f) => f.ticker)).toEqual(["DOG"]);
  });
});

describe("render", () => {
  it("escapes model output and only renders the allowed subset", () => {
    const html = narrativeToHtml("### Head\n- **NVDA** <script>x</script>\n\nPlain & simple");
    expect(html).toContain("<h3");
    expect(html).toContain("<strong>NVDA</strong>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Plain &amp; simple");
  });

  it("renders a complete email with subject carrying the day change", () => {
    const report = buildReport({
      date: "2026-10-15",
      items: [item({ ticker: "A", quote: { price: 100, change: -2, changePercent: -2, previousClose: 102 } })],
      valuations: {},
      etfMoves,
    });
    expect(subjectFor(report)).toBe("Portfolio brief 2026-10-15: -$20.00 (-1.96%)");
    const html = renderHtml(report, null);
    expect(html).toContain("Biggest movers");
    expect(html).toContain("Not financial advice");
    expect(html).not.toContain("Briefing");
  });
});
