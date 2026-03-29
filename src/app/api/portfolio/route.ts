import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/verify-token";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const authResult = await verifyRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const { uid } = authResult;
  const snapshot = await adminDb.collection("users").doc(uid).collection("holdings").get();
  const holdings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return NextResponse.json(holdings);
}
