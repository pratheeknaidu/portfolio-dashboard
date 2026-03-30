import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/verify-token";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const authResult = await verifyRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const { uid } = authResult;
  const snap = await adminDb
    .collection("users")
    .doc(uid)
    .collection("snapshots")
    .orderBy("date", "asc")
    .get();

  const snapshots = snap.docs.map((doc) => doc.data());
  return NextResponse.json(snapshots);
}

export async function POST(req: NextRequest) {
  const authResult = await verifyRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const { uid } = authResult;
  const { holdings, totalValue } = await req.json();

  const today = new Date().toISOString().split("T")[0];

  await adminDb
    .collection("users")
    .doc(uid)
    .collection("snapshots")
    .doc(today)
    .set({ date: today, totalValue, holdings });

  return NextResponse.json({ success: true, date: today });
}
