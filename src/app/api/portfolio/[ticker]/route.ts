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
