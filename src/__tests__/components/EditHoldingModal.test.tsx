import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditHoldingModal } from "@/components/EditHoldingModal";
import type { PortfolioItem } from "@/types";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ getIdToken: jest.fn().mockResolvedValue("mock-token") }),
}));

global.fetch = jest.fn();

const holding: PortfolioItem = {
  ticker: "AAPL",
  companyName: "Apple Inc.",
  sector: "Technology",
  shares: 50,
  avgCost: 142.8,
  addedAt: "",
  quote: { price: 185.5, change: 2.3, changePercent: 1.25, previousClose: 183.2 },
  marketValue: 9275,
  totalPL: 2135,
  totalPLPercent: 29.9,
};

describe("EditHoldingModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prefills shares and avgCost from the holding", () => {
    render(<EditHoldingModal holding={holding} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByLabelText(/shares/i)).toHaveValue(50);
    expect(screen.getByLabelText(/avg cost/i)).toHaveValue(142.8);
  });

  it("disables Save when shares is 0 or negative", async () => {
    render(<EditHoldingModal holding={holding} onClose={jest.fn()} onSuccess={jest.fn()} />);
    const sharesInput = screen.getByLabelText(/shares/i);
    await userEvent.clear(sharesInput);
    await userEvent.type(sharesInput, "0");
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("disables Save when avgCost is 0", async () => {
    render(<EditHoldingModal holding={holding} onClose={jest.fn()} onSuccess={jest.fn()} />);
    const costInput = screen.getByLabelText(/avg cost/i);
    await userEvent.clear(costInput);
    await userEvent.type(costInput, "0");
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("sends PATCH with the updated values and calls onSuccess on 2xx", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ticker: "AAPL", shares: 75, avgCost: 142.8 }),
    });
    const onSuccess = jest.fn();
    render(<EditHoldingModal holding={holding} onClose={jest.fn()} onSuccess={onSuccess} />);

    const sharesInput = screen.getByLabelText(/shares/i);
    await userEvent.clear(sharesInput);
    await userEvent.type(sharesInput, "75");

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/portfolio/AAPL");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body);
    expect(body.shares).toBe(75);
    expect(body.avgCost).toBe(142.8);
  });

  it("shows the server's error message inline on non-2xx and keeps the modal open", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "shares must be a positive number" }),
    });
    const onSuccess = jest.fn();
    render(<EditHoldingModal holding={holding} onClose={jest.fn()} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(screen.getByText(/shares must be a positive number/i)).toBeInTheDocument(),
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = jest.fn();
    render(<EditHoldingModal holding={holding} onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
