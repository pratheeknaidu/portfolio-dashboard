import { render, screen } from "@testing-library/react";
import { MoversCard } from "@/components/MoversCard";
import type { PortfolioItem } from "@/types";

function item(ticker: string, shares: number, change: number, price = 100): PortfolioItem {
  return {
    ticker,
    companyName: `${ticker} Corp`,
    sector: "Technology",
    shares,
    avgCost: 90,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: {
      price,
      change,
      changePercent: (change / (price - change)) * 100,
      previousClose: price - change,
    },
    marketValue: shares * price,
    totalPL: shares * (price - 90),
    totalPLPercent: ((price - 90) / 90) * 100,
  };
}

describe("MoversCard", () => {
  it("names what it is explaining", () => {
    render(<MoversCard items={[item("AAPL", 100, 2)]} />);
    expect(screen.getByText(/what moved the number/i)).toBeInTheDocument();
  });

  it("orders rows by dollar contribution", () => {
    render(<MoversCard items={[item("TINY", 2, 9), item("BIG", 400, 1.2)]} />);
    const rows = screen.getAllByTestId("mover-row");
    expect(rows[0]).toHaveTextContent("BIG");
    expect(rows[1]).toHaveTextContent("TINY");
  });

  it("shows each position's dollar contribution, not just its percent", () => {
    render(<MoversCard items={[item("AAPL", 100, 2)]} />);
    expect(screen.getByText(/\+\$200\.00/)).toBeInTheDocument();
  });

  it("carries direction as a glyph as well as a colour", () => {
    render(<MoversCard items={[item("DOWN", 100, -5)]} />);
    expect(screen.getByTestId("mover-row")).toHaveTextContent("▼");
  });

  it("says so plainly when nothing moved", () => {
    render(<MoversCard items={[item("FLAT", 100, 0)]} />);
    expect(screen.getByText(/nothing moved today/i)).toBeInTheDocument();
  });

  it("says so plainly for an empty portfolio", () => {
    render(<MoversCard items={[]} />);
    expect(screen.getByText(/nothing moved today/i)).toBeInTheDocument();
  });

  it("caps the list at five rows", () => {
    const items = ["A", "B", "C", "D", "E", "F", "G"].map((t, n) => item(t, 100, n + 1));
    render(<MoversCard items={items} />);
    expect(screen.getAllByTestId("mover-row")).toHaveLength(5);
  });
});
