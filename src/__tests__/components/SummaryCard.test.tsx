import { render, screen } from "@testing-library/react";
import { SummaryCard } from "@/components/SummaryCard";
import type { PortfolioTotals } from "@/lib/design/portfolio-totals";

const totals: PortfolioTotals = {
  totalValue: 155876.26,
  costBasis: 134481,
  totalPL: 21395.26,
  totalPLPercent: 15.91,
  dayChange: 80.92,
  dayChangePercent: 0.05,
};

describe("SummaryCard", () => {
  it("prints the portfolio value in full, never abbreviated", () => {
    render(<SummaryCard totals={totals} snapshots={[]} />);
    expect(screen.getByText("$155,876.26")).toBeInTheDocument();
  });

  it("prints today's change with an explicit sign and its percentage", () => {
    render(<SummaryCard totals={totals} snapshots={[]} />);
    expect(screen.getByText(/\+\$80\.92/)).toBeInTheDocument();
    expect(screen.getByText(/\+0\.05%/)).toBeInTheDocument();
  });

  it("uses a true minus sign on a down day, never a hyphen", () => {
    render(
      <SummaryCard totals={{ ...totals, dayChange: -60.97, dayChangePercent: -0.04 }} snapshots={[]} />,
    );
    const el = screen.getByText(/60\.97/);
    expect(el.textContent).toContain("−");
    expect(el.textContent).not.toContain("-");
  });

  // Never colour alone.
  it("carries direction as a glyph as well as a colour", () => {
    const { rerender } = render(<SummaryCard totals={totals} snapshots={[]} />);
    expect(screen.getByTestId("day-change")).toHaveTextContent("▲");
    rerender(<SummaryCard totals={{ ...totals, dayChange: -1, dayChangePercent: -0.01 }} snapshots={[]} />);
    expect(screen.getByTestId("day-change")).toHaveTextContent("▼");
  });

  it("uses the flat glyph when nothing moved", () => {
    render(<SummaryCard totals={{ ...totals, dayChange: 0, dayChangePercent: 0 }} snapshots={[]} />);
    expect(screen.getByTestId("day-change")).toHaveTextContent("◆");
  });

  it("shows cost basis and total P&L as supporting figures", () => {
    render(<SummaryCard totals={totals} snapshots={[]} />);
    expect(screen.getByText("$134,481.00")).toBeInTheDocument();
    expect(screen.getByText(/\+\$21,395\.26/)).toBeInTheDocument();
  });

  // The review's headline finding: the number people open the app for was
  // smaller than the chrome around it. (fontSize via getComputedStyle does not
  // work in jsdom — no Tailwind stylesheet — so assert the shipped class size.)
  it("renders today's change larger than the supporting figures", () => {
    render(<SummaryCard totals={totals} snapshots={[]} />);
    const day = screen.getByTestId("day-change");
    const support = screen.getByTestId("cost-basis");
    const pxSize = (el: HTMLElement) => {
      const m = el.className.match(/text-\[(\d+)px\]/);
      if (!m) throw new Error(`no text-[Npx] class on ${el.getAttribute("data-testid")}`);
      return Number(m[1]);
    };
    expect(pxSize(day)).toBeGreaterThan(pxSize(support));
  });

  it("passes snapshot history to the sparkline", () => {
    const history = [1, 2, 3, 4, 5, 6].map((n) => ({
      date: `2026-07-0${n}`,
      totalValue: 100 + n,
      holdings: {},
    }));
    const { container } = render(<SummaryCard totals={totals} snapshots={history} />);
    expect(container.querySelector("path")).toBeInTheDocument();
  });
});
