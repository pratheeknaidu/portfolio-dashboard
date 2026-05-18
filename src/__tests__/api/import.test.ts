/**
 * @jest-environment node
 */
import { POST } from "@/app/api/import/route";
import { NextRequest, NextResponse } from "next/server";

jest.mock("@/lib/verify-token");

const existingDocs: { id: string }[] = [];

jest.mock("@/lib/firebase-admin", () => {
  const holdingsCollection = {
    doc: jest.fn((id: string) => ({ id })),
    get: jest.fn(async () => ({ docs: existingDocs })),
  };
  const userDoc = {
    collection: jest.fn(() => holdingsCollection),
  };
  const batch = {
    set: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };
  return {
    adminDb: {
      collection: jest.fn(() => ({ doc: jest.fn(() => userDoc) })),
      batch: jest.fn(() => batch),
    },
  };
});
jest.mock("yahoo-finance2", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    quoteSummary: jest.fn().mockResolvedValue({
      price: { shortName: "Apple Inc." },
      summaryProfile: { sector: "Technology" },
    }),
  })),
}));

import { verifyRequest } from "@/lib/verify-token";

function csvRequest(csv: string): NextRequest {
  const formData = new FormData();
  formData.append("file", new Blob([csv], { type: "text/csv" }), "holdings.csv");
  return new NextRequest("http://localhost/api/import", {
    method: "POST",
    headers: { Authorization: "Bearer valid-token" },
    body: formData,
  });
}

describe("POST /api/import", () => {
  beforeEach(() => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });
    existingDocs.length = 0;
  });

  it("parses Robinhood CSV and returns imported tickers", async () => {
    const csv = "Instrument,Quantity,Average Cost\nAAPL,50,142.80\nMSFT,30,280.50";
    const res = await POST(csvRequest(csv));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.imported).toContain("AAPL");
    expect(body.imported).toContain("MSFT");
    expect(body.removed).toEqual([]);
  });

  it("removes existing tickers absent from the new import", async () => {
    existingDocs.push({ id: "AAPL" }, { id: "TSLA" }, { id: "GOOGL" });

    const csv = "Instrument,Quantity,Average Cost\nAAPL,50,142.80\nMSFT,30,280.50";
    const res = await POST(csvRequest(csv));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.imported).toEqual(expect.arrayContaining(["MSFT"]));
    expect(body.updated).toEqual(expect.arrayContaining(["AAPL"]));
    expect(body.removed).toEqual(expect.arrayContaining(["TSLA", "GOOGL"]));
    expect(body.removed).toHaveLength(2);
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
