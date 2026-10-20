import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { getEasternDateKey } from "@/lib/market-hours";
import { buildNewsletter, getEtfMoves } from "@/lib/newsletter";
import { sendEmail } from "@/lib/newsletter/send-email";

export const dynamic = "force-dynamic";
// Quote fetches plus a web-searching narrative per recipient.
export const maxDuration = 300;

function recipients(): string[] {
  return (process.env.NEWSLETTER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/**
 * Morning newsletter, fired by Vercel Cron (see vercel.json). Not a user
 * endpoint, so it authenticates with CRON_SECRET instead of verifyRequest —
 * Vercel sends it as `Authorization: Bearer <CRON_SECRET>`.
 *
 * `?dryRun=1` builds and returns the emails without sending them.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("newsletter: CRON_SECRET is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (req.headers.get("Authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const emails = recipients();
  if (emails.length === 0) {
    return NextResponse.json({ sent: [], skipped: [], failed: [], note: "NEWSLETTER_EMAILS is empty" });
  }

  const date = getEasternDateKey();
  const etfMoves = await getEtfMoves();

  const sent: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];
  const previews: { to: string; subject: string; html: string; narrativeError?: string }[] = [];

  for (const email of emails) {
    try {
      const user = await adminAuth.getUserByEmail(email);
      const newsletter = await buildNewsletter(user.uid, date, etfMoves);
      if (!newsletter) {
        skipped.push(email);
        continue;
      }
      if (dryRun) {
        previews.push({
          to: email,
          subject: newsletter.subject,
          html: newsletter.html,
          narrativeError: newsletter.narrativeError,
        });
      } else {
        await sendEmail({ to: email, subject: newsletter.subject, html: newsletter.html, text: newsletter.text });
      }
      sent.push(email);
    } catch (err) {
      console.error(`newsletter failed for ${email}:`, err);
      failed.push(email);
    }
  }

  const status = failed.length > 0 && sent.length === 0 ? 500 : 200;
  return NextResponse.json({ date, dryRun, sent, skipped, failed, ...(dryRun ? { previews } : {}) }, { status });
}
