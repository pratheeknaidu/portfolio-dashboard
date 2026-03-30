import { render, screen } from "@testing-library/react";
import { PerformanceChart } from "@/components/PerformanceChart";

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
}));

describe("PerformanceChart", () => {
  it("renders line chart when snapshots exist", () => {
    const snapshots = [
      { date: "2026-03-20", totalValue: 45000, holdings: {} },
      { date: "2026-03-26", totalValue: 48000, holdings: {} },
    ];
    render(<PerformanceChart snapshots={snapshots} />);
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("shows 'Not enough data yet' when fewer than 2 snapshots", () => {
    render(<PerformanceChart snapshots={[]} />);
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument();
  });
});
