import { renderHook, waitFor, act } from "@testing-library/react";
import { usePortfolioData } from "@/lib/use-portfolio-data";
import type { Holding, PortfolioItem, Quote, TimeRange } from "@/types";

// The three contexts are mocked rather than mounted so what is under test is
// the hook's own fetch/merge/derive/status logic, not provider plumbing.
//
// Each mock returns a STABLE object. `refresh` is a useCallback keyed on
// getIdToken/toast/isDemo, and the mount effect depends on `refresh` — a fresh
// object per render would change its identity every render and spin the effect
// forever.
const mockGetIdToken = jest.fn<Promise<string | null>, []>();
const mockAuth = { getIdToken: () => mockGetIdToken() };
jest.mock("@/lib/auth-context", () => ({ useAuth: () => mockAuth }));

const mockToastError = jest.fn();
const mockToast = {
  toasts: [],
  show: jest.fn(),
  error: mockToastError,
  info: jest.fn(),
  success: jest.fn(),
  dismiss: jest.fn(),
};
jest.mock("@/lib/toast-context", () => ({ useToast: () => mockToast }));

let isDemo = false;
jest.mock("@/lib/demo-context", () => ({ useIsDemo: () => isDemo }));

const mockIsMarketOpen = jest.fn(() => false);
jest.mock("@/lib/market-hours", () => ({ isMarketOpen: () => mockIsMarketOpen() }));

const demoItem = { ticker: "DEMO" } as unknown as PortfolioItem;
const mockBuildDemoItems = jest.fn((_range: TimeRange) => [demoItem]);
jest.mock("@/lib/demo-data", () => ({
  buildDemoItems: (range: TimeRange) => mockBuildDemoItems(range),
}));

// --- fixtures ---------------------------------------------------------------

const holding = (over: Partial<Holding> = {}): Holding => ({
  ticker: "AAPL",
  companyName: "Apple Inc.",
  sector: "Technology",
  shares: 100,
  avgCost: 100,
  addedAt: "2026-01-02T00:00:00.000Z",
  ...over,
});

const quote = (over: Partial<Quote> = {}): Quote => ({
  price: 110,
  change: 1,
  changePercent: 0.92,
  previousClose: 109,
  ...over,
});

/** Route stubbed responses by URL so tests declare only what they care about. */
function stubFetch(routes: {
  holdings?: { ok?: boolean; status?: number; body?: unknown };
  quotes?: { ok?: boolean; body?: unknown };
  throws?: boolean;
}) {
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    void init;
    if (routes.throws) throw new Error("offline");
    if (url.startsWith("/api/portfolio")) {
      const r = routes.holdings ?? { ok: true, body: [] };
      return {
        ok: r.ok ?? true,
        status: r.status ?? 200,
        json: async () => r.body,
      };
    }
    if (url.startsWith("/api/quotes")) {
      const r = routes.quotes ?? { ok: true, body: { quotes: {}, failed: [] } };
      return { ok: r.ok ?? true, status: 200, json: async () => r.body };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const render = (range: TimeRange = "1D") => renderHook(() => usePortfolioData(range));

beforeEach(() => {
  jest.clearAllMocks();
  isDemo = false;
  mockGetIdToken.mockResolvedValue("token-123");
  mockIsMarketOpen.mockReturnValue(false);
  mockBuildDemoItems.mockReturnValue([demoItem]);
});

// --- status machine ---------------------------------------------------------

describe("usePortfolioData status", () => {
  // loading must be distinguishable from empty: the shipped app rendered $0.00
  // and "No holdings yet" while the first fetch was still in flight.
  it("starts in loading before anything resolves", () => {
    stubFetch({});
    mockGetIdToken.mockReturnValue(new Promise(() => {})); // never settles
    const { result } = render();
    expect(result.current.status).toBe("loading");
    expect(result.current.items).toEqual([]);
  });

  it("reports empty when the user has no holdings", async () => {
    stubFetch({ holdings: { body: [] } });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("empty"));
    expect(result.current.items).toEqual([]);
  });

  it("reports empty when every holding is missing a quote", async () => {
    stubFetch({
      holdings: { body: [holding()] },
      quotes: { body: { quotes: {}, failed: ["AAPL"] } },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("empty"));
  });

  it("reports ready once holdings and quotes merge", async () => {
    stubFetch({
      holdings: { body: [holding()] },
      quotes: { body: { quotes: { AAPL: quote() }, failed: [] } },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.items).toHaveLength(1);
  });

  it("reports error and clears items when the holdings call fails", async () => {
    stubFetch({ holdings: { ok: false, status: 503 } });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.items).toEqual([]);
    expect(mockToastError).toHaveBeenCalledWith("Couldn't load your holdings (503).");
  });

  it("reports error when the quotes call fails", async () => {
    stubFetch({ holdings: { body: [holding()] }, quotes: { ok: false } });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(mockToastError).toHaveBeenCalledWith(
      "Quotes service is unavailable. Showing last-known values.",
    );
  });

  it("reports error when the network throws", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    stubFetch({ throws: true });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(mockToastError).toHaveBeenCalledWith("Network error — couldn't refresh portfolio.");
    spy.mockRestore();
  });

  // A signed-out render must not fall through to "empty" and flash the
  // no-holdings state at someone who simply has no token yet.
  it("stays in loading when there is no auth token", async () => {
    const fetchMock = stubFetch({});
    mockGetIdToken.mockResolvedValue(null);
    const { result } = render();
    await waitFor(() => expect(mockGetIdToken).toHaveBeenCalled());
    expect(result.current.status).toBe("loading");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// --- merge and derive -------------------------------------------------------

describe("usePortfolioData merging", () => {
  it("derives market value and P&L from shares, price and cost", async () => {
    stubFetch({
      holdings: { body: [holding({ shares: 100, avgCost: 100 })] },
      quotes: { body: { quotes: { AAPL: quote({ price: 110 }) }, failed: [] } },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const item = result.current.items[0];
    expect(item.marketValue).toBe(11000);
    expect(item.totalPL).toBe(1000);
    expect(item.totalPLPercent).toBeCloseTo(10, 5);
  });

  it("drops holdings with no quote rather than rendering them at zero", async () => {
    stubFetch({
      holdings: { body: [holding(), holding({ ticker: "MSFT" })] },
      quotes: { body: { quotes: { AAPL: quote() }, failed: ["MSFT"] } },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.items.map((i) => i.ticker)).toEqual(["AAPL"]);
  });

  it("surfaces the failed tickers for the retry strip", async () => {
    stubFetch({
      holdings: { body: [holding()] },
      quotes: { body: { quotes: { AAPL: quote() }, failed: ["ZZZZ"] } },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.failed).toEqual(["ZZZZ"]);
  });

  it("tolerates a quotes payload with no failed array", async () => {
    stubFetch({
      holdings: { body: [holding()] },
      quotes: { body: { quotes: { AAPL: quote() } } },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.failed).toEqual([]);
  });

  // In ALL mode the "change" a tile colours by is lifetime P&L, not the day
  // move, so the treemap and the range pill agree.
  it("rewrites change to lifetime P&L in ALL mode", async () => {
    stubFetch({
      holdings: { body: [holding({ avgCost: 100, shares: 100 })] },
      quotes: { body: { quotes: { AAPL: quote({ price: 110, change: 1 }) }, failed: [] } },
    });
    const { result } = render("ALL");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const item = result.current.items[0];
    expect(item.quote.change).toBe(10); // price - avgCost, not the day move
    expect(item.quote.changePercent).toBeCloseTo(10, 5);
  });

  it("leaves the day move alone outside ALL mode", async () => {
    stubFetch({
      holdings: { body: [holding()] },
      quotes: { body: { quotes: { AAPL: quote({ change: 1, changePercent: 0.92 }) }, failed: [] } },
    });
    const { result } = render("1D");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.items[0].quote.change).toBe(1);
    expect(result.current.items[0].quote.changePercent).toBe(0.92);
  });
});

// --- requests ---------------------------------------------------------------

describe("usePortfolioData requests", () => {
  it("passes the bearer token on every call", async () => {
    const fetchMock = stubFetch({
      holdings: { body: [holding()] },
      quotes: { body: { quotes: { AAPL: quote() }, failed: [] } },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer token-123");
    }
  });

  it("omits the range parameter in ALL mode and includes it otherwise", async () => {
    const allFetch = stubFetch({
      holdings: { body: [holding()] },
      quotes: { body: { quotes: { AAPL: quote() }, failed: [] } },
    });
    const all = render("ALL");
    await waitFor(() => expect(all.result.current.status).toBe("ready"));
    const allUrl = allFetch.mock.calls.map((c) => c[0]).find((u) => u.startsWith("/api/quotes"));
    expect(allUrl).toBe("/api/quotes?tickers=AAPL");

    const weekFetch = stubFetch({
      holdings: { body: [holding()] },
      quotes: { body: { quotes: { AAPL: quote() }, failed: [] } },
    });
    const week = render("1W");
    await waitFor(() => expect(week.result.current.status).toBe("ready"));
    const weekUrl = weekFetch.mock.calls.map((c) => c[0]).find((u) => u.startsWith("/api/quotes"));
    expect(weekUrl).toBe("/api/quotes?tickers=AAPL&range=1W");
  });

  it("writes a snapshot of total value and per-ticker market value", async () => {
    const fetchMock = stubFetch({
      holdings: { body: [holding({ shares: 100, avgCost: 100 })] },
      quotes: { body: { quotes: { AAPL: quote({ price: 110 }) }, failed: [] } },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const snap = fetchMock.mock.calls.find((c) => c[0] === "/api/snapshot");
    expect(snap).toBeDefined();
    const init = snap![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      totalValue: 11000,
      holdings: { AAPL: 11000 },
    });
  });

  it("does not write a snapshot when the portfolio is empty", async () => {
    const fetchMock = stubFetch({ holdings: { body: [] } });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("empty"));
    expect(fetchMock.mock.calls.some((c) => c[0] === "/api/snapshot")).toBe(false);
  });
});

// --- demo mode --------------------------------------------------------------

describe("usePortfolioData in demo mode", () => {
  // Demo mode is fully offline: any network call here would 401 without a token
  // and, worse, the snapshot write would attempt to persist fixture data.
  it("renders the fixture and makes no network call at all", async () => {
    const fetchMock = stubFetch({});
    isDemo = true;
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.items).toEqual([demoItem]);
    expect(result.current.failed).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockGetIdToken).not.toHaveBeenCalled();
  });

  it("builds the fixture for the selected range", async () => {
    stubFetch({});
    isDemo = true;
    const { result } = render("1Y");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(mockBuildDemoItems).toHaveBeenCalledWith("1Y");
  });
});

// --- polling ----------------------------------------------------------------

describe("usePortfolioData polling", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("refreshes on the interval only while the market is open", async () => {
    // Fake timers must be installed BEFORE render: the interval is scheduled
    // in the mount effect, and a timer created on the real clock cannot be
    // driven by advanceTimersByTime afterwards.
    jest.useFakeTimers();
    const fetchMock = stubFetch({
      holdings: { body: [holding()] },
      quotes: { body: { quotes: { AAPL: quote() }, failed: [] } },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const afterMount = fetchMock.mock.calls.length;

    mockIsMarketOpen.mockReturnValue(false);
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(fetchMock.mock.calls.length).toBe(afterMount);

    mockIsMarketOpen.mockReturnValue(true);
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(afterMount);
  });

  it("clears its interval on unmount so a closed tab stops polling", async () => {
    stubFetch({ holdings: { body: [] } });
    const clearSpy = jest.spyOn(global, "clearInterval");
    const { result, unmount } = render();
    await waitFor(() => expect(result.current.status).toBe("empty"));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

// --- manual refresh ---------------------------------------------------------

describe("usePortfolioData refresh", () => {
  it("re-fetches on demand, which is what the failed-ticker Retry calls", async () => {
    const fetchMock = stubFetch({
      holdings: { body: [holding()] },
      quotes: { body: { quotes: { AAPL: quote() }, failed: ["ZZZZ"] } },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const before = fetchMock.mock.calls.length;

    await act(async () => {
      await result.current.refresh();
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
  });
});
