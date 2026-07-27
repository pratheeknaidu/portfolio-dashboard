import { render, screen } from "@testing-library/react";
import { TreemapTooltip, type TileRect } from "@/components/TreemapTooltip";

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

const item = {
  ticker: "AAPL", companyName: "Apple Inc.", sector: "Technology",
  shares: 50, avgCost: 142.8, addedAt: "",
  quote: { price: 185.5, change: 2.3, changePercent: 1.25, previousClose: 183.2 },
  marketValue: 13500, totalPL: 2135, totalPLPercent: 29.9,
};

const cardRect = { top: 0, left: 0, width: 1000, height: 500 };

const renderTooltip = (tileRect: TileRect | null) =>
  render(
    <TreemapTooltip item={item} tileRect={tileRect} cardRect={cardRect} weightPct={8.66} />,
  );

describe("TreemapTooltip", () => {
  it("displays company name, shares, cost basis, P&L", () => {
    renderTooltip({ top: 40, left: 400, width: 100, height: 80 });
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
    expect(screen.getByText("Shares")).toBeInTheDocument();
    expect(screen.getByText("50 @ $142.80")).toBeInTheDocument();
    expect(screen.getByText(/\$2,135/)).toBeInTheDocument();
  });

  it("returns null when no item provided", () => {
    const { container } = render(
      <TreemapTooltip item={null} tileRect={null} cardRect={cardRect} weightPct={0} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows market value and weight, which the old tooltip omitted", () => {
    renderTooltip({ top: 40, left: 400, width: 100, height: 80 });
    expect(screen.getByText("$13,500.00")).toBeInTheDocument();
    expect(screen.getByText("8.66%")).toBeInTheDocument();
  });

  it("anchors below a tile near the top of the card", () => {
    renderTooltip({ top: 40, left: 400, width: 100, height: 80 });
    expect(screen.getByTestId("treemap-tooltip")).toHaveAttribute("data-placement", "below");
  });

  // The shipped tooltip clips at the container edge, hiding the numbers the
  // user hovered to read.
  it("flips above and clamps horizontally for a bottom-corner tile", () => {
    renderTooltip({ top: 430, left: 960, width: 40, height: 60 });
    const tip = screen.getByTestId("treemap-tooltip");
    expect(tip).toHaveAttribute("data-placement", "above");
    expect(parseFloat(tip.style.left)).toBeLessThanOrEqual(91);
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
    render(<TreemapTooltip item={mockItem} tileRect={null} cardRect={null} weightPct={8.66} />);
    // Sheet provides role=dialog; the desktop floating tooltip does not.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Body content still present
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
  });

  it("calls onClose when sheet overlay is tapped", () => {
    const onClose = jest.fn();
    render(<TreemapTooltip item={mockItem} tileRect={null} cardRect={null} weightPct={8.66} onClose={onClose} />);
    const overlay = screen.getByTestId("sheet-overlay");
    overlay.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
