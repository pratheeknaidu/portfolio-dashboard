/**
 * @jest-environment node
 */
import { GET } from "@/app/api/demo/quotes/route";
import { demoQuotes } from "@/lib/demo-market-data";
import { NextRequest } from "next/server";

// unstable_cache passes through in tests so we exercise the handler directly.
jest.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
jest.mock("@/lib/demo-market-data", () => ({ demoQuotes: jest.fn() }));

const mockDemoQuotes = demoQuotes as jest.Mock;
const req = (path: string) => new NextRequest(`http://localhost${path}`);

beforeEach(() => {
  jest.clearAllMocks();
  mockDemoQuotes.mockResolvedValue({ quotes: { AAPL: { price: 1 } }, failed: [] });
});

describe("GET /api/demo/quotes", () => {
  it("returns the demo quotes as JSON with an edge cache header", async () => {
    const res = await GET(req("/api/demo/quotes"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ quotes: { AAPL: { price: 1 } }, failed: [] });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
  });

  it("passes a valid range through to the data function", async () => {
    await GET(req("/api/demo/quotes?range=1M"));
    expect(mockDemoQuotes).toHaveBeenCalledWith("1M");
  });

  it("defaults an invalid range to 1D", async () => {
    await GET(req("/api/demo/quotes?range=bogus"));
    expect(mockDemoQuotes).toHaveBeenCalledWith("1D");
  });

  it("ignores a tickers param entirely (allowlist is enforced in the data fn)", async () => {
    await GET(req("/api/demo/quotes?tickers=EVIL"));
    expect(mockDemoQuotes).toHaveBeenCalledWith("1D");
  });
});
