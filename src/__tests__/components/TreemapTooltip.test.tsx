import { render, screen } from "@testing-library/react";
import { TreemapTooltip } from "@/components/TreemapTooltip";

// jsdom doesn't implement matchMedia; stub it globally so useIsMobile doesn't throw.
// Default: desktop (matches = false).
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockReturnValue({
      matches: false,
      media: "",
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
});

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

describe("TreemapTooltip mobile", () => {
  const mockItem = {
    ticker: "AAPL", companyName: "Apple Inc.", sector: "Technology",
    shares: 50, avgCost: 142.8, addedAt: "",
    quote: { price: 185.5, change: 2.3, changePercent: 1.25, previousClose: 183.2 },
    marketValue: 9275, totalPL: 2135, totalPLPercent: 29.9,
  };

  beforeEach(() => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      media: "(max-width: 767px)",
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.style.overflow = "";
  });

  it("renders the detail inside a Sheet on mobile", () => {
    render(<TreemapTooltip item={mockItem} tileRect={null} />);
    // Sheet provides role=dialog; the desktop floating tooltip does not.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Body content still present
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
  });

  it("calls onClose when sheet overlay is tapped", () => {
    const onClose = jest.fn();
    render(<TreemapTooltip item={mockItem} tileRect={null} onClose={onClose} />);
    const overlay = screen.getByTestId("sheet-overlay");
    overlay.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
