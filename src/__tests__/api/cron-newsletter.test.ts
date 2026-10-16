/**
 * @jest-environment node
 */
import { GET } from "@/app/api/cron/newsletter/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/newsletter", () => ({
  getEtfMoves: jest.fn().mockResolvedValue({}),
  buildNewsletter: jest.fn(),
}));
jest.mock("@/lib/newsletter/send-email", () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/firebase-admin", () => ({
  adminAuth: { getUserByEmail: jest.fn() },
}));

import { buildNewsletter } from "@/lib/newsletter";
import { sendEmail } from "@/lib/newsletter/send-email";
import { adminAuth } from "@/lib/firebase-admin";

function req(auth?: string, query = "") {
  return new NextRequest(`http://localhost/api/cron/newsletter${query}`, {
    headers: auth ? { Authorization: auth } : {},
  });
}

const newsletter = { subject: "S", html: "<p>h</p>", text: "t", report: {}, narrative: null };

describe("GET /api/cron/newsletter", () => {
  const env = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...env, CRON_SECRET: "s3cret", NEWSLETTER_EMAILS: "me@example.com, other@example.com" };
    (adminAuth.getUserByEmail as jest.Mock).mockImplementation(async (email: string) => ({ uid: `uid-${email}` }));
  });
  afterAll(() => {
    process.env = env;
  });

  it("refuses to run without CRON_SECRET configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req("Bearer undefined"));
    expect(res.status).toBe(500);
  });

  it("rejects a wrong secret", async () => {
    const res = await GET(req("Bearer nope"));
    expect(res.status).toBe(401);
    expect(buildNewsletter).not.toHaveBeenCalled();
  });

  it("sends to each recipient and skips empty portfolios", async () => {
    (buildNewsletter as jest.Mock).mockResolvedValueOnce(newsletter).mockResolvedValueOnce(null);
    const res = await GET(req("Bearer s3cret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sent).toEqual(["me@example.com"]);
    expect(body.skipped).toEqual(["other@example.com"]);
    expect(buildNewsletter).toHaveBeenCalledWith("uid-me@example.com", expect.any(String), {});
    expect(sendEmail).toHaveBeenCalledWith({ to: "me@example.com", subject: "S", html: "<p>h</p>", text: "t" });
  });

  it("returns previews without sending on dryRun", async () => {
    (buildNewsletter as jest.Mock).mockResolvedValue(newsletter);
    const res = await GET(req("Bearer s3cret", "?dryRun=1"));
    const body = await res.json();

    expect(sendEmail).not.toHaveBeenCalled();
    expect(body.previews).toHaveLength(2);
  });

  it("keeps going when one recipient fails", async () => {
    (adminAuth.getUserByEmail as jest.Mock).mockRejectedValueOnce(new Error("no user"));
    (buildNewsletter as jest.Mock).mockResolvedValue(newsletter);
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req("Bearer s3cret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.failed).toEqual(["me@example.com"]);
    expect(body.sent).toEqual(["other@example.com"]);
  });
});
