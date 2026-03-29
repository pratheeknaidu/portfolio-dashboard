/**
 * @jest-environment node
 */
import { GET } from "@/app/api/portfolio/route";
import { NextRequest, NextResponse } from "next/server";

jest.mock("@/lib/verify-token");
jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn(),
  },
}));

import { verifyRequest } from "@/lib/verify-token";
import { adminDb } from "@/lib/firebase-admin";

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
