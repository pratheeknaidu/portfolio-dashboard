import { renderHook, act } from "@testing-library/react";
import { usePositionActions } from "@/lib/use-position-actions";
import type { PortfolioItem } from "@/types";

const mockGetIdToken = jest.fn<Promise<string | null>, []>();
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ getIdToken: () => mockGetIdToken() }) }));

const mockToastError = jest.fn();
jest.mock("@/lib/toast-context", () => ({
  useToast: () => ({
    error: mockToastError,
    info: jest.fn(),
    success: jest.fn(),
    show: jest.fn(),
    dismiss: jest.fn(),
    toasts: [],
  }),
}));

const item = (ticker: string): PortfolioItem => ({
  ticker,
  companyName: `${ticker} Inc.`,
  sector: "Technology",
  shares: 10,
  avgCost: 100,
  addedAt: "2026-01-02T00:00:00.000Z",
  quote: { price: 110, change: 1, changePercent: 0.9, previousClose: 109 },
  marketValue: 1100,
  totalPL: 100,
  totalPLPercent: 10,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetIdToken.mockResolvedValue("token-123");
});

describe("usePositionActions", () => {
  it("selecting a position sets it as the sheet target", () => {
    const { result } = renderHook(() => usePositionActions(jest.fn()));
    act(() => result.current.select(item("AAPL")));
    expect(result.current.selected?.ticker).toBe("AAPL");
  });

  it("edit closes the sheet and opens the edit modal for that item", () => {
    const { result } = renderHook(() => usePositionActions(jest.fn()));
    act(() => result.current.select(item("AAPL")));
    act(() => result.current.edit(item("AAPL")));
    expect(result.current.selected).toBeNull();
    expect(result.current.editing?.ticker).toBe("AAPL");
  });

  it("remove opens a confirm rather than deleting immediately", () => {
    const { result } = renderHook(() => usePositionActions(jest.fn()));
    act(() => result.current.remove(item("AAPL")));
    expect(result.current.confirming?.ticker).toBe("AAPL");
  });

  it("confirming the remove DELETEs the ticker and refreshes", async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const refresh = jest.fn();
    const { result } = renderHook(() => usePositionActions(refresh));
    act(() => result.current.remove(item("ZZZ")));
    await act(async () => {
      await result.current.confirmRemove();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/portfolio/ZZZ",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(refresh).toHaveBeenCalled();
    expect(result.current.confirming).toBeNull();
  });

  it("toasts and keeps the confirm open when the delete fails", async () => {
    const fetchMock = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const refresh = jest.fn();
    const { result } = renderHook(() => usePositionActions(refresh));
    act(() => result.current.remove(item("ZZZ")));
    await act(async () => {
      await result.current.confirmRemove();
    });
    expect(mockToastError).toHaveBeenCalledWith("Couldn't remove ZZZ.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("dismiss clears the sheet", () => {
    const { result } = renderHook(() => usePositionActions(jest.fn()));
    act(() => result.current.select(item("AAPL")));
    act(() => result.current.dismiss());
    expect(result.current.selected).toBeNull();
  });

  // The failed-tickers strip deletes a delisted symbol directly — it is never
  // in `items`, so the confirm-based remove(item) could not reach it.
  it("removeTicker deletes a bare ticker and refreshes, with no confirm", async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const refresh = jest.fn();
    const { result } = renderHook(() => usePositionActions(refresh));
    await act(async () => {
      await result.current.removeTicker("ZZZZ");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/portfolio/ZZZZ",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(refresh).toHaveBeenCalled();
    expect(result.current.confirming).toBeNull();
  });

  it("removeTicker does not refresh when the delete fails", async () => {
    const fetchMock = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const refresh = jest.fn();
    const { result } = renderHook(() => usePositionActions(refresh));
    await act(async () => {
      await result.current.removeTicker("ZZZZ");
    });
    expect(mockToastError).toHaveBeenCalledWith("Couldn't remove ZZZZ.");
    expect(refresh).not.toHaveBeenCalled();
  });
});
