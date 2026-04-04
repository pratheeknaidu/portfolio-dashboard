import { adminAuth } from "./firebase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function verifyRequest(req: NextRequest): Promise<{ uid: string } | NextResponse> {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const token = header.split("Bearer ")[1];
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch (err) {
    console.error("verifyIdToken failed:", err);
    console.error("FIREBASE_AUTH_EMULATOR_HOST:", process.env.FIREBASE_AUTH_EMULATOR_HOST);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
