import { render, screen } from "@testing-library/react";
import { StatusPill } from "@/components/StatusPill";

describe("StatusPill", () => {
  it("states that the market is open", () => {
    render(<StatusPill open asOf="4:00 PM ET" />);
    expect(screen.getByText(/open/i)).toBeInTheDocument();
  });

  it("states when the market closed, not just that it is closed", () => {
    render(<StatusPill open={false} asOf="4:00 PM ET" />);
    expect(screen.getByText(/closed/i)).toBeInTheDocument();
    expect(screen.getByText(/4:00 PM ET/)).toBeInTheDocument();
  });

  // The shipped pill is a rounded-full bordered pill identical to the Add and
  // Sign in buttons beside it, so it reads as a control that does nothing.
  // Scoped to the root: a small circular status dot inside is not the same
  // affordance as a pill-shaped, bordered, button-height container.
  it("is not a button and carries no button affordance", () => {
    render(<StatusPill open={false} asOf="4:00 PM ET" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("status")).not.toHaveClass("rounded-full");
  });

  it("announces itself as a live status region", () => {
    render(<StatusPill open asOf="4:00 PM ET" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // Never colour alone: the dot is reinforced by the word beside it.
  it("carries the state in text, not only in the dot colour", () => {
    const { rerender } = render(<StatusPill open asOf="4:00 PM ET" />);
    expect(screen.getByRole("status")).toHaveTextContent(/open/i);
    rerender(<StatusPill open={false} asOf="4:00 PM ET" />);
    expect(screen.getByRole("status")).toHaveTextContent(/closed/i);
  });
});
