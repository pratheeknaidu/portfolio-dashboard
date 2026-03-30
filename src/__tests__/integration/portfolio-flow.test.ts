/**
 * @jest-environment node
 */
/**
 * Integration test that requires Firebase emulators running.
 * Run with: firebase emulators:exec "npx jest --testPathPattern=integration"
 */
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

const app = initializeApp({ projectId: "demo-portfolio" }, "integration-test");
const db = getFirestore(app);

const TEST_UID = "test-user-integration";

describe("Portfolio Flow (integration)", () => {
  beforeAll(async () => {
    const holdingsSnap = await db.collection("users").doc(TEST_UID).collection("holdings").get();
    for (const doc of holdingsSnap.docs) {
      await doc.ref.delete();
    }
  });

  it("writes a holding and reads it back", async () => {
    const holdingRef = db.collection("users").doc(TEST_UID).collection("holdings").doc("AAPL");
    await holdingRef.set({
      ticker: "AAPL",
      companyName: "Apple Inc.",
      sector: "Technology",
      shares: 50,
      avgCost: 142.80,
      addedAt: new Date().toISOString(),
    });

    const doc = await holdingRef.get();
    expect(doc.exists).toBe(true);
    expect(doc.data()?.ticker).toBe("AAPL");
    expect(doc.data()?.shares).toBe(50);
  });

  it("writes a snapshot with date-based ID for idempotency", async () => {
    const snapshotRef = db.collection("users").doc(TEST_UID).collection("snapshots").doc("2026-03-26");

    await snapshotRef.set({ date: "2026-03-26", totalValue: 48000, holdings: { AAPL: 9275 } });
    await snapshotRef.set({ date: "2026-03-26", totalValue: 48230, holdings: { AAPL: 9275 } });

    const doc = await snapshotRef.get();
    expect(doc.data()?.totalValue).toBe(48230);
  });

  it("upserts holding (import merge behavior)", async () => {
    const holdingRef = db.collection("users").doc(TEST_UID).collection("holdings").doc("AAPL");

    await holdingRef.set({ ticker: "AAPL", shares: 50, avgCost: 142.80 }, { merge: true });
    await holdingRef.set({ ticker: "AAPL", shares: 75, avgCost: 150.00 }, { merge: true });

    const doc = await holdingRef.get();
    expect(doc.data()?.shares).toBe(75);
    expect(doc.data()?.avgCost).toBe(150.00);
  });

  it("reads all holdings for a user", async () => {
    await db.collection("users").doc(TEST_UID).collection("holdings").doc("MSFT").set({
      ticker: "MSFT", shares: 30, avgCost: 280.50,
    });

    const snapshot = await db.collection("users").doc(TEST_UID).collection("holdings").get();
    const tickers = snapshot.docs.map(d => d.id);

    expect(tickers).toContain("AAPL");
    expect(tickers).toContain("MSFT");
  });
});
