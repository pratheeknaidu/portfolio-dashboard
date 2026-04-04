import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/verify-token";
import { adminDb } from "@/lib/firebase-admin";
import Papa from "papaparse";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export async function POST(req: NextRequest) {
  const authResult = await verifyRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const { uid } = authResult;

  const imported: string[] = [];
  const updated: string[] = [];
  const importErrors: string[] = [];
  const holdingsMap = new Map<string, { shares: number; totalCost: number; companyName: string }>();

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    // Paste mode: parse Robinhood positions text
    const { pasteText } = await req.json();
    if (!pasteText || typeof pasteText !== "string") {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }
    parsePastedPositions(pasteText, holdingsMap, importErrors);
  } else {
    // File upload mode: CSV
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    const csvText = await file.text();
    parseCsv(csvText, holdingsMap, importErrors);
  }

  const holdingsRef = adminDb.collection("users").doc(uid).collection("holdings");

  for (const [ticker, { shares, totalCost, companyName: parsedName }] of holdingsMap) {
    if (shares <= 0) continue;

    const avgCost = totalCost / shares;
    let companyName = parsedName || "";
    let sector = "";

    try {
      const summary = await yahooFinance.quoteSummary(ticker, { modules: ["price", "summaryProfile"] });
      companyName = summary.price?.shortName ?? companyName;
      sector = summary.summaryProfile?.sector ?? "";
    } catch {
      // Will populate lazily later
    }

    const existing = await holdingsRef.doc(ticker).get();

    const payload: Record<string, unknown> = { ticker, companyName, sector, shares, avgCost };
    if (!existing.exists) payload.addedAt = new Date().toISOString();
    await holdingsRef.doc(ticker).set(payload, { merge: true });

    if (existing.exists) {
      updated.push(ticker);
    } else {
      imported.push(ticker);
    }
  }

  return NextResponse.json({ imported, updated, errors: importErrors });
}

/**
 * Parse pasted text from Robinhood positions page.
 * Format: each stock is 7 lines:
 *   Company Name
 *   SYMBOL
 *   shares (number)
 *   $price
 *   $avgCost
 *   $totalReturn
 *   $equity
 *
 * Header lines (Stocks, Name, Symbol, Shares, Price, Average cost, Total return, Equity)
 * appear once at the top and are skipped.
 */
function parsePastedPositions(
  text: string,
  map: Map<string, { shares: number; totalCost: number; companyName: string }>,
  errors: string[],
) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Skip header lines
  const headerWords = new Set(["stocks", "name", "symbol", "shares", "price", "average cost", "total return", "equity"]);
  let startIdx = 0;
  while (startIdx < lines.length && headerWords.has(lines[startIdx].toLowerCase())) {
    startIdx++;
  }

  // Process in groups of 7: name, symbol, shares, price, avgCost, return, equity
  let i = startIdx;
  while (i + 6 < lines.length) {
    const companyName = lines[i];
    const ticker = lines[i + 1].toUpperCase();
    const sharesVal = parseFloat(lines[i + 2].replace(",", ""));
    const avgCostStr = lines[i + 4]; // index 4 = average cost (skip price at index 3)
    const avgCost = parseFloat(avgCostStr.replace("$", "").replace(",", ""));

    if (ticker && /^[A-Z.]+$/.test(ticker) && !isNaN(sharesVal) && sharesVal > 0 && !isNaN(avgCost)) {
      map.set(ticker, { shares: sharesVal, totalCost: sharesVal * avgCost, companyName });
      i += 7;
    } else {
      errors.push(`Could not parse near: ${companyName}`);
      i++;
    }
  }
}

/**
 * Parse CSV file (Robinhood transaction history or flat holdings).
 */
function parseCsv(
  csvText: string,
  map: Map<string, { shares: number; totalCost: number; companyName: string }>,
  errors: string[],
) {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const isTransactionHistory = data.length > 0 && "Trans Code" in data[0];

  if (isTransactionHistory) {
    for (const row of data) {
      const ticker = (row["Instrument"] || "").trim().toUpperCase();
      const transCode = (row["Trans Code"] || "").trim();
      if (!ticker || (transCode !== "Buy" && transCode !== "Sell")) continue;

      const qty = parseFloat(row["Quantity"] || "0");
      const price = parseFloat((row["Price"] || "0").replace("$", ""));
      if (isNaN(qty) || qty <= 0 || isNaN(price)) continue;

      const existing = map.get(ticker) || { shares: 0, totalCost: 0, companyName: "" };
      if (transCode === "Buy") {
        existing.totalCost += qty * price;
        existing.shares += qty;
      } else {
        const costPerShare = existing.shares > 0 ? existing.totalCost / existing.shares : 0;
        existing.shares -= qty;
        existing.totalCost = existing.shares * costPerShare;
      }
      map.set(ticker, existing);
    }
  } else {
    for (const row of data) {
      const ticker = (row["Instrument"] || row["Symbol"] || "").trim().toUpperCase();
      const shares = parseFloat(row["Quantity"] || "0");
      const avgCost = parseFloat((row["Average Cost"] || "0").replace("$", ""));
      if (!ticker || isNaN(shares) || shares <= 0) {
        errors.push(`Invalid row: ${JSON.stringify(row)}`);
        continue;
      }
      map.set(ticker, { shares, totalCost: shares * avgCost, companyName: "" });
    }
  }
}
