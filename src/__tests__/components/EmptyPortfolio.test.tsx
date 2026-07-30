import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyPortfolio } from "@/components/EmptyPortfolio";

describe("EmptyPortfolio", () => {
  it("offers both paths in, as real buttons", () => {
    render(<EmptyPortfolio onImportClick={jest.fn()} onAddClick={jest.fn()} />);
    expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add a stock/i })).toBeInTheDocument();
  });

  it("fires the right handler for each", async () => {
    const onImportClick = jest.fn();
    const onAddClick = jest.fn();
    render(<EmptyPortfolio onImportClick={onImportClick} onAddClick={onAddClick} />);
    await userEvent.click(screen.getByRole("button", { name: /import/i }));
    expect(onImportClick).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /add a stock/i }));
    expect(onAddClick).toHaveBeenCalled();
  });

  // The shipped secondary action was unstyled grey text with no affordance:
  // people did not know it was clickable.
  it("gives the secondary action a real border, not bare text", () => {
    render(<EmptyPortfolio onImportClick={jest.fn()} onAddClick={jest.fn()} />);
    expect(screen.getByRole("button", { name: /add a stock/i }).className).toMatch(/border/);
  });

  it("shows a ghost heat map so the user sees what they are about to get", () => {
    render(<EmptyPortfolio onImportClick={jest.fn()} onAddClick={jest.fn()} />);
    const ghost = screen.getByTestId("ghost-map");
    expect(ghost).toHaveAttribute("aria-hidden", "true");
    expect(ghost).toHaveClass("opacity-[0.55]");
  });

  it("gives both actions a 44px minimum touch target", () => {
    render(<EmptyPortfolio onImportClick={jest.fn()} onAddClick={jest.fn()} />);
    expect(screen.getByRole("button", { name: /import/i })).toHaveClass("min-h-[44px]");
    expect(screen.getByRole("button", { name: /add a stock/i })).toHaveClass("min-h-[44px]");
  });
});
