/**
 * @jest-environment node
 */
import { GET } from "@/app/api/quotes/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/yahoo-finance", () => ({
  getQuotes: jest.fn(),
}));

import { getQuotes } from "@/lib/yahoo-finance";

describe("GET /api/quotes", () => {
  it("returns 400 when tickers param is missing", async () => {
    const req = new NextRequest("http://localhost/api/quotes");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns quotes for valid tickers", async () => {
    (getQuotes as jest.Mock).mockResolvedValue({
      AAPL: { price: 185.5, change: 2.3, changePercent: 1.25, previousClose: 183.2 },
    });

    const req = new NextRequest("http://localhost/api/quotes?tickers=AAPL&range=1D");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.AAPL.price).toBe(185.5);
  });

  it("returns error shape when Yahoo Finance fails", async () => {
    (getQuotes as jest.Mock).mockRejectedValue(new Error("API down"));

    const req = new NextRequest("http://localhost/api/quotes?tickers=AAPL");
    const res = await GET(req);
    const body = await res.json();

    expect(body.error).toBe(true);
  });
});
