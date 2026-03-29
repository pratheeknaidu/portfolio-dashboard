import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/verify-token";
import { adminDb } from "@/lib/firebase-admin";
import Papa from "papaparse";
import yahooFinance from "yahoo-finance2";

export async function POST(req: NextRequest) {
  const authResult = await verifyRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const { uid } = authResult;
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const csvText = await file.text();
  const { data, errors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const imported: string[] = [];
  const updated: string[] = [];
  const importErrors: string[] = [];

  const holdingsRef = adminDb.collection("users").doc(uid).collection("holdings");

  for (const row of data) {
    const ticker = (row["Instrument"] || row["Symbol"] || "").trim().toUpperCase();
    const shares = parseFloat(row["Quantity"] || "0");
    const avgCost = parseFloat(row["Average Cost"]?.replace("$", "") || "0");

    if (!ticker || isNaN(shares) || shares <= 0) {
      importErrors.push(`Invalid row: ${JSON.stringify(row)}`);
      continue;
    }

    let companyName = "";
    let sector = "";

    try {
      const summary = await yahooFinance.quoteSummary(ticker, { modules: ["price", "summaryProfile"] });
      companyName = summary.price?.shortName ?? "";
      sector = summary.summaryProfile?.sector ?? "";
    } catch {
      // Will populate lazily later
    }

    const existing = await holdingsRef.doc(ticker).get();

    await holdingsRef.doc(ticker).set(
      { ticker, companyName, sector, shares, avgCost, addedAt: new Date().toISOString() },
      { merge: true }
    );

    if (existing.exists) {
      updated.push(ticker);
    } else {
      imported.push(ticker);
    }
  }

  return NextResponse.json({ imported, updated, errors: importErrors });
}
