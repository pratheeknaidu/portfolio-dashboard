import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/verify-token";
import { adminDb } from "@/lib/firebase-admin";
import { enrichHoldings } from "@/lib/import/enrich-holdings";

export async function GET(req: NextRequest) {
  const authResult = await verifyRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const { uid } = authResult;
  const snapshot = await adminDb.collection("users").doc(uid).collection("holdings").get();
  const holdings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return NextResponse.json(holdings);
}

function isPositiveFinite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Add a single holding by hand. Unlike the import pipeline (which bulk-replaces
 * the whole portfolio), this writes exactly one new position and refuses to
 * touch an existing one — edits go through PATCH /api/portfolio/[ticker].
 */
export async function POST(req: NextRequest) {
  const authResult = await verifyRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json().catch(() => ({}));
  const ticker = typeof body.ticker === "string" ? body.ticker.trim().toUpperCase() : "";

  if (!ticker) {
    return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
  }
  if (!isPositiveFinite(body.shares)) {
    return NextResponse.json({ error: "shares must be a positive number" }, { status: 400 });
  }
  if (!isPositiveFinite(body.avgCost)) {
    return NextResponse.json({ error: "avgCost must be a positive number" }, { status: 400 });
  }

  const ref = adminDb
    .collection("users").doc(authResult.uid)
    .collection("holdings").doc(ticker);

  const snap = await ref.get();
  if (snap.exists) {
    return NextResponse.json(
      { error: `${ticker} is already in your portfolio. Edit it instead.` },
      { status: 409 },
    );
  }

  // Validate the symbol and pull company name + sector in one shot. An absent
  // summary means Yahoo had nothing for the symbol (or its -USD crypto pair),
  // so the ticker is treated as not real.
  const summaries = await enrichHoldings([ticker]);
  const summary = summaries[ticker];
  if (!summary) {
    return NextResponse.json(
      { error: `Couldn't find a stock for ‘${ticker}’.` },
      { status: 400 },
    );
  }

  const holding = {
    ticker,
    companyName: summary.name || "",
    sector: summary.sector || "",
    shares: body.shares,
    avgCost: body.avgCost,
    addedAt: new Date().toISOString(),
  };

  await ref.set(holding, { merge: true });
  return NextResponse.json(holding);
}
