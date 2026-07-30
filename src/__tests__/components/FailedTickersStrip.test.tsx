import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FailedTickersStrip } from "@/components/FailedTickersStrip";
import type { QuoteFailure } from "@/types";

const failures: QuoteFailure[] = [
  { ticker: "ZZZZ", reason: "unlisted" },
  { ticker: "HALT", reason: "no_price" },
];

const noop = () => {};

describe("FailedTickersStrip", () => {
  it("renders nothing when every quote resolved", () => {
    const { container } = render(
      <FailedTickersStrip failures={[]} excludedValue={0} onRetry={noop} onRemove={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("states the count and that the map still covers the rest", () => {
    render(
      <FailedTickersStrip failures={failures} excludedValue={1250} onRetry={noop} onRemove={noop} />,
    );
    expect(screen.getByText(/2 positions/i)).toBeInTheDocument();
    expect(screen.getByText(/rest of the map/i)).toBeInTheDocument();
  });

  it("states the excluded dollar value, so the total is not silently wrong", () => {
    render(
      <FailedTickersStrip failures={failures} excludedValue={1250} onRetry={noop} onRemove={noop} />,
    );
    expect(screen.getByText(/\$1,250\.00/)).toBeInTheDocument();
  });

  it("gives each ticker its own reason", () => {
    render(
      <FailedTickersStrip failures={failures} excludedValue={0} onRetry={noop} onRemove={noop} />,
    );
    expect(screen.getByText("Not found")).toBeInTheDocument();
    expect(screen.getByText("No price")).toBeInTheDocument();
  });

  it("offers Retry and Remove per ticker", async () => {
    const onRetry = jest.fn();
    const onRemove = jest.fn();
    render(
      <FailedTickersStrip
        failures={[failures[0]]}
        excludedValue={0}
        onRetry={onRetry}
        onRemove={onRemove}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /retry ZZZZ/i }));
    expect(onRetry).toHaveBeenCalledWith("ZZZZ");
    await userEvent.click(screen.getByRole("button", { name: /remove ZZZZ/i }));
    expect(onRemove).toHaveBeenCalledWith("ZZZZ");
  });

  // Amber, not red: a data problem must not read as a big loss.
  it("announces itself politely rather than as an alert", () => {
    render(
      <FailedTickersStrip failures={failures} excludedValue={0} onRetry={noop} onRemove={noop} />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("uses singular wording for a single failure", () => {
    render(
      <FailedTickersStrip
        failures={[failures[0]]}
        excludedValue={0}
        onRetry={noop}
        onRemove={noop}
      />,
    );
    expect(screen.getByText(/1 position/i)).toBeInTheDocument();
    expect(screen.queryByText(/1 positions/i)).toBeNull();
  });
});
