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

import { DELETE } from "@/app/api/portfolio/[ticker]/route";
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
