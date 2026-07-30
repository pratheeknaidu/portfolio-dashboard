import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PositionsTable } from "@/components/PositionsTable";
import type { PortfolioItem } from "@/types";

function item(ticker: string, marketValue: number, totalPL = 0): PortfolioItem {
  return {
    ticker,
    companyName: `${ticker} Inc.`,
    sector: "Technology",
    shares: 10,
    avgCost: 100,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: { price: marketValue / 10, change: 1, changePercent: 0.9, previousClose: 100 },
    marketValue,
    totalPL,
    totalPLPercent: 5,
  };
}

const items = [item("AAA", 100, 5), item("BBB", 300, -10), item("CCC", 200, 20)];

describe("PositionsTable", () => {
  it("renders a row per holding with its ticker", () => {
    render(<PositionsTable items={items} totalValue={600} onSelect={jest.fn()} />);
    for (const t of ["AAA", "BBB", "CCC"]) {
      expect(screen.getByRole("row", { name: new RegExp(t) })).toBeInTheDocument();
    }
  });

  it("defaults to market value, descending", () => {
    render(<PositionsTable items={items} totalValue={600} onSelect={jest.fn()} />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getByTestId("cell-ticker").textContent)).toEqual(["BBB", "CCC", "AAA"]);
  });

  it("re-sorts when a column header is clicked, and flips direction on a second click", async () => {
    render(<PositionsTable items={items} totalValue={600} onSelect={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /total p&l/i }));
    let rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getByTestId("cell-ticker").textContent)).toEqual(["CCC", "AAA", "BBB"]);
    await userEvent.click(screen.getByRole("button", { name: /total p&l/i }));
    rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getByTestId("cell-ticker").textContent)).toEqual(["BBB", "AAA", "CCC"]);
  });

  it("marks the active sort column with aria-sort and clears the others", async () => {
    render(<PositionsTable items={items} totalValue={600} onSelect={jest.fn()} />);
    expect(screen.getByRole("columnheader", { name: /value/i })).toHaveAttribute("aria-sort", "descending");
    // A freshly clicked column opens descending (largest first).
    await userEvent.click(screen.getByRole("button", { name: /shares/i }));
    expect(screen.getByRole("columnheader", { name: /shares/i })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: /value/i })).not.toHaveAttribute("aria-sort");
    // A second click flips it to ascending.
    await userEvent.click(screen.getByRole("button", { name: /shares/i }));
    expect(screen.getByRole("columnheader", { name: /shares/i })).toHaveAttribute("aria-sort", "ascending");
  });

  it("calls onSelect with the row's item when a row is activated", async () => {
    const onSelect = jest.fn();
    render(<PositionsTable items={items} totalValue={600} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("row", { name: /AAA/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ ticker: "AAA" }));
  });

  it("carries a P&L direction glyph, not colour alone", () => {
    render(<PositionsTable items={items} totalValue={600} onSelect={jest.fn()} />);
    const bbb = screen.getByRole("row", { name: /BBB/ });
    expect(within(bbb).getByTestId("cell-totalPL").textContent).toMatch(/▼/);
  });

  it("shows an empty note rather than a bare header when there are no holdings", () => {
    render(<PositionsTable items={[]} totalValue={0} onSelect={jest.fn()} />);
    expect(screen.getByText(/no holdings/i)).toBeInTheDocument();
  });
});
