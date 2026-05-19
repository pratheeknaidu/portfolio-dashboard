import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Keep these in sync with src/lib/sandbox-constants.ts (duplicated to avoid
// ts-node ESM relative-import extension headaches).
const SANDBOX_USER_UID = "seed-user-001";
const SANDBOX_USER_EMAIL = "seed@test.com";
const SANDBOX_USER_PASSWORD = "sandbox-password";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

const app = initializeApp({ projectId: "demo-portfolio" });
const db = getFirestore(app);
const auth = getAuth(app);

const SEED_UID = SANDBOX_USER_UID;

// Diversified 16-holding portfolio across 9 sectors. Avg costs are mixed
// relative to the mock pricing model (base = 30 + hash%470 + sin drift), so
// the dashboard shows a realistic blend of winners and losers — not all green.
const holdings = [
  // Technology — large, concentrated
  { ticker: "AAPL",  companyName: "Apple Inc.",          sector: "Technology",            shares: 80, avgCost: 142.80 },
  { ticker: "MSFT",  companyName: "Microsoft Corp.",     sector: "Technology",            shares: 40, avgCost: 310.50 },
  { ticker: "NVDA",  companyName: "NVIDIA Corp.",        sector: "Technology",            shares: 35, avgCost: 480.00 },
  { ticker: "GOOGL", companyName: "Alphabet Inc.",       sector: "Technology",            shares: 30, avgCost: 145.25 },

  // Consumer Cyclical
  { ticker: "AMZN",  companyName: "Amazon.com Inc.",     sector: "Consumer Cyclical",     shares: 25, avgCost: 175.00 },
  { ticker: "TSLA",  companyName: "Tesla Inc.",          sector: "Consumer Cyclical",     shares: 22, avgCost: 240.00 },
  { ticker: "HD",    companyName: "Home Depot Inc.",     sector: "Consumer Cyclical",     shares: 12, avgCost: 360.00 },

  // Financial Services
  { ticker: "JPM",   companyName: "JPMorgan Chase",      sector: "Financial Services",    shares: 45, avgCost: 175.00 },
  { ticker: "V",     companyName: "Visa Inc.",           sector: "Financial Services",    shares: 28, avgCost: 245.00 },
  { ticker: "BRK",   companyName: "Berkshire Hathaway",  sector: "Financial Services",    shares: 18, avgCost: 395.00 },

  // Healthcare
  { ticker: "UNH",   companyName: "UnitedHealth Group",  sector: "Healthcare",            shares: 14, avgCost: 510.00 },
  { ticker: "JNJ",   companyName: "Johnson & Johnson",   sector: "Healthcare",            shares: 50, avgCost: 158.00 },

  // Consumer Defensive
  { ticker: "PG",    companyName: "Procter & Gamble",    sector: "Consumer Defensive",    shares: 32, avgCost: 152.00 },
  { ticker: "KO",    companyName: "Coca-Cola Co.",       sector: "Consumer Defensive",    shares: 60, avgCost: 58.00 },

  // Communication Services
  { ticker: "META",  companyName: "Meta Platforms",      sector: "Communication Services", shares: 18, avgCost: 320.00 },
  { ticker: "NFLX",  companyName: "Netflix Inc.",        sector: "Communication Services", shares: 10, avgCost: 480.00 },

  // Energy / Industrials / Utilities / Real Estate — single positions
  { ticker: "XOM",   companyName: "Exxon Mobil Corp.",   sector: "Energy",                shares: 70, avgCost: 105.00 },
  { ticker: "CAT",   companyName: "Caterpillar Inc.",    sector: "Industrials",           shares: 15, avgCost: 285.00 },
  { ticker: "NEE",   companyName: "NextEra Energy",      sector: "Utilities",             shares: 55, avgCost: 72.00 },
  { ticker: "PLD",   companyName: "Prologis Inc.",       sector: "Real Estate",           shares: 35, avgCost: 118.00 },
];

// Generate 90 days of snapshots with organic-looking drift: gentle upward
// trend with overlaid sin waves to mimic market volatility. The hero card
// sparkline reads from these. The dashboard will overwrite today's snapshot
// on first load with the real computed total.
function generateSnapshots(days: number): { date: string; totalValue: number }[] {
  const start = 175_000;
  const end = 198_500;
  const out: { date: string; totalValue: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const day = date.getDay();
    // Skip weekends — markets are closed, no snapshots recorded.
    if (day === 0 || day === 6) continue;

    const t = (days - 1 - i) / (days - 1);
    const trend = start + (end - start) * t;
    const slow = Math.sin(t * Math.PI * 2 + 0.7) * 4_200;
    const med = Math.sin(t * Math.PI * 8 + 1.3) * 1_800;
    const fast = Math.sin(t * Math.PI * 24 + 0.2) * 650;
    const totalValue = Math.round(trend + slow + med + fast);

    out.push({
      date: date.toISOString().split("T")[0],
      totalValue,
    });
  }
  return out;
}

async function seed() {
  console.log("Creating seed user...");
  try {
    await auth.createUser({
      uid: SEED_UID,
      email: SANDBOX_USER_EMAIL,
      password: SANDBOX_USER_PASSWORD,
      displayName: "Seed User",
    });
  } catch {
    // Already exists — ensure password matches in case it was rotated
    await auth.updateUser(SEED_UID, {
      email: SANDBOX_USER_EMAIL,
      password: SANDBOX_USER_PASSWORD,
    });
    console.log("User already exists, password refreshed.");
  }

  console.log(`Writing ${holdings.length} holdings across ${new Set(holdings.map((h) => h.sector)).size} sectors...`);
  for (const h of holdings) {
    await db.collection("users").doc(SEED_UID).collection("holdings").doc(h.ticker).set({
      ...h,
      addedAt: new Date().toISOString(),
    });
  }

  const snapshots = generateSnapshots(90);
  console.log(`Writing ${snapshots.length} daily snapshots (90-day window, weekdays only)...`);
  for (const s of snapshots) {
    await db.collection("users").doc(SEED_UID).collection("snapshots").doc(s.date).set(s);
  }

  console.log("Seed complete.");
  console.log(`  Holdings:   ${holdings.length}`);
  console.log(`  Sectors:    ${new Set(holdings.map((h) => h.sector)).size}`);
  console.log(`  Snapshots:  ${snapshots.length} (${snapshots[0].date} → ${snapshots[snapshots.length - 1].date})`);
  process.exit(0);
}

seed();
