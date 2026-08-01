/**
 * @jest-environment node
 */
import { GET } from "@/app/api/demo/history/route";
import { demoHistory } from "@/lib/demo-market-data";

jest.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
jest.mock("@/lib/demo-market-data", () => ({ demoHistory: jest.fn() }));

const mockDemoHistory = demoHistory as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockDemoHistory.mockResolvedValue([{ date: "2026-07-01", totalValue: 1000, holdings: {} }]);
});

describe("GET /api/demo/history", () => {
  it("returns the snapshot series as JSON with an edge cache header", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ date: "2026-07-01", totalValue: 1000, holdings: {} }]);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=86400");
  });
});
