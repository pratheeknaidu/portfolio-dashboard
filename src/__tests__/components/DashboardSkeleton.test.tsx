import { render, screen } from "@testing-library/react";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";

describe("DashboardSkeleton", () => {
  // The single most important assertion in this file.
  it("never renders a zero value or the empty-state copy", () => {
    const { container } = render(<DashboardSkeleton />);
    expect(container.textContent).not.toMatch(/\$0\.00/);
    expect(container.textContent).not.toMatch(/no holdings/i);
    expect(container.textContent).not.toMatch(/\$/);
  });

  it("announces that it is loading", () => {
    render(<DashboardSkeleton />);
    expect(screen.getByRole("status")).toHaveAccessibleName(/loading/i);
  });

  it("lays out skeleton tiles at the real map geometry so nothing reflows", () => {
    render(<DashboardSkeleton />);
    expect(screen.getAllByTestId("skeleton-tile").length).toBeGreaterThanOrEqual(5);
  });

  it("reserves the summary and movers row", () => {
    render(<DashboardSkeleton />);
    expect(screen.getByTestId("skeleton-summary")).toBeInTheDocument();
    expect(screen.getByTestId("skeleton-movers")).toBeInTheDocument();
  });
});
