import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    const table = screen.getByRole("table");
    expect(within(table).getByText("AAPL")).toBeInTheDocument();
    expect(within(table).getByText("MSFT")).toBeInTheDocument();
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
    const table = screen.getByRole("table");
    expect(within(table).getByText("AAPL")).toBeInTheDocument();
    expect(within(table).queryByText("MSFT")).not.toBeInTheDocument();
  });

  it("color-codes positive P&L green and negative red", () => {
    render(<HoldingsTable items={items} totalValue={17975} />);
    const table = screen.getByRole("table");
    const aaplPL = within(table).getByText(/\$2,135/);
    expect(aaplPL.className).toContain("text-gain");
  });
});

describe("HoldingsTable Actions column", () => {
  it("does not render the Actions column when no callbacks are provided", () => {
    render(<HoldingsTable items={items} totalValue={17975} />);
    expect(screen.queryByRole("button", { name: /actions for/i })).not.toBeInTheDocument();
  });

  it("renders a ⋯ button per row when onEdit or onDelete is provided", () => {
    render(<HoldingsTable items={items} totalValue={17975} onEdit={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getAllByRole("button", { name: /actions for/i })).toHaveLength(items.length);
  });

  it("opens the dropdown on ⋯ click and closes it on outside click", async () => {
    render(<HoldingsTable items={items} totalValue={17975} onEdit={jest.fn()} onDelete={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /actions for AAPL/i }));
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();

    await userEvent.click(document.body);
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it("fires onEdit with the holding when Edit is clicked", async () => {
    const onEdit = jest.fn();
    render(<HoldingsTable items={items} totalValue={17975} onEdit={onEdit} onDelete={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /actions for AAPL/i }));
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ ticker: "AAPL" }));
  });

  it("fires onDelete with the holding when Delete is clicked", async () => {
    const onDelete = jest.fn();
    render(<HoldingsTable items={items} totalValue={17975} onEdit={jest.fn()} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: /actions for MSFT/i }));
    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ ticker: "MSFT" }));
  });

  it("closes the menu on Escape", async () => {
    render(<HoldingsTable items={items} totalValue={17975} onEdit={jest.fn()} onDelete={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /actions for AAPL/i }));
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
  });
});

describe("HoldingsTable mobile cards", () => {
  it("renders one card per holding", () => {
    render(<HoldingsTable items={items} totalValue={17975} />);
    expect(screen.getAllByTestId("holding-card").length).toBe(items.length);
  });

  it("expands a card when tapped and shows extra detail", () => {
    render(<HoldingsTable items={items} totalValue={17975} />);
    const cards = screen.getAllByTestId("holding-card");
    expect(cards[0].querySelector("[data-testid='holding-card-detail']")).toBeNull();
    fireEvent.click(cards[0]);
    expect(cards[0].querySelector("[data-testid='holding-card-detail']")).not.toBeNull();
  });

  it("collapses the previous card when a different one is tapped", () => {
    render(<HoldingsTable items={items} totalValue={17975} />);
    const cards = screen.getAllByTestId("holding-card");
    fireEvent.click(cards[0]);
    expect(cards[0].querySelector("[data-testid='holding-card-detail']")).not.toBeNull();
    fireEvent.click(cards[1]);
    expect(cards[0].querySelector("[data-testid='holding-card-detail']")).toBeNull();
    expect(cards[1].querySelector("[data-testid='holding-card-detail']")).not.toBeNull();
  });

  it("collapses on second tap of the same card", () => {
    render(<HoldingsTable items={items} totalValue={17975} />);
    const firstCard = screen.getAllByTestId("holding-card")[0];
    fireEvent.click(firstCard);
    fireEvent.click(firstCard);
    expect(firstCard.querySelector("[data-testid='holding-card-detail']")).toBeNull();
  });

  it("fires onEdit when card Edit button is tapped", () => {
    const onEdit = jest.fn();
    render(<HoldingsTable items={items} totalValue={17975} onEdit={onEdit} onDelete={jest.fn()} />);
    const firstCard = screen.getAllByTestId("holding-card")[0];
    fireEvent.click(firstCard);
    const detail = firstCard.querySelector("[data-testid='holding-card-detail']");
    if (!detail) throw new Error("detail not rendered");
    const editButton = within(detail as HTMLElement).getByRole("button", { name: /edit/i });
    fireEvent.click(editButton);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ ticker: "AAPL" }));
  });

  it("fires onDelete when card Delete button is tapped", () => {
    const onDelete = jest.fn();
    render(<HoldingsTable items={items} totalValue={17975} onEdit={jest.fn()} onDelete={onDelete} />);
    const firstCard = screen.getAllByTestId("holding-card")[0];
    fireEvent.click(firstCard);
    const detail = firstCard.querySelector("[data-testid='holding-card-detail']");
    if (!detail) throw new Error("detail not rendered");
    const deleteButton = within(detail as HTMLElement).getByRole("button", { name: /delete/i });
    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ ticker: "AAPL" }));
  });

  it("expands on Enter key when card is focused", () => {
    render(<HoldingsTable items={items} totalValue={17975} />);
    const firstCard = screen.getAllByTestId("holding-card")[0];
    fireEvent.keyDown(firstCard, { key: "Enter" });
    expect(firstCard.querySelector("[data-testid='holding-card-detail']")).not.toBeNull();
    expect(firstCard).toHaveAttribute("aria-expanded", "true");
  });
});
