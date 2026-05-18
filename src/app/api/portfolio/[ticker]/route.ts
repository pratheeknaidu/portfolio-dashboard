import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/verify-token";
import { adminDb } from "@/lib/firebase-admin";

function holdingRef(uid: string, ticker: string) {
  return adminDb.collection("users").doc(uid).collection("holdings").doc(ticker);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { ticker: string } },
) {
  const authResult = await verifyRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const ticker = params.ticker.toUpperCase();
  await holdingRef(authResult.uid, ticker).delete();
  return NextResponse.json({ success: true, ticker });
}

function isPositiveFinite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { ticker: string } },
) {
  const authResult = await verifyRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json().catch(() => ({}));
  const payload: { shares?: number; avgCost?: number } = {};

  if ("shares" in body) {
    if (!isPositiveFinite(body.shares)) {
      return NextResponse.json({ error: "shares must be a positive number" }, { status: 400 });
    }
    payload.shares = body.shares;
  }
  if ("avgCost" in body) {
    if (!isPositiveFinite(body.avgCost)) {
      return NextResponse.json({ error: "avgCost must be a positive number" }, { status: 400 });
    }
    payload.avgCost = body.avgCost;
  }
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "Must provide at least one of: shares, avgCost" }, { status: 400 });
  }

  const ticker = params.ticker.toUpperCase();
  const ref = holdingRef(authResult.uid, ticker);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Holding not found" }, { status: 404 });
  }

  await ref.set(payload, { merge: true });
  return NextResponse.json({ ticker, ...payload });
}
