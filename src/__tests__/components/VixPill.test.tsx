import { render, screen, fireEvent } from "@testing-library/react";
import { VixPill } from "@/components/VixPill";

const sample = {
  value: 28.5,
  band: "27–33",
  sentiment: "Fearful",
  action: "Strong buy",
  message: "Lean into the fear",
  tone: "opportunity" as const,
  strength: "strong" as const,
};

describe("VixPill", () => {
  it("renders nothing when data is null", () => {
    const { container } = render(<VixPill data={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when value is null", () => {
    const { container } = render(<VixPill data={{ value: null }} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the VIX value and the conversational message inline", () => {
    render(<VixPill data={sample} />);
    expect(screen.getByText("VIX 28.5")).toBeInTheDocument();
    expect(screen.getByText("Lean into the fear")).toBeInTheDocument();
  });

  it("applies the tone-specific color class to the pill", () => {
    render(<VixPill data={sample} />);
    expect(screen.getByText("VIX 28.5").parentElement).toHaveClass("bg-positive/20");
  });

  it("falls back to the neutral tone class when tone is absent", () => {
    render(<VixPill data={{ value: 16.2, message: "Stay the course" }} />);
    expect(screen.getByText("VIX 16.2").parentElement).toHaveClass(
      "bg-surface-elevated/60",
    );
  });

  it("does not show the explainer popover until the info button is clicked", () => {
    render(<VixPill data={sample} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the band-scale popover when the info button is clicked", () => {
    render(<VixPill data={sample} />);
    fireEvent.click(screen.getByRole("button", { name: /how vix/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // full scale rendered: a band the pill isn't currently in...
    expect(screen.getByText("Be greedy now")).toBeInTheDocument();
    // ...and the mood word, which only appears in the popover (inline shows message)
    expect(screen.getByText("Fearful")).toBeInTheDocument();
  });

  it("marks the current band as active in the popover", () => {
    render(<VixPill data={sample} />);
    fireEvent.click(screen.getByRole("button", { name: /how vix/i }));
    expect(screen.getByLabelText("current band")).toBeInTheDocument();
  });

  it("closes the popover on Escape", () => {
    render(<VixPill data={sample} />);
    fireEvent.click(screen.getByRole("button", { name: /how vix/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
