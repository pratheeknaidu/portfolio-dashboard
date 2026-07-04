import type {
  Holding,
  PortfolioItem,
  Snapshot,
  TimeRange,
  ValuationData,
  RecommendationKey,
} from "@/types";
import { getMockQuotes } from "@/lib/yahoo-finance-mock";

/**
 * Static fixture powering the public `/demo` experience. Everything here is
 * deterministic and offline: holdings are hard-coded, quotes come from the
 * existing mock generator, valuations/snapshots are hash-seeded. No auth, no
 * Firestore, no network — a recruiter or curious visitor can explore the real
 * UI without signing in, and nothing they do writes anywhere.
 *
 * The holdings mirror scripts/seed-emulator.ts so the demo and the local
 * sandbox tell the same story.
 */
export const DEMO_HOLDINGS: Holding[] = [
  { ticker: "AAPL",  companyName: "Apple Inc.",          sector: "Technology",             shares: 80, avgCost: 142.8,  addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "MSFT",  companyName: "Microsoft Corp.",     sector: "Technology",             shares: 40, avgCost: 310.5,  addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "NVDA",  companyName: "NVIDIA Corp.",        sector: "Technology",             shares: 35, avgCost: 480.0,  addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "GOOGL", companyName: "Alphabet Inc.",       sector: "Technology",             shares: 30, avgCost: 145.25, addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "AMZN",  companyName: "Amazon.com Inc.",     sector: "Consumer Cyclical",      shares: 25, avgCost: 175.0,  addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "TSLA",  companyName: "Tesla Inc.",          sector: "Consumer Cyclical",      shares: 22, avgCost: 240.0,  addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "HD",    companyName: "Home Depot Inc.",     sector: "Consumer Cyclical",      shares: 12, avgCost: 360.0,  addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "JPM",   companyName: "JPMorgan Chase",      sector: "Financial Services",     shares: 45, avgCost: 175.0,  addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "V",     companyName: "Visa Inc.",           sector: "Financial Services",     shares: 28, avgCost: 245.0,  addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "BRK",   companyName: "Berkshire Hathaway",  sector: "Financial Services",     shares: 18, avgCost: 395.0,  addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "UNH",   companyName: "UnitedHealth Group",  sector: "Healthcare",             shares: 14, avgCost: 510.0,  addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "JNJ",   companyName: "Johnson & Johnson",   sector: "Healthcare",             shares: 50, avgCost: 158.0,  addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "PG",    companyName: "Procter & Gamble",    sector: "Consumer Defensive",     shares: 32, avgCost: 152.0,  addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "KO",    companyName: "Coca-Cola Co.",       sector: "Consumer Defensive",     shares: 60, avgCost: 58.0,   addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "META",  companyName: "Meta Platforms",      sector: "Communication Services", shares: 18, avgCost: 320.0,  addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "NFLX",  companyName: "Netflix Inc.",        sector: "Communication Services", shares: 10, avgCost: 480.0,  addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "XOM",   companyName: "Exxon Mobil Corp.",   sector: "Energy",                 shares: 70, avgCost: 105.0,  addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "CAT",   companyName: "Caterpillar Inc.",    sector: "Industrials",            shares: 15, avgCost: 285.0,  addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "NEE",   companyName: "NextEra Energy",      sector: "Utilities",              shares: 55, avgCost: 72.0,   addedAt: "2026-01-02T00:00:00.000Z" },
  { ticker: "PLD",   companyName: "Prologis Inc.",       sector: "Real Estate",            shares: 35, avgCost: 118.0,  addedAt: "2026-01-02T00:00:00.000Z" },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Merge the demo holdings with mock quotes into the PortfolioItem shape the
 * dashboard renders. Mirrors the merge in src/app/page.tsx (including the
 * "ALL" range using cost basis as the reference) so demo tiles behave exactly
 * like live ones.
 */
export function buildDemoItems(range: TimeRange = "1D"): PortfolioItem[] {
  const tickers = DEMO_HOLDINGS.map((h) => h.ticker);
  const quotes = getMockQuotes(tickers, range === "ALL" ? "1D" : range);

  return DEMO_HOLDINGS.filter((h) => quotes[h.ticker]).map((h) => {
    const q = quotes[h.ticker];
    const marketValue = h.shares * q.price;
    const costBasis = h.shares * h.avgCost;
    const totalPL = marketValue - costBasis;
    const totalPLPercent = (totalPL / costBasis) * 100;
    const quote =
      range === "ALL"
        ? { ...q, change: q.price - h.avgCost, changePercent: totalPLPercent }
        : q;
    return { ...h, quote, marketValue, totalPL, totalPLPercent };
  });
}

const RECOMMENDATIONS: { key: RecommendationKey; mean: number }[] = [
  { key: "strong_buy", mean: 1.4 },
  { key: "buy", mean: 2.0 },
  { key: "hold", mean: 2.8 },
  { key: "sell", mean: 3.6 },
  { key: "strong_sell", mean: 4.3 },
];

/**
 * Deterministic, hash-seeded analyst/valuation data so the Analytics page's
 * sentiment and valuation cards render a realistic spread instead of an
 * all-"no coverage" empty state.
 */
export function getDemoValuations(): Record<string, ValuationData> {
  const out: Record<string, ValuationData> = {};
  for (const h of DEMO_HOLDINGS) {
    const seed = hash(h.ticker);
    const rec = RECOMMENDATIONS[seed % RECOMMENDATIONS.length];
    const upside = (seed % 70) - 25; // -25% .. +44%
    out[h.ticker] = {
      recommendationKey: rec.key,
      recommendationMean: rec.mean,
      numberOfAnalystOpinions: 8 + (seed % 30),
      upsideToTargetPct: upside,
      valuationSource: "analyst_target",
    };
  }
  return out;
}

/**
 * 90 days of weekday-only snapshots with gentle upward drift plus layered sine
 * waves — same generator shape as scripts/seed-emulator.ts so the performance
 * chart looks organic. `holdings` is left empty; the chart only reads totals.
 */
function generateDemoSnapshots(days: number): Snapshot[] {
  const start = 175_000;
  const end = 198_500;
  const out: Snapshot[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const day = date.getDay();
    if (day === 0 || day === 6) continue; // markets closed on weekends

    const t = (days - 1 - i) / (days - 1);
    const trend = start + (end - start) * t;
    const slow = Math.sin(t * Math.PI * 2 + 0.7) * 4_200;
    const med = Math.sin(t * Math.PI * 8 + 1.3) * 1_800;
    const fast = Math.sin(t * Math.PI * 24 + 0.2) * 650;

    out.push({
      date: date.toISOString().split("T")[0],
      totalValue: Math.round(trend + slow + med + fast),
      holdings: {},
    });
  }
  return out;
}

export const DEMO_SNAPSHOTS: Snapshot[] = generateDemoSnapshots(90);
