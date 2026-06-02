import { render, screen } from "@testing-library/react";
import { VixPill } from "@/components/VixPill";

describe("VixPill", () => {
  it("renders nothing when data is null", () => {
    const { container } = render(<VixPill data={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when value is null", () => {
    const { container } = render(<VixPill data={{ value: null }} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the VIX value and sentiment label", () => {
    render(
      <VixPill
        data={{
          value: 28.5,
          sentiment: "Fearful",
          action: "Strong buy",
          tone: "opportunity",
          strength: "strong",
        }}
      />,
    );
    expect(screen.getByText("VIX 28.5")).toBeInTheDocument();
    expect(screen.getByText("Fearful")).toBeInTheDocument();
  });

  it("applies the tone-specific color class", () => {
    const { container } = render(
      <VixPill data={{ value: 28.5, sentiment: "Fearful", action: "Strong buy", tone: "opportunity", strength: "strong" }} />,
    );
    expect(container.firstChild).toHaveClass("bg-positive/20");
  });

  it("falls back to the neutral tone class when tone is absent", () => {
    const { container } = render(
      <VixPill data={{ value: 16.2, sentiment: "Steady", action: "Neutral" }} />,
    );
    expect(container.firstChild).toHaveClass("bg-surface-elevated/60");
  });
});
