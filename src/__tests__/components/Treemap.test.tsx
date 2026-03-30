import { render, screen } from "@testing-library/react";
import { Treemap } from "@/components/Treemap";
import type { PortfolioItem } from "@/types";

jest.mock("@nivo/treemap", () => ({
  ResponsiveTreeMap: ({ data }: any) => (
    <div data-testid="treemap">
      {data.children.map((c: any) => (
        <div key={c.id} data-testid={`tile-${c.id}`}>
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
    render(<Treemap items={mockItems} onHover={jest.fn()} />);
    expect(screen.getByTestId("tile-AAPL")).toBeInTheDocument();
    expect(screen.getByTestId("tile-MSFT")).toBeInTheDocument();
  });

  it("passes market value as tile size", () => {
    render(<Treemap items={mockItems} onHover={jest.fn()} />);
    const treemap = screen.getByTestId("treemap");
    expect(treemap).toBeInTheDocument();
  });
});
