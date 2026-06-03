/**
 * @jest-environment node
 */
import { GET, POST } from "@/app/api/portfolio/route";
import { NextRequest, NextResponse } from "next/server";

jest.mock("@/lib/verify-token");
jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn(),
  },
}));
jest.mock("@/lib/import/enrich-holdings", () => ({
  enrichHoldings: jest.fn(),
}));

import { verifyRequest } from "@/lib/verify-token";
import { adminDb } from "@/lib/firebase-admin";
import { enrichHoldings } from "@/lib/import/enrich-holdings";

describe("GET /api/portfolio", () => {
  it("returns 401 when no auth header", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const req = new NextRequest("http://localhost/api/portfolio");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns holdings for authenticated user", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });

    const mockDocs = [
      { id: "AAPL", data: () => ({ ticker: "AAPL", shares: 50, avgCost: 142.8, companyName: "Apple", sector: "Technology" }) },
    ];
    (adminDb.collection as jest.Mock).mockReturnValue({
      doc: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ docs: mockDocs }),
        }),
      }),
    });

    const req = new NextRequest("http://localhost/api/portfolio", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body[0].ticker).toBe("AAPL");
  });
});

describe("POST /api/portfolio", () => {
  /** Wire adminDb so the holding doc ref reports `exists` and records set(). */
  function mockHoldingRef({ exists }: { exists: boolean }) {
    const ref = {
      get: jest.fn().mockResolvedValue({ exists }),
      set: jest.fn().mockResolvedValue(undefined),
    };
    (adminDb.collection as jest.Mock).mockReturnValue({
      doc: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue({
          doc: jest.fn().mockReturnValue(ref),
        }),
      }),
    });
    return ref;
  }

  function postReq(body: unknown) {
    return new NextRequest("http://localhost/api/portfolio", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });
    (enrichHoldings as jest.Mock).mockReset();
  });

  it("returns 401 when no auth header", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await POST(postReq({ ticker: "AAPL", shares: 10, avgCost: 150 }));
    expect(res.status).toBe(401);
  });

  it("creates a new holding, enriching company name + sector and stamping addedAt", async () => {
    const ref = mockHoldingRef({ exists: false });
    (enrichHoldings as jest.Mock).mockResolvedValue({
      AAPL: { name: "Apple Inc.", sector: "Technology" },
    });

    const res = await POST(postReq({ ticker: "aapl", shares: 10, avgCost: 150 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ticker).toBe("AAPL");
    expect(body.companyName).toBe("Apple Inc.");
    expect(body.sector).toBe("Technology");
    expect(body.shares).toBe(10);
    expect(body.avgCost).toBe(150);

    expect(ref.set).toHaveBeenCalledTimes(1);
    const [payload] = ref.set.mock.calls[0];
    expect(payload.ticker).toBe("AAPL");
    expect(typeof payload.addedAt).toBe("string");
  });

  it("returns 409 when the ticker is already held", async () => {
    mockHoldingRef({ exists: true });
    const res = await POST(postReq({ ticker: "AAPL", shares: 10, avgCost: 150 }));
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already/i);
    expect(enrichHoldings).not.toHaveBeenCalled();
  });

  it("returns 400 when the symbol can't be found", async () => {
    mockHoldingRef({ exists: false });
    (enrichHoldings as jest.Mock).mockResolvedValue({}); // no summary for ticker

    const res = await POST(postReq({ ticker: "XYZ", shares: 10, avgCost: 150 }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/couldn't find/i);
  });

  it("returns 400 for non-positive shares or avgCost", async () => {
    const zeroShares = await POST(postReq({ ticker: "AAPL", shares: 0, avgCost: 150 }));
    expect(zeroShares.status).toBe(400);

    const negCost = await POST(postReq({ ticker: "AAPL", shares: 10, avgCost: -5 }));
    expect(negCost.status).toBe(400);

    expect(enrichHoldings).not.toHaveBeenCalled();
  });

  it("returns 400 when ticker is missing", async () => {
    const res = await POST(postReq({ shares: 10, avgCost: 150 }));
    expect(res.status).toBe(400);
  });
});
