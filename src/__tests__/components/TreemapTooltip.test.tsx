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
        tileRect={null}
      />
    );
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
    // "Shares" label appears next to a "50" value cell after the redesign
    expect(screen.getByText("Shares")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText(/\$2,135/)).toBeInTheDocument();
  });

  it("returns null when no item provided", () => {
    const { container } = render(<TreemapTooltip item={null} tileRect={null} />);
    expect(container.firstChild).toBeNull();
  });
});
