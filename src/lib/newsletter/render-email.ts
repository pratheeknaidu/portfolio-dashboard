import type { Flag, NewsletterReport } from "./build-report";

const GAIN = "#1f9d55";
const LOSS = "#d64545";
const MUTED = "#6b7280";

export const DISCLAIMER =
  "Automated summary generated from your holdings and public market data. Not financial advice.";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function money(n: number): string {
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function color(n: number): string {
  return n >= 0 ? GAIN : LOSS;
}

function signed(text: string, n: number): string {
  return `<span style="color:${color(n)};font-weight:600">${esc(text)}</span>`;
}

/**
 * The narrative comes back as constrained plain text (### headings, "- "
 * bullets, **bold**). Escape first, then apply that tiny subset — never
 * pass model output through as raw HTML.
 */
export function narrativeToHtml(text: string): string {
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(`<ul style="margin:4px 0 12px;padding-left:20px">${list.join("")}</ul>`);
    list = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("### ")) {
      flush();
      out.push(`<h3 style="margin:18px 0 6px;font-size:15px">${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("- ")) {
      list.push(`<li style="margin:2px 0">${inline(line.slice(2))}</li>`);
    } else if (line) {
      flush();
      out.push(`<p style="margin:6px 0">${inline(line)}</p>`);
    } else {
      flush();
    }
  }
  flush();
  return out.join("\n");
}

function flagRows(flags: Flag[]): string {
  return flags
    .map(
      (f) => `<tr>
  <td style="padding:6px 8px;vertical-align:top"><strong>${esc(f.ticker)}</strong><br><span style="color:${MUTED};font-size:12px">${esc(f.companyName)}</span></td>
  <td style="padding:6px 8px;vertical-align:top;white-space:nowrap">${signed(pct(f.totalPLPercent), f.totalPL)}<br><span style="font-size:12px">${signed(money(f.totalPL), f.totalPL)}</span></td>
  <td style="padding:6px 8px;vertical-align:top;font-size:13px">${f.reasons.map(esc).join("<br>")}</td>
</tr>`,
    )
    .join("\n");
}

function section(title: string, body: string): string {
  return `<h2 style="margin:24px 0 8px;font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">${esc(title)}</h2>\n${body}`;
}

export function subjectFor(report: NewsletterReport): string {
  const { dayChange, dayChangePercent } = report.totals;
  return `Portfolio brief ${report.date}: ${money(dayChange)} (${pct(dayChangePercent)})`;
}

export function renderHtml(report: NewsletterReport, narrative: string | null): string {
  const t = report.totals;
  const parts: string[] = [];

  const bench =
    report.benchmarkChangePercent !== undefined
      ? ` &middot; S&amp;P 500 (SPY) ${signed(pct(report.benchmarkChangePercent), report.benchmarkChangePercent)}`
      : "";
  parts.push(`<p style="font-size:13px;color:${MUTED};margin:0">Today's session</p>
<p style="font-size:28px;margin:4px 0">${signed(money(t.dayChange), t.dayChange)} <span style="font-size:18px">${signed(pct(t.dayChangePercent), t.dayChange)}</span></p>
<p style="margin:0;font-size:14px">Portfolio value $${t.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })} &middot; Total P&amp;L ${signed(`${money(t.totalPL)} (${pct(t.totalPLPercent)})`, t.totalPL)}${bench}</p>`);

  if (narrative) {
    parts.push(section("Briefing", narrativeToHtml(narrative)));
  }

  const driverList = (ds: NewsletterReport["gainers"]) =>
    ds
      .map((d) => `<li><strong>${esc(d.ticker)}</strong> ${signed(money(d.contribution), d.contribution)} (${pct(d.changePercent)})</li>`)
      .join("");
  parts.push(
    section(
      "Biggest movers",
      `<table width="100%"><tr>
<td style="vertical-align:top;width:50%"><strong style="color:${GAIN}">Gainers</strong><ul style="padding-left:18px;margin:4px 0">${driverList(report.gainers) || "<li>None</li>"}</ul></td>
<td style="vertical-align:top;width:50%"><strong style="color:${LOSS}">Losers</strong><ul style="padding-left:18px;margin:4px 0">${driverList(report.losers) || "<li>None</li>"}</ul></td>
</tr></table>`,
    ),
  );

  if (report.sectorDrivers.length) {
    parts.push(
      section(
        "P&L by sector",
        `<table style="border-collapse:collapse;font-size:14px">${report.sectorDrivers
          .map(
            (s) =>
              `<tr><td style="padding:3px 12px 3px 0">${esc(s.sector)}</td><td style="padding:3px 12px 3px 0">${signed(money(s.contribution), s.contribution)}</td><td style="color:${MUTED};font-size:12px">${s.weightPct.toFixed(1)}% of portfolio</td></tr>`,
          )
          .join("")}</table>`,
      ),
    );
  }

  if (report.sectorsToWatch.length) {
    parts.push(
      section(
        "Sector momentum (1-month leaders)",
        `<table style="border-collapse:collapse;font-size:14px">${report.sectorsToWatch
          .map(
            (s) =>
              `<tr><td style="padding:3px 12px 3px 0">${esc(s.sector)} <span style="color:${MUTED}">(${esc(s.etf)})</span></td><td style="padding:3px 12px 3px 0">1M ${signed(pct(s.monthPct), s.monthPct)}</td><td style="padding:3px 12px 3px 0">1D ${signed(pct(s.dayPct), s.dayPct)}</td><td style="color:${MUTED};font-size:12px">You hold ${s.portfolioWeightPct.toFixed(1)}%${s.avgUpsidePct !== undefined ? ` &middot; avg analyst upside ${pct(s.avgUpsidePct)}` : ""}</td></tr>`,
          )
          .join("")}</table>`,
      ),
    );
  }

  parts.push(
    section(
      "Consider taking profits",
      report.takeProfit.length
        ? `<table style="border-collapse:collapse" width="100%">${flagRows(report.takeProfit)}</table>`
        : `<p style="color:${MUTED}">No winners are flashing a trim signal today.</p>`,
    ),
  );

  if (report.review.length) {
    parts.push(
      section("Losers worth a second look", `<table style="border-collapse:collapse" width="100%">${flagRows(report.review)}</table>`),
    );
  }

  if (report.failedTickers.length) {
    parts.push(`<p style="color:${MUTED};font-size:12px">No quote for: ${report.failedTickers.map(esc).join(", ")}</p>`);
  }

  return `<!doctype html>
<html><body style="margin:0;background:#f5f6f8">
<div style="max-width:640px;margin:0 auto;padding:24px;background:#ffffff;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111827;line-height:1.45">
<h1 style="font-size:18px;margin:0 0 16px">Portfolio brief &middot; ${esc(report.date)}</h1>
${parts.join("\n")}
<p style="margin-top:28px;color:${MUTED};font-size:11px">${esc(DISCLAIMER)}</p>
</div></body></html>`;
}

export function renderText(report: NewsletterReport, narrative: string | null): string {
  const t = report.totals;
  const lines: string[] = [
    `Portfolio brief ${report.date}`,
    `Today: ${money(t.dayChange)} (${pct(t.dayChangePercent)}) | Value $${t.totalValue.toFixed(0)} | Total P&L ${money(t.totalPL)} (${pct(t.totalPLPercent)})`,
    "",
  ];
  if (narrative) lines.push(narrative, "");
  lines.push("Gainers: " + (report.gainers.map((d) => `${d.ticker} ${money(d.contribution)}`).join(", ") || "none"));
  lines.push("Losers: " + (report.losers.map((d) => `${d.ticker} ${money(d.contribution)}`).join(", ") || "none"));
  if (report.sectorsToWatch.length) {
    lines.push("", "Sector momentum (1M): " + report.sectorsToWatch.map((s) => `${s.sector} ${pct(s.monthPct)}`).join(", "));
  }
  if (report.takeProfit.length) {
    lines.push("", "Consider taking profits:");
    for (const f of report.takeProfit) lines.push(`- ${f.ticker} ${pct(f.totalPLPercent)}: ${f.reasons.join("; ")}`);
  }
  if (report.review.length) {
    lines.push("", "Losers worth a second look:");
    for (const f of report.review) lines.push(`- ${f.ticker} ${pct(f.totalPLPercent)}: ${f.reasons.join("; ")}`);
  }
  lines.push("", DISCLAIMER);
  return lines.join("\n");
}
