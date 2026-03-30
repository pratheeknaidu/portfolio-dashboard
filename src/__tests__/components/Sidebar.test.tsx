import { render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/Sidebar";
import type { PortfolioItem } from "@/types";

const items: PortfolioItem[] = [
  {
    ticker: "AAPL", companyName: "Apple", sector: "Technology",
    shares: 50, avgCost: 142.8, addedAt: "",
    quote: { price: 185.5, change: 2.3, changePercent: 1.25, previousClose: 183.2 },
    marketValue: 9275, totalPL: 2135, totalPLPercent: 29.9,
  },
  {
    ticker: "XOM", companyName: "Exxon", sector: "Energy",
    shares: 100, avgCost: 90, addedAt: "",
    quote: { price: 95, change: -2, changePercent: -2.06, previousClose: 97 },
    marketValue: 9500, totalPL: 500, totalPLPercent: 5.56,
  },
];

describe("Sidebar", () => {
  it("displays total portfolio value", () => {
    render(<Sidebar items={items} />);
    expect(screen.getByText(/\$18,775/)).toBeInTheDocument();
  });

  it("shows top movers by absolute daily change", () => {
    render(<Sidebar items={items} />);
    const movers = screen.getByTestId("top-movers");
    expect(movers).toBeInTheDocument();
  });

  it("shows sector allocation", () => {
    render(<Sidebar items={items} />);
    expect(screen.getByText("Technology")).toBeInTheDocument();
    expect(screen.getByText("Energy")).toBeInTheDocument();
  });
});
