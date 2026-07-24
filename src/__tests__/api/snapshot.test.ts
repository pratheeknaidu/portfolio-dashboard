/**
 * @jest-environment node
 */
import { POST } from "@/app/api/snapshot/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/verify-token");
jest.mock("@/lib/firebase-admin", () => {
  const mockSet = jest.fn().mockResolvedValue(undefined);
  const mockSnapshotDoc = jest.fn().mockReturnValue({ set: mockSet });
  return {
    adminDb: {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({
            doc: mockSnapshotDoc,
          }),
        }),
      }),
    },
    __mockSet: mockSet,
    __mockSnapshotDoc: mockSnapshotDoc,
  };
});

import { verifyRequest } from "@/lib/verify-token";

const { __mockSnapshotDoc } = jest.requireMock("@/lib/firebase-admin");

function makeRequest() {
  return new NextRequest("http://localhost/api/snapshot", {
    method: "POST",
    headers: { Authorization: "Bearer valid-token" },
    body: JSON.stringify({ holdings: { AAPL: 9250 }, totalValue: 9250 }),
  });
}

describe("POST /api/snapshot", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("creates a snapshot with today's date as doc ID", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
  });

  it("keys the snapshot by the Eastern-time date when UTC has rolled over", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });
    // 2026-01-02T01:00:00Z is 8:00 PM EST on 2026-01-01
    jest.useFakeTimers().setSystemTime(new Date("2026-01-02T01:00:00Z"));

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body.date).toBe("2026-01-01");
    expect(__mockSnapshotDoc).toHaveBeenCalledWith("2026-01-01");
  });
});
