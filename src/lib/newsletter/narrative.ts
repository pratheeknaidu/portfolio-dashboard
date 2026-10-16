import Anthropic from "@anthropic-ai/sdk";
import type { NewsletterReport } from "./build-report";

const MODEL = "claude-opus-5-5";
// A paused server-tool turn (long web search) is resumed by re-sending; cap it.
const MAX_CONTINUATIONS = 3;

const SYSTEM = `You write a short morning briefing for one retail investor about their own stock portfolio.
You receive a JSON report computed from their holdings for the most recent trading session.
Use web search to find the actual news behind the biggest movers and the leading sectors — earnings, guidance, macro data, analyst actions. Do not invent catalysts; if you can't find a reason, say the move looks market-driven.

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
 * using web search. Returns null when no API key is configured or the call
 * fails, so the email still goes out with the deterministic sections.
 */
export async function writeNarrative(report: NewsletterReport): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `Portfolio report:\n${JSON.stringify(report)}` },
  ];

  try {
    for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: SYSTEM,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
        messages,
      });

      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      if (response.stop_reason === "refusal") {
        console.error("newsletter narrative refused:", response.stop_details);
        return null;
      }

      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      return text || null;
    }
    console.error("newsletter narrative: exceeded continuation limit");
    return null;
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(`newsletter narrative API error ${err.status}:`, err.message);
    } else {
      console.error("newsletter narrative failed:", err);
    }
    return null;
  }
}
