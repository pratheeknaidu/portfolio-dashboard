import { render, screen } from "@testing-library/react";
import { TreemapTooltip } from "@/components/TreemapTooltip";

describe("TreemapTooltip", () => {
  it("displays company name, shares, cost basis, P&L", () => {
    render(
      <TreemapTooltip
        item={{
          ticker: "AAPL", companyName: "Apple Inc.", sector: "Technology",
          shares: 50, avgCost: 142.8, addedAt: "",
          quote: { price: 185.5, change: 2.3, changePercent: 1.25, previousClose: 183.2 },
          marketValue: 9275, totalPL: 2135, totalPLPercent: 29.9,
        }}
      />
    );
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
    expect(screen.getByText(/50 shares/)).toBeInTheDocument();
    expect(screen.getByText(/\$2,135/)).toBeInTheDocument();
  });

  it("returns null when no item provided", () => {
    const { container } = render(<TreemapTooltip item={null} />);
    expect(container.firstChild).toBeNull();
  });
});
