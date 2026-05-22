import { NextRequest, NextResponse } from "next/server";
import { getValuations } from "@/lib/yahoo-finance-valuations";
import { verifyRequest } from "@/lib/verify-token";
import { MAX_HOLDINGS } from "@/lib/import";

export async function GET(req: NextRequest) {
  const authResult = await verifyRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const raw = req.nextUrl.searchParams.get("tickers");
  if (!raw) {
    return NextResponse.json({ error: "tickers param required" }, { status: 400 });
  }

  const tickers = raw.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (tickers.length === 0) {
    return NextResponse.json({ error: "tickers param required" }, { status: 400 });
  }
  if (tickers.length > MAX_HOLDINGS) {
    return NextResponse.json({ error: `too many tickers (max ${MAX_HOLDINGS})` }, { status: 400 });
  }

  try {
    const valuations = await getValuations(tickers);
    return NextResponse.json(valuations);
  } catch (err) {
    console.error("getValuations failed:", err);
    return NextResponse.json({ error: "Failed to fetch valuations" }, { status: 502 });
  }
}
