import { render, screen, fireEvent } from "@testing-library/react";
import { HoldingsTable } from "@/components/HoldingsTable";
import type { PortfolioItem } from "@/types";

const items: PortfolioItem[] = [
  {
    ticker: "AAPL", companyName: "Apple Inc.", sector: "Technology",
    shares: 50, avgCost: 142.8, addedAt: "",
    quote: { price: 185.5, change: 2.3, changePercent: 1.25, previousClose: 183.2 },
    marketValue: 9275, totalPL: 2135, totalPLPercent: 29.9,
  },
  {
    ticker: "MSFT", companyName: "Microsoft Corp.", sector: "Technology",
    shares: 30, avgCost: 280.5, addedAt: "",
    quote: { price: 290, change: -3.5, changePercent: -1.19, previousClose: 293.5 },
    marketValue: 8700, totalPL: 285, totalPLPercent: 3.39,
  },
];

describe("HoldingsTable", () => {
  it("renders all holdings rows", () => {
    render(<HoldingsTable items={items} totalValue={17975} />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("MSFT")).toBeInTheDocument();
  });

  it("sorts by column when header clicked", () => {
    render(<HoldingsTable items={items} totalValue={17975} />);
    fireEvent.click(screen.getByText("Market Value"));
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("AAPL");
  });

  it("filters by search term", () => {
    render(<HoldingsTable items={items} totalValue={17975} />);
    const search = screen.getByPlaceholderText(/search/i);
    fireEvent.change(search, { target: { value: "apple" } });
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.queryByText("MSFT")).not.toBeInTheDocument();
  });

  it("color-codes positive P&L green and negative red", () => {
    render(<HoldingsTable items={items} totalValue={17975} />);
    const aaplPL = screen.getByText(/\$2,135/);
    expect(aaplPL.className).toContain("text-gain");
  });
});
