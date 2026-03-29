/**
 * @jest-environment node
 */
import { POST } from "@/app/api/import/route";
import { NextRequest, NextResponse } from "next/server";

jest.mock("@/lib/verify-token");
jest.mock("@/lib/firebase-admin", () => {
  const mockDocRef = {
    get: jest.fn().mockResolvedValue({ exists: false }),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const mockCollectionRef = {
    doc: jest.fn().mockReturnValue(mockDocRef),
  };
  const mockUserDocRef = {
    collection: jest.fn().mockReturnValue(mockCollectionRef),
  };
  return {
    adminDb: {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue(mockUserDocRef),
      }),
    },
  };
});
jest.mock("yahoo-finance2", () => ({
  __esModule: true,
  default: {
    quoteSummary: jest.fn().mockResolvedValue({
      price: { shortName: "Apple Inc." },
      summaryProfile: { sector: "Technology" },
    }),
  },
}));

import { verifyRequest } from "@/lib/verify-token";

describe("POST /api/import", () => {
  beforeEach(() => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });
  });

  it("parses Robinhood CSV and returns imported tickers", async () => {
    const csv = "Instrument,Quantity,Average Cost\nAAPL,50,142.80\nMSFT,30,280.50";
    const formData = new FormData();
    formData.append("file", new Blob([csv], { type: "text/csv" }), "holdings.csv");

    const req = new NextRequest("http://localhost/api/import", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" },
      body: formData,
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.imported).toContain("AAPL");
    expect(body.imported).toContain("MSFT");
  });

  it("returns 401 without auth", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const req = new NextRequest("http://localhost/api/import", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
