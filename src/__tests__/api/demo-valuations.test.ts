/**
 * @jest-environment node
 */
import { GET } from "@/app/api/demo/valuations/route";
import { demoValuations } from "@/lib/demo-market-data";

jest.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
jest.mock("@/lib/demo-market-data", () => ({ demoValuations: jest.fn() }));

const mockDemoValuations = demoValuations as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockDemoValuations.mockResolvedValue({ AAPL: { recommendationKey: "buy" } });
});

describe("GET /api/demo/valuations", () => {
  it("returns the demo valuations as JSON with an edge cache header", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ AAPL: { recommendationKey: "buy" } });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=21600");
  });
});
