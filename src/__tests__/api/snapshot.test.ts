/**
 * @jest-environment node
 */
import { POST } from "@/app/api/snapshot/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/verify-token");
jest.mock("@/lib/firebase-admin", () => {
  const mockSet = jest.fn().mockResolvedValue(undefined);
  return {
    adminDb: {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({ set: mockSet }),
          }),
        }),
      }),
    },
    __mockSet: mockSet,
  };
});

import { verifyRequest } from "@/lib/verify-token";

describe("POST /api/snapshot", () => {
  it("creates a snapshot with today's date as doc ID", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });

    const req = new NextRequest("http://localhost/api/snapshot", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" },
      body: JSON.stringify({ holdings: { AAPL: 9250 }, totalValue: 9250 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
