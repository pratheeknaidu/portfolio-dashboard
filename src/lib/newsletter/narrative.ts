import { GoogleGenAI } from "@google/genai";
import type { NewsletterReport } from "./build-report";

// "-latest" alias tracks Google's current Flash model, which the free tier covers.
const DEFAULT_MODEL = "gemini-flash-latest";

const SYSTEM = `You write a short morning briefing for one retail investor about their own stock portfolio.
You receive a JSON report computed from their holdings for the most recent trading session.
Use Google Search to find the actual news behind the biggest movers and the leading sectors — earnings, guidance, macro data, analyst actions. Do not invent catalysts; if you can't find a reason, say the move looks market-driven.

Write these sections, each starting with a "### " heading line:
### What drove yesterday
### Sectors worth a look
### Positions to consider trimming
### Watch list

Rules:
- Plain text only. Use "- " bullet lines and **bold** for tickers; no tables, links, or other markdown.
- Under 350 words total. Lead with the dollar impact; be specific and concrete.
- Base trimming and sector calls on the report's flags and the news you found. Frame them as things to consider, not instructions.
- If a section has nothing worth saying, write one line saying so.`;

/**
 * Optional LLM layer over the rule-based report: explains *why* things moved
 * using Gemini grounded in Google Search. Returns null when no API key is
 * configured or the call fails (including free-tier quota errors), so the
 * email still goes out with the deterministic sections.
 */
export async function writeNarrative(report: NewsletterReport): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      contents: `Portfolio report:\n${JSON.stringify(report)}`,
      config: {
        systemInstruction: SYSTEM,
        tools: [{ googleSearch: {} }],
      },
    });
    return response.text?.trim() || null;
  } catch (err) {
    console.error("newsletter narrative failed:", err);
    return null;
  }
}
