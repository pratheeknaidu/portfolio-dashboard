import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CsvImportModal } from "@/components/CsvImportModal";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ getIdToken: jest.fn().mockResolvedValue("mock-token") }),
}));

global.fetch = jest.fn();

const onClose = jest.fn();
const onSuccess = jest.fn();

function emptyResult(extra: Partial<{ imported: string[]; updated: string[]; removed: string[]; errors: string[] }> = {}) {
  return { imported: [], updated: [], removed: [], errors: [], ...extra };
}

async function switchToCsvTab() {
  await userEvent.click(screen.getByRole("button", { name: /upload csv/i }));
}

describe("CsvImportModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with paste mode as the default tab", () => {
    render(<CsvImportModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByText(/import holdings/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/paste positions/i)).toBeInTheDocument();
  });

  it("shows the file input after switching to CSV tab", async () => {
    render(<CsvImportModal onClose={onClose} onSuccess={onSuccess} />);
    await switchToCsvTab();
    expect(screen.getByLabelText(/choose file/i)).toBeInTheDocument();
  });

  it("disables the Import button when paste textarea is empty", () => {
    render(<CsvImportModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByRole("button", { name: /^import$/i })).toBeDisabled();
  });

  it("disables the Import button in CSV mode when no file is selected", async () => {
    render(<CsvImportModal onClose={onClose} onSuccess={onSuccess} />);
    await switchToCsvTab();
    expect(screen.getByRole("button", { name: /^import$/i })).toBeDisabled();
  });

  it("submits a CSV file and shows imported tickers in the success view", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptyResult({ imported: ["AAPL", "MSFT"] })),
    });

    render(<CsvImportModal onClose={onClose} onSuccess={onSuccess} />);
    await switchToCsvTab();

    const file = new File(
      ["Instrument,Quantity,Average Cost\nAAPL,50,142.80"],
      "holdings.csv",
      { type: "text/csv" },
    );
    await userEvent.upload(screen.getByLabelText(/choose file/i), file);

    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    await waitFor(() => {
      expect(screen.getByText(/imported: AAPL, MSFT/i)).toBeInTheDocument();
    });
  });

  it("calls onClose when Cancel is clicked", () => {
    render(<CsvImportModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("triggers onSuccess on partial failure (some imported, some errors)", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptyResult({ imported: ["AAPL"], errors: ["Unknown ticker: XYZ"] })),
    });

    render(<CsvImportModal onClose={onClose} onSuccess={onSuccess} />);
    await switchToCsvTab();

    const file = new File(["data"], "holdings.csv", { type: "text/csv" });
    await userEvent.upload(screen.getByLabelText(/choose file/i), file);

    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    await waitFor(() => {
      expect(screen.getByText(/imported: AAPL/i)).toBeInTheDocument();
      expect(screen.getByText(/Unknown ticker: XYZ/i)).toBeInTheDocument();
    });

    jest.runAllTimers();
    expect(onSuccess).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it("submits pasted text via JSON and shows imported tickers", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptyResult({ imported: ["AAPL"] })),
    });

    render(<CsvImportModal onClose={onClose} onSuccess={onSuccess} />);

    const textarea = screen.getByPlaceholderText(/paste positions/i);
    await userEvent.type(textarea, "AAPL 50 $142.80");

    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    await waitFor(() => {
      expect(screen.getByText(/imported: AAPL/i)).toBeInTheDocument();
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers["Content-Type"]).toBe("application/json");
  });
});
