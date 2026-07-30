import { render, screen } from "@testing-library/react";
import { PerformanceCard, yDomain, MIN_POINTS } from "@/components/PerformanceCard";
import type { Snapshot } from "@/types";

// Recharts needs real dimensions to emit an SVG; jsdom reports 0. Fully stub
// the chart parts (the pattern the repo's other chart tests use), with
// LineChart carrying a testid so composition is assertable.
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
}));

function snaps(values: number[]): Snapshot[] {
  return values.map((v, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, "0")}`,
    totalValue: v,
    holdings: {},
  }));
}

describe("yDomain", () => {
  it("brackets the data with a margin, never anchored at zero", () => {
    const [lo, hi] = yDomain([100000, 100500, 100200, 100800, 100400]);
    expect(lo).toBeGreaterThan(0);
    expect(lo).toBeLessThan(100000);
    expect(hi).toBeGreaterThan(100800);
  });

  it("does not collapse to a zero-height band for a flat series", () => {
    const [lo, hi] = yDomain([100000, 100000, 100000, 100000, 100000]);
    expect(hi).toBeGreaterThan(lo);
  });
});

describe("PerformanceCard", () => {
  it("draws the chart when there are at least five snapshots", () => {
    render(<PerformanceCard snapshots={snaps([1, 2, 3, 4, 5].map((n) => 100000 + n * 100))} />);
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    expect(screen.queryByText(/not enough history/i)).toBeNull();
  });

  it("renders an honest empty state under five snapshots", () => {
    render(<PerformanceCard snapshots={snaps([100000, 100500])} />);
    expect(screen.getByText(/not enough history/i)).toBeInTheDocument();
  });

  it("exposes the minimum-points threshold as five", () => {
    expect(MIN_POINTS).toBe(5);
  });
});
