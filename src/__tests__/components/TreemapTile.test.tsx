// Nivo ships ESM that jest can't parse directly; mock the heavy export.
// We only need TreemapTile from this module, which doesn't touch Nivo at runtime.
jest.mock("@nivo/treemap", () => ({
  ResponsiveTreeMapHtml: () => null,
}));

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TreemapTile } from "@/components/Treemap";
import type { PortfolioItem } from "@/types";

const item: PortfolioItem = {
  ticker: "AAPL",
  companyName: "Apple Inc.",
  sector: "Technology",
  shares: 80,
  avgCost: 142.8,
  addedAt: "2026-01-02T00:00:00.000Z",
  quote: { price: 168.75, change: 1.09, changePercent: 0.65, previousClose: 167.66 },
  marketValue: 13500,
  totalPL: 2076,
  totalPLPercent: 18.16,
};

const base = {
  item,
  changePercent: 0.65,
  domain: 1,
  cvd: false,
  isMobile: false,
  x: 0,
  y: 0,
  onSelect: jest.fn(),
};

describe("TreemapTile labels", () => {
  it("renders ticker, percent and sub-label on a large tile", () => {
    render(<TreemapTile {...base} width={200} height={160} />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByTestId("tile-percent")).toHaveTextContent("▲0.65%");
    expect(screen.getByTestId("tile-sub")).toHaveTextContent("$13,500.00");
  });

  it("drops the sub-label but keeps the percent at medium size", () => {
    render(<TreemapTile {...base} width={70} height={50} />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByTestId("tile-percent")).toBeInTheDocument();
    expect(screen.queryByTestId("tile-sub")).not.toBeInTheDocument();
  });

  it("shows the ticker alone on a small tile", () => {
    render(<TreemapTile {...base} width={40} height={30} />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.queryByTestId("tile-percent")).not.toBeInTheDocument();
  });

  it("renders nothing legible below the ticker threshold", () => {
    render(<TreemapTile {...base} width={20} height={14} />);
    expect(screen.queryByText("AAPL")).not.toBeInTheDocument();
  });
});

describe("TreemapTile sign encoding", () => {
  // Sign must never depend on colour alone.
  it.each([
    [0.65, "▲"],
    [-0.42, "▼"],
    [0, "◆"],
  ])("prefixes %p with %s", (pct, glyph) => {
    render(<TreemapTile {...base} changePercent={pct} width={200} height={160} />);
    expect(screen.getByTestId("tile-percent").textContent).toContain(glyph);
  });
});

describe("TreemapTile accessibility", () => {
  it("is a real button carrying the full position in its label", () => {
    render(<TreemapTile {...base} width={200} height={160} />);
    const tile = screen.getByRole("button");
    expect(tile).toHaveAccessibleName("AAPL, Apple Inc., $13,500.00, up 0.65% today");
  });

  it("says 'down' for a loss", () => {
    render(<TreemapTile {...base} changePercent={-0.42} width={200} height={160} />);
    expect(screen.getByRole("button")).toHaveAccessibleName(/down 0\.42% today/);
  });

  it("selects on click and on Enter", async () => {
    const onSelect = jest.fn();
    render(<TreemapTile {...base} onSelect={onSelect} width={200} height={160} />);
    const tile = screen.getByRole("button");
    await userEvent.click(tile);
    expect(onSelect).toHaveBeenCalledWith(item, expect.any(Object));
    tile.focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("carries a data-ticker hook for arrow-key navigation", () => {
    render(<TreemapTile {...base} width={200} height={160} />);
    expect(screen.getByRole("button")).toHaveAttribute("data-ticker", "AAPL");
  });
});

describe("TreemapTile contrast", () => {
  it("uses dark ink on a light gain tile and white on a dark loss tile", () => {
    const { rerender } = render(
      <TreemapTile {...base} changePercent={5} domain={5} width={200} height={160} />,
    );
    expect(screen.getByText("AAPL")).toHaveStyle({ color: "#000000" });

    rerender(<TreemapTile {...base} changePercent={-5} domain={5} width={200} height={160} />);
    expect(screen.getByText("AAPL")).toHaveStyle({ color: "#ffffff" });
  });
});
