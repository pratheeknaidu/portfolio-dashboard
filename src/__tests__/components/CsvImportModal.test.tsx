import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CsvImportModal } from "@/components/CsvImportModal";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ getIdToken: jest.fn().mockResolvedValue("mock-token") }),
}));

global.fetch = jest.fn();

describe("CsvImportModal", () => {
  const onClose = jest.fn();
  const onSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders file upload input and submit button", () => {
    render(<CsvImportModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByText(/import csv/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/choose file/i)).toBeInTheDocument();
  });

  it("disables submit when no file selected", () => {
    render(<CsvImportModal onClose={onClose} onSuccess={onSuccess} />);
    const submitBtn = screen.getByRole("button", { name: /upload/i });
    expect(submitBtn).toBeDisabled();
  });

  it("shows success results after upload", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ imported: ["AAPL", "MSFT"], updated: [], errors: [] }),
    });

    render(<CsvImportModal onClose={onClose} onSuccess={onSuccess} />);

    const file = new File(["Instrument,Quantity,Average Cost\nAAPL,50,142.80"], "holdings.csv", { type: "text/csv" });
    const input = screen.getByLabelText(/choose file/i);
    await userEvent.upload(input, file);

    fireEvent.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/imported: AAPL, MSFT/i)).toBeInTheDocument();
    });
  });

  it("calls onClose when cancel clicked", () => {
    render(<CsvImportModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
