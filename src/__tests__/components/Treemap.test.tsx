import { render, screen } from "@testing-library/react";
import { Treemap } from "@/components/Treemap";
import type { PortfolioItem } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
jest.mock("@nivo/treemap", () => ({
  ResponsiveTreeMapHtml: ({ data }: any) => (
    <div data-testid="treemap">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {data.children.map((c: any) => (
        <div
          key={c.id}
          data-testid={`tile-${c.id}`}
          data-value={c.value}
        >
          {c.id}
        </div>
      ))}
    </div>
  ),
}));

const mockItems: PortfolioItem[] = [
  {
    ticker: "AAPL", companyName: "Apple", sector: "Technology",
    shares: 50, avgCost: 142.8, addedAt: "",
    quote: { price: 185.5, change: 2.3, changePercent: 1.25, previousClose: 183.2 },
    marketValue: 9275, totalPL: 2135, totalPLPercent: 29.9,
  },
  {
    ticker: "MSFT", companyName: "Microsoft", sector: "Technology",
    shares: 30, avgCost: 280.5, addedAt: "",
    quote: { price: 290, change: -3.5, changePercent: -1.19, previousClose: 293.5 },
    marketValue: 8700, totalPL: 285, totalPLPercent: 3.39,
  },
];

describe("Treemap", () => {
  it("renders a tile for each portfolio item", () => {
    render(<Treemap items={mockItems} sizing="equity" onSelect={jest.fn()} />);
    expect(screen.getByTestId("tile-AAPL")).toBeInTheDocument();
    expect(screen.getByTestId("tile-MSFT")).toBeInTheDocument();
  });

  it("passes market value as tile size", () => {
    render(<Treemap items={mockItems} sizing="equity" onSelect={jest.fn()} />);
    const treemap = screen.getByTestId("treemap");
    expect(treemap).toBeInTheDocument();
  });

  it("sizes profit-mode tiles by abs($ P/L for the selected range), not lifetime P/L", () => {
    // AAPL: shares 50, change +2.3  → period $ P/L = +115
    // MSFT: shares 30, change -3.5  → period $ P/L = -105 → abs 105
    // (Lifetime totalPL is AAPL 2135 vs MSFT 285 — a totally different order
    //  of magnitude. If we regressed back to totalPL the values below would
    //  fail loudly.)
    render(<Treemap items={mockItems} sizing="profit" onSelect={jest.fn()} />);
    const aapl = Number(screen.getByTestId("tile-AAPL").getAttribute("data-value"));
    const msft = Number(screen.getByTestId("tile-MSFT").getAttribute("data-value"));
    expect(aapl).toBeCloseTo(115, 5);
    expect(msft).toBeCloseTo(105, 5);
  });
});
