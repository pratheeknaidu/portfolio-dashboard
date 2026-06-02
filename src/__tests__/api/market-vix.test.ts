/**
 * @jest-environment node
 */
import { GET } from "@/app/api/market/vix/route";
import { NextRequest, NextResponse } from "next/server";

jest.mock("@/lib/verify-token");
jest.mock("@/lib/firebase-admin", () => ({}));
jest.mock("@/lib/yahoo-finance", () => ({ getVix: jest.fn() }));

import { verifyRequest } from "@/lib/verify-token";
import { getVix } from "@/lib/yahoo-finance";

describe("GET /api/market/vix", () => {
  it("returns 401 when unauthorized", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const req = new NextRequest("http://localhost/api/market/vix");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns value plus mapped sentiment", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "u1" });
    (getVix as jest.Mock).mockResolvedValue({ value: 28.5, previousClose: 25 });

    const req = new NextRequest("http://localhost/api/market/vix", {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.value).toBe(28.5);
    expect(body.sentiment).toBe("Fearful");
    expect(body.action).toBe("Strong buy");
    expect(body.tone).toBe("opportunity");
  });

  it("returns { value: null } when VIX is unavailable", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "u1" });
    (getVix as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/market/vix", {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(body.value).toBeNull();
  });
});
