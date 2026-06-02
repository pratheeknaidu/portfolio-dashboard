import { NextRequest, NextResponse } from "next/server";
import { getVix } from "@/lib/yahoo-finance";
import { vixSentiment } from "@/lib/vix-sentiment";
import { verifyRequest } from "@/lib/verify-token";

export async function GET(req: NextRequest) {
  const authResult = await verifyRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const vix = await getVix();
    if (!vix) return NextResponse.json({ value: null });

    return NextResponse.json({
      value: vix.value,
      previousClose: vix.previousClose,
      ...vixSentiment(vix.value),
    });
  } catch (err) {
    // VIX is ancillary — degrade to "hidden" rather than erroring the client.
    return NextResponse.json({ value: null, message: String(err) });
  }
}
