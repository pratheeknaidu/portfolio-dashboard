import { render, screen } from "@testing-library/react";
import { TreemapLegend } from "@/components/TreemapLegend";

describe("TreemapLegend", () => {
  it("prints the domain at both ends so a quiet day is distinguishable", () => {
    render(<TreemapLegend domain={12} cvd={false} />);
    expect(screen.getByText("−12%")).toBeInTheDocument();
    expect(screen.getByText("+12%")).toBeInTheDocument();
  });

  it("renders a 21-stop gradient strip", () => {
    render(<TreemapLegend domain={1} cvd={false} />);
    expect(screen.getAllByTestId("legend-stop")).toHaveLength(21);
  });

  it("documents the flat / no-quote swatch", () => {
    render(<TreemapLegend domain={1} cvd={false} />);
    expect(screen.getByText("flat / no quote")).toBeInTheDocument();
  });

  it("states that lightness carries magnitude", () => {
    render(<TreemapLegend domain={1} cvd={false} />);
    expect(screen.getByText(/greyscale/i)).toBeInTheDocument();
  });
});
