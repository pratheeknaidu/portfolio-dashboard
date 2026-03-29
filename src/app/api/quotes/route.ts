import { NextRequest, NextResponse } from "next/server";
import { getQuotes } from "@/lib/yahoo-finance";
import type { TimeRange } from "@/types";

export async function GET(req: NextRequest) {
  const tickers = req.nextUrl.searchParams.get("tickers");
  if (!tickers) {
    return NextResponse.json({ error: "tickers param required" }, { status: 400 });
  }

  const range = (req.nextUrl.searchParams.get("range") || "1D") as TimeRange;
  const tickerList = tickers.split(",").map((t) => t.trim().toUpperCase());

  try {
    const quotes = await getQuotes(tickerList, range);
    return NextResponse.json(quotes);
  } catch (err) {
    return NextResponse.json({ error: true, stale: true, message: String(err) }, { status: 502 });
  }
}
