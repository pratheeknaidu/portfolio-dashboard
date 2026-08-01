import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { demoHistory } from "@/lib/demo-market-data";

const cachedDemoHistory = unstable_cache(demoHistory, ["demo-history"], {
  revalidate: 86_400, // daily — the series only gains one point per trading day
});

export async function GET() {
  const data = await cachedDemoHistory();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" },
  });
}
