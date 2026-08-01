import { render, screen, within } from "@testing-library/react";
import { SectorPLCard } from "@/components/SectorPLCard";
import type { PortfolioItem } from "@/types";

function item(sector: string, totalPL: number): PortfolioItem {
  return {
    ticker: sector.slice(0, 4),
    companyName: `${sector} Co`,
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

const items = [item("Technology", 500), item("Healthcare", -300), item("Energy", 100)];

describe("SectorPLCard", () => {
  it("names the section", () => {
    render(<SectorPLCard items={items} />);
    expect(screen.getByText(/p&l by sector/i)).toBeInTheDocument();
  });

  it("lists each sector with its signed P&L, biggest swing first", () => {
    render(<SectorPLCard items={items} />);
    const rows = screen.getAllByTestId("sector-pl-row");
    expect(rows[0]).toHaveTextContent("Technology");
    expect(within(rows[0]).getByText(/\+\$500\.00/)).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent("Healthcare");
  });

  it("uses a true minus and a glyph on a losing sector", () => {
    render(<SectorPLCard items={items} />);
    const healthcare = screen
      .getAllByTestId("sector-pl-row")
      .find((r) => /Healthcare/.test(r.textContent ?? ""))!;
    expect(healthcare.textContent).toContain("−");
    expect(healthcare.textContent).toContain("▼");
    expect(healthcare.textContent).not.toContain("-$");
  });

  it("shows an empty note for an empty portfolio", () => {
    render(<SectorPLCard items={[]} />);
    expect(screen.getByText(/no positions/i)).toBeInTheDocument();
  });
});
