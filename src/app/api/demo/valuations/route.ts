import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { demoValuations } from "@/lib/demo-market-data";

// Live-data endpoint: compute per request (deduped/cached by unstable_cache and
// the edge via Cache-Control), never prerendered at build against Yahoo.
export const dynamic = "force-dynamic";

const cachedDemoValuations = unstable_cache(demoValuations, ["demo-valuations"], {
  revalidate: 21_600, // 6h — valuations move slowly
});

export async function GET() {
  const data = await cachedDemoValuations();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
  });
}
