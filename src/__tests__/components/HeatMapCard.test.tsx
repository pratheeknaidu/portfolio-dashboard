// HeatMapCard pulls in Treemap, which pulls in Nivo's ESM build that jest
// cannot parse. SegmentedGroup itself never touches it.
jest.mock("@nivo/treemap", () => ({
  ResponsiveTreeMapHtml: () => null,
}));

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedGroup } from "@/components/HeatMapCard";

describe("SegmentedGroup", () => {
  const opts = [
    { value: "equity", label: "Equity" },
    { value: "profit", label: "P&L" },
  ];

  it("labels the group so it does not merge with its neighbour", () => {
    render(<SegmentedGroup label="Size" options={opts} value="equity" onChange={jest.fn()} />);
    // The caps are CSS, not content — text-transform never reaches the DOM,
    // so assert the real text plus the class that uppercases it.
    const caption = screen.getByText("Size");
    expect(caption).toBeInTheDocument();
    expect(caption).toHaveClass("uppercase");
  });

  // Undifferentiated, the two groups read as one nine-segment control.
  it("associates the label with the group for screen readers", () => {
    render(<SegmentedGroup label="Size" options={opts} value="equity" onChange={jest.fn()} />);
    expect(screen.getByRole("group", { name: "Size" })).toBeInTheDocument();
  });

  it("marks the active option with aria-pressed, not just a fill", () => {
    render(<SegmentedGroup label="Size" options={opts} value="equity" onChange={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Equity" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "P&L" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the selected value", async () => {
    const onChange = jest.fn();
    render(<SegmentedGroup label="Size" options={opts} value="equity" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "P&L" }));
    expect(onChange).toHaveBeenCalledWith("profit");
  });
});
