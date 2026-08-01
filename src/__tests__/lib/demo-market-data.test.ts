import { demoQuotes, demoValuations, demoHistory } from "@/lib/demo-market-data";
import { DEMO_TICKERS } from "@/lib/demo-data";
import { getQuotes, getChartCloses } from "@/lib/yahoo-finance";
import { getValuations } from "@/lib/yahoo-finance-valuations";

jest.mock("@/lib/yahoo-finance", () => ({ getQuotes: jest.fn(), getChartCloses: jest.fn() }));
jest.mock("@/lib/yahoo-finance-valuations", () => ({ getValuations: jest.fn() }));

const mockGetQuotes = getQuotes as jest.Mock;
const mockGetValuations = getValuations as jest.Mock;
const mockGetChartCloses = getChartCloses as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.SANDBOX_MODE;
});

describe("demoQuotes", () => {
  it("fetches only the demo tickers", async () => {
    mockGetQuotes.mockResolvedValue({ quotes: { AAPL: {} }, failed: [] });
    await demoQuotes("1D");
    expect(mockGetQuotes).toHaveBeenCalledWith(DEMO_TICKERS, "1D");
  });

  it("falls back to mock quotes when the upstream throws", async () => {
    mockGetQuotes.mockRejectedValue(new Error("yahoo down"));
    const res = await demoQuotes("1D");
    expect(Object.keys(res.quotes).length).toBe(DEMO_TICKERS.length);
    expect(res.failed).toEqual([]);
  });
});

describe("demoValuations", () => {
  it("falls back to the fixture when the upstream throws", async () => {
    mockGetValuations.mockRejectedValue(new Error("yahoo down"));
    const res = await demoValuations();
    expect(Object.keys(res).length).toBe(DEMO_TICKERS.length);
  });
});

describe("demoHistory", () => {
  it("returns the synthetic fixture under SANDBOX_MODE without fetching closes", async () => {
    process.env.SANDBOX_MODE = "true";
    const res = await demoHistory();
    expect(mockGetChartCloses).not.toHaveBeenCalled();
    expect(res.length).toBeGreaterThan(0);
  });

  it("computes the series from chart closes when upstream succeeds", async () => {
    // Must be >= MIN_HISTORY_POINTS (5) dates, or demoHistory falls back to the
    // fixture. Every ticker returns the same closes, so all dates survive.
    const dates = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-06", "2026-07-07"];
    mockGetChartCloses.mockResolvedValue(dates.map((d, i) => ({ date: d, close: 10 + i })));
    const res = await demoHistory();
    expect(res.map((s) => s.date)).toEqual(dates);
    expect(res[0].totalValue).toBeGreaterThan(0);
  });

  it("falls back to the fixture when a closes fetch throws", async () => {
    mockGetChartCloses.mockRejectedValue(new Error("yahoo down"));
    const res = await demoHistory();
    expect(res.length).toBeGreaterThan(0);
  });
});
