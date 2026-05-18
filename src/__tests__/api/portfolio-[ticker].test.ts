/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";

jest.mock("@/lib/verify-token");
jest.mock("@/lib/firebase-admin", () => {
  const docRef = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  return {
    adminDb: {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => docRef),
          })),
        })),
      })),
    },
  };
});

import { DELETE, PATCH } from "@/app/api/portfolio/[ticker]/route";
import { verifyRequest } from "@/lib/verify-token";
import { adminDb } from "@/lib/firebase-admin";

// Reach the shared docRef by walking the chain — the mock returns the same
// docRef regardless of args.
const docRef = adminDb
  .collection("users").doc("x").collection("holdings").doc("x") as unknown as {
    get: jest.Mock; set: jest.Mock; delete: jest.Mock;
  };

function buildReq(method: "DELETE" | "PATCH", body?: object) {
  return new NextRequest("http://localhost/api/portfolio/aapl", {
    method,
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("DELETE /api/portfolio/[ticker]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });
  });

  it("returns 401 without auth", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await DELETE(buildReq("DELETE"), { params: { ticker: "aapl" } });
    expect(res.status).toBe(401);
  });

  it("deletes the holding and returns 200", async () => {
    const res = await DELETE(buildReq("DELETE"), { params: { ticker: "aapl" } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, ticker: "AAPL" });
    expect(docRef.delete).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — succeeds even if the holding does not exist", async () => {
    docRef.delete.mockResolvedValueOnce(undefined);
    const res = await DELETE(buildReq("DELETE"), { params: { ticker: "ZZZZ" } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, ticker: "ZZZZ" });
  });
});

describe("PATCH /api/portfolio/[ticker]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    docRef.get.mockReset();
    docRef.set.mockResolvedValue(undefined);
    docRef.delete.mockResolvedValue(undefined);
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });
  });

  it("returns 401 without auth", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await PATCH(buildReq("PATCH", { shares: 10 }), { params: { ticker: "aapl" } });
    expect(res.status).toBe(401);
  });

  it("returns 400 when neither shares nor avgCost is provided", async () => {
    const res = await PATCH(buildReq("PATCH", {}), { params: { ticker: "aapl" } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one/i);
  });

  it("returns 400 when shares is not a positive finite number", async () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, "abc"]) {
      const res = await PATCH(
        buildReq("PATCH", { shares: bad }),
        { params: { ticker: "aapl" } },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeTruthy();
    }
  });

  it("returns 400 when avgCost is not a positive finite number", async () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, null]) {
      const res = await PATCH(
        buildReq("PATCH", { avgCost: bad }),
        { params: { ticker: "aapl" } },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeTruthy();
    }
  });

  it("returns 404 when the holding does not exist", async () => {
    docRef.get.mockResolvedValueOnce({ exists: false });
    const res = await PATCH(
      buildReq("PATCH", { shares: 10 }),
      { params: { ticker: "zzzz" } },
    );
    expect(res.status).toBe(404);
  });

  it("updates shares and returns the new value", async () => {
    docRef.get.mockResolvedValueOnce({ exists: true });
    const res = await PATCH(
      buildReq("PATCH", { shares: 75 }),
      { params: { ticker: "aapl" } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ticker: "AAPL", shares: 75 });
    expect(docRef.set).toHaveBeenCalledWith({ shares: 75 }, { merge: true });
  });

  it("updates avgCost and returns the new value", async () => {
    docRef.get.mockResolvedValueOnce({ exists: true });
    const res = await PATCH(
      buildReq("PATCH", { avgCost: 199.99 }),
      { params: { ticker: "aapl" } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ticker: "AAPL", avgCost: 199.99 });
    expect(docRef.set).toHaveBeenCalledWith({ avgCost: 199.99 }, { merge: true });
  });

  it("updates both fields in a single call", async () => {
    docRef.get.mockResolvedValueOnce({ exists: true });
    const res = await PATCH(
      buildReq("PATCH", { shares: 75, avgCost: 199.99 }),
      { params: { ticker: "aapl" } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ticker: "AAPL", shares: 75, avgCost: 199.99 });
    expect(docRef.set).toHaveBeenCalledWith(
      { shares: 75, avgCost: 199.99 },
      { merge: true },
    );
  });
});
