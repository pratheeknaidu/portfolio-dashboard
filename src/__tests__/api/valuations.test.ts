/**
 * @jest-environment node
 */
jest.mock("@/lib/verify-token");
jest.mock("@/lib/firebase-admin", () => ({}));
jest.mock("@/lib/import", () => ({
  MAX_HOLDINGS: 200,
}));
jest.mock("@/lib/yahoo-finance-valuations", () => ({
  getValuations: jest.fn(),
}));

import { GET } from "@/app/api/valuations/route";
import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/verify-token";
import { getValuations } from "@/lib/yahoo-finance-valuations";

describe("GET /api/valuations", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when verifyRequest rejects", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const req = new NextRequest("http://localhost/api/valuations?tickers=AAPL");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when tickers param is missing", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });
    const req = new NextRequest("http://localhost/api/valuations", {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when tickers exceeds MAX_HOLDINGS", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });
    const many = Array.from({ length: 201 }, (_, i) => `T${i}`).join(",");
    const req = new NextRequest(`http://localhost/api/valuations?tickers=${many}`, {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/too many/i);
  });

  it("returns valuations on the happy path", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });
    (getValuations as jest.Mock).mockResolvedValue({
      AAPL: { valuationSource: "both", recommendationKey: "buy" },
    });
    const req = new NextRequest("http://localhost/api/valuations?tickers=aapl", {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.AAPL.recommendationKey).toBe("buy");
    // Verify ticker was uppercased before calling the helper
    expect(getValuations).toHaveBeenCalledWith(["AAPL"]);
  });

  it("returns 502 when the upstream helper throws", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });
    (getValuations as jest.Mock).mockRejectedValue(new Error("Yahoo down"));
    const req = new NextRequest("http://localhost/api/valuations?tickers=AAPL", {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    expect(res.status).toBe(502);
  });
});
