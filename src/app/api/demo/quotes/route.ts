import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { demoQuotes } from "@/lib/demo-market-data";
import type { TimeRange } from "@/types";

const RANGES = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"];

// Data Cache: one shared upstream fetch per range per 60s across all instances,
// with stale-while-revalidate (the argument `range` is part of the cache key).
const cachedDemoQuotes = unstable_cache(
  (range: TimeRange) => demoQuotes(range),
  ["demo-quotes"],
  { revalidate: 60 },
);

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("range") ?? "1D";
  const range = (RANGES.includes(raw) ? raw : "1D") as TimeRange;
  const data = await cachedDemoQuotes(range);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" },
  });
}
