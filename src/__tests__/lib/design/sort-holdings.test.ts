import { sortHoldings, HOLDING_COLUMNS, type SortKey } from "@/lib/design/sort-holdings";
import type { PortfolioItem } from "@/types";

function item(over: Partial<PortfolioItem> & { ticker: string }): PortfolioItem {
  const shares = over.shares ?? 10;
  const avgCost = over.avgCost ?? 100;
  const price = over.quote?.price ?? 110;
  return {
    ticker: over.ticker,
    companyName: over.companyName ?? `${over.ticker} Inc.`,
    sector: over.sector ?? "Technology",
    shares,
    avgCost,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: over.quote ?? { price, change: 1, changePercent: 0.9, previousClose: price - 1 },
    marketValue: over.marketValue ?? shares * price,
    totalPL: over.totalPL ?? shares * (price - avgCost),
    totalPLPercent: over.totalPLPercent ?? ((price - avgCost) / avgCost) * 100,
  };
}

const a = item({ ticker: "AAA", marketValue: 100, totalPL: 5 });
const b = item({ ticker: "BBB", marketValue: 300, totalPL: -10 });
const c = item({ ticker: "CCC", marketValue: 200, totalPL: 20 });

describe("sortHoldings", () => {
  it("returns a new array and does not mutate the input", () => {
    const input = [a, b, c];
    const out = sortHoldings(input, "marketValue", "desc", 600);
    expect(out).not.toBe(input);
    expect(input.map((i) => i.ticker)).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("sorts a numeric column descending and ascending", () => {
    expect(sortHoldings([a, b, c], "marketValue", "desc", 600).map((i) => i.ticker)).toEqual(["BBB", "CCC", "AAA"]);
    expect(sortHoldings([a, b, c], "marketValue", "asc", 600).map((i) => i.ticker)).toEqual(["AAA", "CCC", "BBB"]);
  });

  it("sorts signed columns by value, not magnitude", () => {
    expect(sortHoldings([a, b, c], "totalPL", "desc", 600).map((i) => i.ticker)).toEqual(["CCC", "AAA", "BBB"]);
  });

  it("sorts text columns case-insensitively", () => {
    const lower = item({ ticker: "zeta", companyName: "zeta" });
    const upper = item({ ticker: "Alpha", companyName: "Alpha" });
    expect(sortHoldings([lower, upper], "ticker", "asc", 600).map((i) => i.ticker)).toEqual(["Alpha", "zeta"]);
  });

  it("derives % of portfolio from the passed total", () => {
    expect(sortHoldings([a, b, c], "portfolioPercent", "desc", 600)[0].ticker).toBe("BBB");
  });

  it("keeps a stable order for equal values", () => {
    const x = item({ ticker: "X", marketValue: 100 });
    const y = item({ ticker: "Y", marketValue: 100 });
    expect(sortHoldings([x, y], "marketValue", "asc", 200).map((i) => i.ticker)).toEqual(["X", "Y"]);
    expect(sortHoldings([x, y], "marketValue", "desc", 200).map((i) => i.ticker)).toEqual(["X", "Y"]);
  });

  it("sinks a non-finite value to the bottom regardless of direction", () => {
    const bad = item({ ticker: "BAD", marketValue: NaN });
    expect(sortHoldings([bad, a], "marketValue", "desc", 100).map((i) => i.ticker)).toEqual(["AAA", "BAD"]);
    expect(sortHoldings([bad, a], "marketValue", "asc", 100).map((i) => i.ticker)).toEqual(["AAA", "BAD"]);
  });

  it("exposes exactly ten columns, ticker first", () => {
    expect(HOLDING_COLUMNS).toHaveLength(10);
    expect(HOLDING_COLUMNS[0].key).toBe("ticker");
    const keys = HOLDING_COLUMNS.map((c) => c.key);
    const expected: SortKey[] = ["ticker", "companyName", "sector", "shares", "avgCost", "price", "dayChangePercent", "marketValue", "totalPL", "portfolioPercent"];
    expect(keys).toEqual(expected);
  });

  it("marks numeric columns so the UI can right-align them", () => {
    const byKey = Object.fromEntries(HOLDING_COLUMNS.map((c) => [c.key, c]));
    expect(byKey.ticker.numeric).toBe(false);
    expect(byKey.companyName.numeric).toBe(false);
    expect(byKey.sector.numeric).toBe(false);
    expect(byKey.marketValue.numeric).toBe(true);
    expect(byKey.totalPL.numeric).toBe(true);
  });
});
