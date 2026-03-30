import { render, screen } from "@testing-library/react";
import { SectorChart } from "@/components/SectorChart";

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div />,
  Cell: () => <div />,
  Legend: () => <div />,
  Tooltip: () => <div />,
}));

describe("SectorChart", () => {
  it("renders the pie chart with sector data", () => {
    const sectors = { Technology: 18000, Energy: 9500, Healthcare: 5000 };
    render(<SectorChart sectors={sectors} />);
    expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
  });

  it("shows sector legend labels", () => {
    const sectors = { Technology: 18000 };
    render(<SectorChart sectors={sectors} />);
    expect(screen.getByText("Technology")).toBeInTheDocument();
  });
});
