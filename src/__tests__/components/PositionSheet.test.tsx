import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PositionSheet } from "@/components/PositionSheet";
import type { PortfolioItem } from "@/types";

const item: PortfolioItem = {
  ticker: "AAPL",
  companyName: "Apple Inc.",
  sector: "Technology",
  shares: 100,
  avgCost: 100,
  addedAt: "2026-01-02T00:00:00.000Z",
  quote: { price: 110, change: 2, changePercent: 1.85, previousClose: 108 },
  marketValue: 11000,
  totalPL: 1000,
  totalPLPercent: 10,
};

const props = { item, onClose: jest.fn(), onEdit: jest.fn(), onRemove: jest.fn() };

describe("PositionSheet", () => {
  it("renders nothing when there is no item", () => {
    const { container } = render(<PositionSheet {...props} item={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the company, ticker and sector", () => {
    render(<PositionSheet {...props} />);
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText(/Technology/)).toBeInTheDocument();
  });

  it("shows the position figures, formatted", () => {
    render(<PositionSheet {...props} />);
    expect(screen.getByText("$11,000.00")).toBeInTheDocument(); // market value
    expect(screen.getByText(/\+\$1,000\.00/)).toBeInTheDocument(); // total P&L
    expect(screen.getByText("100")).toBeInTheDocument(); // shares
  });

  it("uses a true minus sign on a loss, never a hyphen", () => {
    render(<PositionSheet {...props} item={{ ...item, totalPL: -250, totalPLPercent: -2 }} />);
    const el = screen.getByText(/250\.00/);
    expect(el.textContent).toContain("−");
    expect(el.textContent).not.toContain("-");
  });

  it("fires onEdit and onRemove from the footer", async () => {
    const onEdit = jest.fn();
    const onRemove = jest.fn();
    render(<PositionSheet {...props} onEdit={onEdit} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ ticker: "AAPL" }));
    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ ticker: "AAPL" }));
  });

  it("closes on the overlay", async () => {
    const onClose = jest.fn();
    render(<PositionSheet {...props} onClose={onClose} />);
    await userEvent.click(screen.getByTestId("sheet-overlay"));
    expect(onClose).toHaveBeenCalled();
  });

  it("gives both actions a 44px minimum touch target", () => {
    render(<PositionSheet {...props} />);
    expect(screen.getByRole("button", { name: /edit/i })).toHaveClass("min-h-[44px]");
    expect(screen.getByRole("button", { name: /remove/i })).toHaveClass("min-h-[44px]");
  });
});
