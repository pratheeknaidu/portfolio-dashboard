import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddHoldingModal } from "@/components/AddHoldingModal";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ getIdToken: jest.fn().mockResolvedValue("mock-token") }),
}));

global.fetch = jest.fn();

describe("AddHoldingModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("disables Add until ticker, shares, and avgCost are all valid", async () => {
    render(<AddHoldingModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    const addBtn = screen.getByRole("button", { name: /add/i });
    expect(addBtn).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/ticker/i), "AAPL");
    await userEvent.type(screen.getByLabelText(/shares/i), "10");
    expect(addBtn).toBeDisabled(); // avgCost still missing

    await userEvent.type(screen.getByLabelText(/avg cost/i), "150");
    expect(addBtn).toBeEnabled();
  });

  it("POSTs an uppercased ticker to /api/portfolio and calls onSuccess on 2xx", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ticker: "AAPL" }),
    });
    const onSuccess = jest.fn();
    render(<AddHoldingModal onClose={jest.fn()} onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/ticker/i), "aapl");
    await userEvent.type(screen.getByLabelText(/shares/i), "10");
    await userEvent.type(screen.getByLabelText(/avg cost/i), "150");
    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/portfolio");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.ticker).toBe("AAPL");
    expect(body.shares).toBe(10);
    expect(body.avgCost).toBe(150);
  });

  it("shows the server's error inline on non-2xx and keeps the modal open", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "AAPL is already in your portfolio. Edit it instead." }),
    });
    const onSuccess = jest.fn();
    render(<AddHoldingModal onClose={jest.fn()} onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/ticker/i), "AAPL");
    await userEvent.type(screen.getByLabelText(/shares/i), "10");
    await userEvent.type(screen.getByLabelText(/avg cost/i), "150");
    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    await waitFor(() =>
      expect(screen.getByText(/already in your portfolio/i)).toBeInTheDocument(),
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = jest.fn();
    render(<AddHoldingModal onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
