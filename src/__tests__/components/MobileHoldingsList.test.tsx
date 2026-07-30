import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileHoldingsList } from "@/components/MobileHoldingsList";
import type { PortfolioItem } from "@/types";

function item(ticker: string, marketValue: number): PortfolioItem {
  return {
    ticker,
    companyName: `${ticker} Inc.`,
    sector: "Technology",
    shares: 10,
    avgCost: 100,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: { price: marketValue / 10, change: 1, changePercent: 0.9, previousClose: 100 },
    marketValue,
    totalPL: 5,
    totalPLPercent: 5,
  };
}

const many = Array.from({ length: 9 }, (_, i) => item(`T${i}`, (9 - i) * 100));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("MobileHoldingsList", () => {
  it("on the dashboard shows six rows and a Show all link, largest first", () => {
    render(
      <MobileHoldingsList items={many} totalValue={4500} variant="dashboard" onSelect={jest.fn()} />,
    );
    expect(screen.getAllByTestId("holding-row")).toHaveLength(6);
    expect(screen.getAllByTestId("holding-row")[0]).toHaveTextContent("T0"); // largest value
    expect(screen.getByRole("link", { name: /show all/i })).toHaveAttribute("href", "/holdings");
    // The total row belongs to the Holdings screen, not the Dashboard preview.
    expect(screen.queryByTestId("total-row")).toBeNull();
  });

  it("links Show all into /demo when in demo mode", () => {
    render(
      <MobileHoldingsList
        items={many}
        totalValue={4500}
        variant="dashboard"
        onSelect={jest.fn()}
        demo
      />,
    );
    expect(screen.getByRole("link", { name: /show all/i })).toHaveAttribute(
      "href",
      "/demo/holdings",
    );
  });

  it("on the holdings screen shows every row and no Show all link", () => {
    render(
      <MobileHoldingsList items={many} totalValue={4500} variant="holdings" onSelect={jest.fn()} />,
    );
    expect(screen.getAllByTestId("holding-row")).toHaveLength(9);
    expect(screen.queryByRole("link", { name: /show all/i })).toBeNull();
  });

  it("on the holdings screen shows a total row", () => {
    render(
      <MobileHoldingsList items={many} totalValue={4500} variant="holdings" onSelect={jest.fn()} />,
    );
    expect(screen.getByTestId("total-row")).toHaveTextContent("$4,500.00");
  });

  it("selects the item on tap", async () => {
    const onSelect = jest.fn();
    render(
      <MobileHoldingsList
        items={[item("AAA", 100)]}
        totalValue={100}
        variant="holdings"
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByTestId("holding-row"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ ticker: "AAA" }));
  });

  it("gives each row a 44px minimum touch target", () => {
    render(
      <MobileHoldingsList
        items={[item("AAA", 100)]}
        totalValue={100}
        variant="holdings"
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByTestId("holding-row")).toHaveClass("min-h-[44px]");
  });
});
