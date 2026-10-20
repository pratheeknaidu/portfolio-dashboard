import { GoogleGenAI } from "@google/genai";
import type { NewsletterReport } from "./build-report";

// "-latest" alias tracks Google's current Flash model, which the free tier covers.
const DEFAULT_MODEL = "gemini-flash-latest";

const SYSTEM = `You write a short end-of-day briefing for one retail investor about their own stock portfolio.
You receive a JSON report computed from their holdings for today's trading session. It contains only percentages and portfolio weights, never dollar amounts.
Use Google Search to find the actual news behind the biggest movers and the leading sectors — earnings, guidance, macro data, analyst actions. Do not invent catalysts; if you can't find a reason, say the move looks market-driven.

Write these sections, each starting with a "### " heading line:
### What drove today
### Sectors worth a look
### Positions to consider trimming
### Watch list

Rules:
- Plain text only. Use "- " bullet lines and **bold** for tickers; no tables, links, or other markdown.
- Under 350 words total. Be specific and concrete.
- Use percentages and portfolio weights only. Never state or estimate dollar amounts, share counts, or the portfolio's value.
- Base trimming and sector calls on the report's flags and the news you found. Frame them as things to consider, not instructions.
- If a section has nothing worth saying, write one line saying so.`;

export interface NarrativeResult {
  text: string | null;
  /** Why there is no text, so dry runs can show it instead of failing silently. */
  error?: string;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * The report minus every dollar figure. Gemini (and, on the free tier, Google)
 * only ever sees tickers, sectors, percentages and weights — enough to explain
 * the moves without revealing the size of the portfolio.
 */
export function privateReport(report: NewsletterReport) {
  return {
    date: report.date,
    dayChangePercent: round(report.totals.dayChangePercent),
    totalReturnPercent: round(report.totals.totalPLPercent),
    benchmarkChangePercent: report.benchmarkChangePercent,
    gainers: report.gainers.map(({ ticker, companyName, sector, changePercent }) => ({ ticker, companyName, sector, changePercent })),
    losers: report.losers.map(({ ticker, companyName, sector, changePercent }) => ({ ticker, companyName, sector, changePercent })),
    sectors: report.sectorDrivers.map(({ sector, weightPct, contribution }) => ({
      sector,
      weightPct: round(weightPct),
      direction: contribution >= 0 ? "up" : "down",
    })),
    sectorsToWatch: report.sectorsToWatch,
    takeProfit: report.takeProfit.map(({ ticker, companyName, totalPLPercent, weightPct, reasons }) => ({
      ticker,
      companyName,
      totalPLPercent: round(totalPLPercent),
      weightPct: round(weightPct),
      // Reasons are already percentage/price based; drop any that quote dollars.
      reasons: reasons.filter((r) => !r.includes("$")),
    })),
    review: report.review.map(({ ticker, companyName, totalPLPercent, weightPct, reasons }) => ({
      ticker,
      companyName,
      totalPLPercent: round(totalPLPercent),
      weightPct: round(weightPct),
      reasons: reasons.filter((r) => !r.includes("$")),
    })),
  };
}

/**
 * Optional LLM layer over the rule-based report: explains *why* things moved
 * using Gemini grounded in Google Search. Returns no text (with the reason)
 * when no API key is configured or the call fails, including free-tier quota
 * errors, so the email still goes out with the deterministic sections.
 */
export async function writeNarrative(report: NewsletterReport): Promise<NarrativeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { text: null, error: "GEMINI_API_KEY is not set" };

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      contents: `Portfolio report:\n${JSON.stringify(privateReport(report))}`,
      config: {
        systemInstruction: SYSTEM,
        tools: [{ googleSearch: {} }],
      },
    });
    const text = response.text?.trim();
    return text ? { text } : { text: null, error: "Gemini returned an empty response" };
  } catch (err) {
    console.error("newsletter narrative failed:", err);
    return { text: null, error: err instanceof Error ? err.message : String(err) };
  }
}
