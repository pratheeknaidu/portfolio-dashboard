import type { PortfolioItem, RecommendationKey, ValuationData } from "@/types";
import { portfolioTotals, type PortfolioTotals } from "@/lib/design/portfolio-totals";

/** SPDR sector ETFs, keyed by the sector names Yahoo returns for holdings. */
export const SECTOR_ETFS: Record<string, string> = {
  Technology: "XLK",
  "Financial Services": "XLF",
  Healthcare: "XLV",
  "Consumer Cyclical": "XLY",
  "Communication Services": "XLC",
  Industrials: "XLI",
  "Consumer Defensive": "XLP",
  Energy: "XLE",
  Utilities: "XLU",
  "Real Estate": "XLRE",
  "Basic Materials": "XLB",
};

export const BENCHMARK = "SPY";

/** Below this gain a position is never flagged for profit-taking. */
export const TAKE_PROFIT_MIN_GAIN_PCT = 25;
/** A single position above this share of the portfolio counts as concentrated. */
export const CONCENTRATION_PCT = 15;
/** Losers at or below this are checked for bearish signals. */
export const REVIEW_MAX_LOSS_PCT = -20;

const BEARISH: RecommendationKey[] = ["sell", "strong_sell", "underperform"];

export interface Driver {
  ticker: string;
  companyName: string;
  sector: string;
  /** Signed dollars this position added to the day's change. */
  contribution: number;
  changePercent: number;
}

export interface SectorDriver {
  sector: string;
  contribution: number;
  weightPct: number;
}

export interface SectorToWatch {
  sector: string;
  etf: string;
  dayPct: number;
  monthPct: number;
  portfolioWeightPct: number;
  /** Mean analyst upside across your holdings in this sector, when known. */
  avgUpsidePct?: number;
}

export interface Flag {
  ticker: string;
  companyName: string;
  totalPL: number;
  totalPLPercent: number;
  weightPct: number;
  reasons: string[];
}

export interface NewsletterReport {
  date: string;
  totals: PortfolioTotals;
  benchmarkChangePercent?: number;
  gainers: Driver[];
  losers: Driver[];
  sectorDrivers: SectorDriver[];
  sectorsToWatch: SectorToWatch[];
  takeProfit: Flag[];
  review: Flag[];
  failedTickers: string[];
}

export interface EtfMove {
  dayPct: number;
  monthPct: number;
}

export interface BuildReportInput {
  date: string;
  items: PortfolioItem[];
  valuations: Record<string, ValuationData>;
  /** Keyed by ETF symbol (including BENCHMARK). */
  etfMoves: Record<string, EtfMove>;
  failedTickers?: string[];
}

function sectorOf(i: PortfolioItem): string {
  return i.sector && SECTOR_ETFS[i.sector] ? i.sector : "Other";
}

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(0)}%`;
}

function flagBase(i: PortfolioItem, totalValue: number) {
  return {
    ticker: i.ticker,
    companyName: i.companyName,
    totalPL: i.totalPL,
    totalPLPercent: i.totalPLPercent,
    weightPct: totalValue > 0 ? (i.marketValue / totalValue) * 100 : 0,
  };
}

function takeProfitReasons(i: PortfolioItem, v: ValuationData | undefined, weightPct: number): string[] {
  const reasons: string[] = [];
  if (v?.targetMeanPrice !== undefined && i.quote.price >= v.targetMeanPrice) {
    reasons.push(`Trading at or above the analyst mean target ($${v.targetMeanPrice.toFixed(2)})`);
  }
  if (v?.fairValueDescription === "Overvalued") {
    reasons.push(`Rated overvalued${v.fairValueProvider ? ` by ${v.fairValueProvider}` : ""}`);
  }
  if (v?.recommendationKey && BEARISH.includes(v.recommendationKey)) {
    reasons.push(`Analyst consensus is ${v.recommendationKey.replace("_", " ")}`);
  }
  if (weightPct >= CONCENTRATION_PCT) {
    reasons.push(`${weightPct.toFixed(0)}% of your portfolio — concentration risk`);
  }
  if (i.totalPLPercent >= 100) {
    reasons.push(`Up ${pct(i.totalPLPercent)} — a partial trim locks in the gain`);
  }
  return reasons;
}

function reviewReasons(v: ValuationData | undefined): string[] {
  const reasons: string[] = [];
  if (v?.recommendationKey && BEARISH.includes(v.recommendationKey)) {
    reasons.push(`Analyst consensus is ${v.recommendationKey.replace("_", " ")}`);
  }
  if (v?.fairValueDescription === "Overvalued") {
    reasons.push(`Still rated overvalued${v.fairValueProvider ? ` by ${v.fairValueProvider}` : ""}`);
  }
  if (v?.upsideToTargetPct !== undefined && v.upsideToTargetPct < 0) {
    reasons.push(`Analyst mean target is ${Math.abs(v.upsideToTargetPct).toFixed(0)}% below the current price`);
  }
  return reasons;
}

/**
 * Everything the morning email says, derived from one quote pass. Pure so the
 * rules are testable without Yahoo or Firestore. The flags are deliberately
 * rule-based and explainable — each carries the reasons that tripped it.
 */
export function buildReport(input: BuildReportInput): NewsletterReport {
  const { items, valuations, etfMoves } = input;
  const totals = portfolioTotals(items);

  const drivers: Driver[] = items
    .filter((i) => Number.isFinite(i.quote.change) && i.quote.change !== 0)
    .map((i) => ({
      ticker: i.ticker,
      companyName: i.companyName,
      sector: sectorOf(i),
      contribution: i.shares * i.quote.change,
      changePercent: i.quote.changePercent,
    }));

  const gainers = drivers
    .filter((d) => d.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);
  const losers = drivers
    .filter((d) => d.contribution < 0)
    .sort((a, b) => a.contribution - b.contribution)
    .slice(0, 3);

  const sectorContribution = new Map<string, number>();
  const sectorValue = new Map<string, number>();
  for (const i of items) {
    const s = sectorOf(i);
    const c = Number.isFinite(i.quote.change) ? i.shares * i.quote.change : 0;
    sectorContribution.set(s, (sectorContribution.get(s) ?? 0) + c);
    sectorValue.set(s, (sectorValue.get(s) ?? 0) + i.marketValue);
  }
  const weightOf = (s: string) =>
    totals.totalValue > 0 ? ((sectorValue.get(s) ?? 0) / totals.totalValue) * 100 : 0;

  const sectorDrivers: SectorDriver[] = [...sectorContribution.entries()]
    .map(([sector, contribution]) => ({ sector, contribution, weightPct: weightOf(sector) }))
    .filter((s) => s.contribution !== 0)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const upsides = new Map<string, number[]>();
  for (const i of items) {
    const u = valuations[i.ticker]?.upsideToTargetPct;
    if (u === undefined || !Number.isFinite(u)) continue;
    const s = sectorOf(i);
    upsides.set(s, [...(upsides.get(s) ?? []), u]);
  }

  // Strongest one-month sector momentum, the market-wide "where is money going" read.
  const sectorsToWatch: SectorToWatch[] = Object.entries(SECTOR_ETFS)
    .filter(([, etf]) => etfMoves[etf] && Number.isFinite(etfMoves[etf].monthPct))
    .map(([sector, etf]) => {
      const u = upsides.get(sector);
      return {
        sector,
        etf,
        dayPct: etfMoves[etf].dayPct,
        monthPct: etfMoves[etf].monthPct,
        portfolioWeightPct: weightOf(sector),
        avgUpsidePct: u?.length ? u.reduce((a, b) => a + b, 0) / u.length : undefined,
      };
    })
    .sort((a, b) => b.monthPct - a.monthPct)
    .slice(0, 3);

  const takeProfit: Flag[] = [];
  const review: Flag[] = [];
  for (const i of items) {
    const base = flagBase(i, totals.totalValue);
    const v = valuations[i.ticker];
    if (i.totalPLPercent >= TAKE_PROFIT_MIN_GAIN_PCT) {
      const reasons = takeProfitReasons(i, v, base.weightPct);
      if (reasons.length) takeProfit.push({ ...base, reasons });
    } else if (i.totalPLPercent <= REVIEW_MAX_LOSS_PCT) {
      const reasons = reviewReasons(v);
      if (reasons.length) review.push({ ...base, reasons });
    }
  }
  takeProfit.sort((a, b) => b.reasons.length - a.reasons.length || b.totalPL - a.totalPL);
  review.sort((a, b) => a.totalPL - b.totalPL);

  return {
    date: input.date,
    totals,
    benchmarkChangePercent: etfMoves[BENCHMARK]?.dayPct,
    gainers,
    losers,
    sectorDrivers,
    sectorsToWatch,
    takeProfit,
    review,
    failedTickers: input.failedTickers ?? [],
  };
}
