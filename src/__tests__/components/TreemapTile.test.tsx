// Nivo ships ESM that jest can't parse directly; mock the heavy export.
// We only need TreemapTile from this module, which doesn't touch Nivo at runtime.
jest.mock("@nivo/treemap", () => ({
  ResponsiveTreeMapHtml: () => null,
}));

import { render, screen, fireEvent } from "@testing-library/react";
import { TreemapTile, type TreemapTileProps } from "@/components/Treemap";
import type { PortfolioItem } from "@/types";

const baseItem: PortfolioItem = {
  ticker: "AAPL",
  companyName: "Apple",
  sector: "Technology",
  shares: 50,
  avgCost: 142.8,
  addedAt: "",
  quote: { price: 185.5, change: 2.3, changePercent: 1.25, previousClose: 183.2 },
  marketValue: 9275,
  totalPL: 2135,
  totalPLPercent: 29.9,
};

const defaultProps: TreemapTileProps = {
  ticker: "AAPL",
  changePercent: 1.25,
  width: 200,
  height: 100,
  x: 0,
  y: 0,
  color: "oklch(0.5 0.1 155)",
  item: baseItem,
  onSelect: jest.fn(),
};

const render_ = (overrides: Partial<TreemapTileProps> = {}) =>
  render(<TreemapTile {...defaultProps} {...overrides} />);

const getTile = () => screen.getByRole("button");

describe("TreemapTile — accessibility (Sprint 4.1)", () => {
  it("renders as a button with descriptive aria-label", () => {
    render_();
    const tile = getTile();
    expect(tile).toHaveAttribute("aria-label", "AAPL, up 1.3%. Press Enter for details.");
  });

  it("describes negative moves as 'down'", () => {
    render_({ changePercent: -2.4 });
    expect(getTile()).toHaveAttribute("aria-label", "AAPL, down 2.4%. Press Enter for details.");
  });

  it("describes zero moves as 'up 0.0%' (sign-neutral)", () => {
    render_({ changePercent: 0 });
    expect(getTile()).toHaveAttribute("aria-label", "AAPL, up 0.0%. Press Enter for details.");
  });

  it("is keyboard focusable (tabIndex 0)", () => {
    render_();
    expect(getTile()).toHaveAttribute("tabIndex", "0");
  });
});

describe("TreemapTile — keyboard activation (Sprint 4.1)", () => {
  it("calls onSelect when Enter is pressed", () => {
    const onSelect = jest.fn();
    render_({ onSelect });
    fireEvent.keyDown(getTile(), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBe(baseItem);
  });

  it("calls onSelect when Space is pressed", () => {
    const onSelect = jest.fn();
    render_({ onSelect });
    fireEvent.keyDown(getTile(), { key: " " });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does not call onSelect for unrelated keys", () => {
    const onSelect = jest.fn();
    render_({ onSelect });
    fireEvent.keyDown(getTile(), { key: "ArrowDown" });
    fireEvent.keyDown(getTile(), { key: "Tab" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("clicks the tile via mouse click as well (regression)", () => {
    const onSelect = jest.fn();
    render_({ onSelect });
    fireEvent.click(getTile());
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe("TreemapTile — three-tier label rendering (Sprint 4.3)", () => {
  it("shows both ticker and percent on a large tile (>= 50x30)", () => {
    render_({ width: 200, height: 100 });
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByTestId("tile-percent")).toHaveTextContent("+1.3%");
  });

  it("shows ticker-only at the medium tier (32-49 wide OR 18-29 tall)", () => {
    render_({ width: 40, height: 24 });
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.queryByTestId("tile-percent")).not.toBeInTheDocument();
  });

  it("shows ticker-only at the boundary (width >= 32, height >= 18)", () => {
    render_({ width: 32, height: 18 });
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.queryByTestId("tile-percent")).not.toBeInTheDocument();
  });

  it("hides both labels on very small tiles (< 32 wide OR < 18 tall)", () => {
    render_({ width: 20, height: 12 });
    expect(screen.queryByText("AAPL")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tile-percent")).not.toBeInTheDocument();
  });

  it("hides both labels when only one dimension is below threshold", () => {
    render_({ width: 200, height: 10 });
    expect(screen.queryByText("AAPL")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tile-percent")).not.toBeInTheDocument();
  });

  it("still renders the focusable button container even when labels hide", () => {
    // Important for accessibility: even tiny tiles must remain navigable
    // by screen reader / keyboard via their aria-label.
    render_({ width: 20, height: 12 });
    const tile = getTile();
    expect(tile).toBeInTheDocument();
    expect(tile).toHaveAttribute("aria-label", expect.stringContaining("AAPL"));
  });
});
