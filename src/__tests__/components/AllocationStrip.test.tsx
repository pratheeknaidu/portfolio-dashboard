import { render, screen } from "@testing-library/react";
import { AllocationStrip } from "@/components/AllocationStrip";
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

const items = [item("Technology", 600), item("Healthcare", 300), item("Energy", 100)];

describe("AllocationStrip", () => {
  it("labels each sector directly rather than through a legend", () => {
    render(<AllocationStrip items={items} />);
    expect(screen.getByText("Technology")).toBeInTheDocument();
    expect(screen.getByText("Healthcare")).toBeInTheDocument();
  });

  it("prints each sector's percentage and value", () => {
    render(<AllocationStrip items={items} />);
    expect(screen.getByText("60.0%")).toBeInTheDocument();
    expect(screen.getByText("$600.00")).toBeInTheDocument();
  });

  it("sizes each segment by its share of the total", () => {
    render(<AllocationStrip items={items} />);
    expect(screen.getByTestId("segment-Technology")).toHaveStyle({ width: "60%" });
  });

  it("renders an empty note rather than a zero-width bar", () => {
    render(<AllocationStrip items={[]} />);
    expect(screen.getByText(/no positions to allocate/i)).toBeInTheDocument();
  });

  // The bar is decorative; the labelled rows below it are the real content.
  it("hides the bar from assistive tech", () => {
    render(<AllocationStrip items={items} />);
    expect(screen.getByTestId("allocation-bar")).toHaveAttribute("aria-hidden", "true");
  });

  it("rolls the tail into Other past the display limit", () => {
    const many = [
      item("Technology", 100),
      item("Healthcare", 90),
      item("Energy", 80),
      item("Utilities", 70),
      item("Industrials", 60),
      item("Real Estate", 50),
      item("Consumer Defensive", 40),
      item("Consumer Cyclical", 30),
    ];
    render(<AllocationStrip items={many} />);
    expect(screen.getByText("Other")).toBeInTheDocument();
  });
});
