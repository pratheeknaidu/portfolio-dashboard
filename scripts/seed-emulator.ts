import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

const app = initializeApp({ projectId: "demo-portfolio" });
const db = getFirestore(app);
const auth = getAuth(app);

const SEED_UID = "seed-user-001";

const holdings = [
  { ticker: "AAPL", companyName: "Apple Inc.", sector: "Technology", shares: 50, avgCost: 142.80 },
  { ticker: "MSFT", companyName: "Microsoft Corp.", sector: "Technology", shares: 30, avgCost: 280.50 },
  { ticker: "GOOGL", companyName: "Alphabet Inc.", sector: "Technology", shares: 15, avgCost: 130.25 },
  { ticker: "AMZN", companyName: "Amazon.com Inc.", sector: "Consumer Cyclical", shares: 20, avgCost: 145.00 },
  { ticker: "XOM", companyName: "Exxon Mobil Corp.", sector: "Energy", shares: 100, avgCost: 90.00 },
  { ticker: "JNJ", companyName: "Johnson & Johnson", sector: "Healthcare", shares: 40, avgCost: 155.00 },
  { ticker: "JPM", companyName: "JPMorgan Chase", sector: "Financial Services", shares: 25, avgCost: 170.00 },
  { ticker: "NVDA", companyName: "NVIDIA Corp.", sector: "Technology", shares: 10, avgCost: 450.00 },
];

const snapshots = [
  { date: "2026-03-20", totalValue: 44500 },
  { date: "2026-03-21", totalValue: 45200 },
  { date: "2026-03-22", totalValue: 44800 },
  { date: "2026-03-23", totalValue: 46100 },
  { date: "2026-03-24", totalValue: 47300 },
  { date: "2026-03-25", totalValue: 46800 },
  { date: "2026-03-26", totalValue: 48230 },
];

async function seed() {
  console.log("Creating seed user...");
  try {
    await auth.createUser({ uid: SEED_UID, email: "seed@test.com", displayName: "Seed User" });
  } catch {
    console.log("User already exists, continuing...");
  }

  console.log("Writing holdings...");
  for (const h of holdings) {
    await db.collection("users").doc(SEED_UID).collection("holdings").doc(h.ticker).set({
      ...h,
      addedAt: new Date().toISOString(),
    });
  }

  console.log("Writing snapshots...");
  for (const s of snapshots) {
    await db.collection("users").doc(SEED_UID).collection("snapshots").doc(s.date).set(s);
  }

  console.log("Seed complete. Holdings:", holdings.length, "Snapshots:", snapshots.length);
  process.exit(0);
}

seed();
