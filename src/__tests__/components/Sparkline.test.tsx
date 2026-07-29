import { render, screen } from "@testing-library/react";
import { Sparkline } from "@/components/Sparkline";

const series = [100, 105, 103, 110, 108, 115];

describe("Sparkline", () => {
  it("draws a path through the series", () => {
    const { container } = render(<Sparkline values={series} />);
    const path = container.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path!.getAttribute("d")!.length).toBeGreaterThan(10);
  });

  // Spec, Known gaps: /api/snapshot only accumulates from first load, so a new
  // account has one or two points. Drawing a two-point line implies a trend
  // that was never measured.
  it("renders an honest note instead of a line under five points", () => {
    const { container } = render(<Sparkline values={[100, 120]} />);
    expect(container.querySelector("path")).toBeNull();
    expect(screen.getByText(/not enough history/i)).toBeInTheDocument();
  });

  it("draws once it has five points", () => {
    const { container } = render(<Sparkline values={[1, 2, 3, 4, 5]} />);
    expect(container.querySelector("path")).toBeInTheDocument();
  });

  it("renders the empty note for no data at all", () => {
    render(<Sparkline values={[]} />);
    expect(screen.getByText(/not enough history/i)).toBeInTheDocument();
  });

  it("colours by direction of the whole series, not the last step", () => {
    const { container: up } = render(<Sparkline values={[100, 90, 95, 92, 130]} />);
    expect(up.querySelector("path")).toHaveAttribute("stroke", "var(--rd-gain)");
    const { container: down } = render(<Sparkline values={[130, 140, 120, 135, 100]} />);
    expect(down.querySelector("path")).toHaveAttribute("stroke", "var(--rd-loss)");
  });

  // The pair above happens to agree on direction whether you compare
  // first-vs-last or the final two points, so a last-step implementation
  // would pass it too. These series disagree on purpose: overall trend down
  // but the last step up, and vice versa.
  it("disagrees with a last-step comparison on these series", () => {
    const { container: overallDown } = render(<Sparkline values={[100, 40, 30, 20, 50]} />);
    expect(overallDown.querySelector("path")).toHaveAttribute("stroke", "var(--rd-loss)");
    const { container: overallUp } = render(<Sparkline values={[100, 200, 210, 220, 150]} />);
    expect(overallUp.querySelector("path")).toHaveAttribute("stroke", "var(--rd-gain)");
  });

  // A flat series has zero range; scaling by it yields NaN in every y value
  // and React renders d="MNaN,NaN..." silently.
  it("survives a perfectly flat series without emitting NaN", () => {
    const { container } = render(<Sparkline values={[100, 100, 100, 100, 100]} />);
    expect(container.querySelector("path")!.getAttribute("d")).not.toContain("NaN");
  });

  it("is hidden from assistive tech, since the numbers beside it are the content", () => {
    const { container } = render(<Sparkline values={series} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  // A single NaN in the series poisons min/max and turns every y into a literal
  // "NaN" in the path, which React renders silently — the exact failure the
  // range guard claims to prevent but did not, since it only covered flat data.
  it("drops a non-finite point instead of emitting NaN across the whole path", () => {
    const { container } = render(<Sparkline values={[100, 105, NaN, 110, 108, 115]} />);
    const d = container.querySelector("path")!.getAttribute("d")!;
    expect(d).not.toContain("NaN");
    // Five finite points remain, so it still draws rather than falling back.
    expect(container.querySelector("path")).toBeInTheDocument();
  });

  it("falls back to the note when too few points survive the finite filter", () => {
    const { container } = render(<Sparkline values={[100, NaN, Infinity, 105, -Infinity]} />);
    expect(container.querySelector("path")).toBeNull();
    expect(screen.getByText(/not enough history/i)).toBeInTheDocument();
  });
});
