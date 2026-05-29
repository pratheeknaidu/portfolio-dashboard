import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const TICKERS = ["AAPL", "MSFT", "NVDA", "JPM", "JNJ", "XOM", "SNOW", "PLTR", "HOOD", "RKLB", "SPY", "QQQ"];

type Row = {
  ticker: string;
  price?: number;
  fairValueDesc?: string;
  fairValueDiscount?: string;
  fairValueProvider?: string;
  recKey?: string;
  recMean?: number;
  targetMean?: number;
  upsidePct?: number;
};

async function probe(ticker: string): Promise<Row> {
  const row: Row = { ticker };
  try {
    const q = await yf.quote(ticker);
    row.price = q.regularMarketPrice;
  } catch {}

  try {
    const ins = await yf.insights(ticker);
    const val = ins.instrumentInfo?.valuation;
    if (val) {
      row.fairValueDesc = val.description;
      row.fairValueDiscount = val.discount;
      row.fairValueProvider = val.provider;
    }
  } catch (e) {
    // insights can throw on illiquid symbols
  }

  try {
    const qs = await yf.quoteSummary(ticker, { modules: ["financialData"] });
    const fd = qs.financialData;
    if (fd) {
      row.recKey = fd.recommendationKey;
      row.recMean = fd.recommendationMean;
      row.targetMean = fd.targetMeanPrice as number | undefined;
      if (row.targetMean && row.price) {
        row.upsidePct = ((row.targetMean - row.price) / row.price) * 100;
      }
    }
  } catch {}

  return row;
}

(async () => {
  const rows = await Promise.all(TICKERS.map(probe));

  console.log("\n=== RAW DATA ===");
  for (const r of rows) {
    console.log(JSON.stringify(r));
  }

  console.log("\n=== COVERAGE SUMMARY ===");
  const total = rows.length;
  const haveRec = rows.filter((r) => r.recKey).length;
  const haveFV = rows.filter((r) => r.fairValueDesc || r.fairValueDiscount).length;
  const haveTarget = rows.filter((r) => r.targetMean).length;
  const haveAnyValuation = rows.filter((r) => (r.fairValueDesc || r.fairValueDiscount) || r.targetMean).length;

  console.log(`Total tickers:           ${total}`);
  console.log(`Have recommendationKey:  ${haveRec}/${total}  (Card 1 — Analyst Sentiment)`);
  console.log(`Have Morningstar FV:     ${haveFV}/${total}  (Card 2 primary)`);
  console.log(`Have analyst target:     ${haveTarget}/${total}  (Card 2 fallback)`);
  console.log(`Have ANY valuation:      ${haveAnyValuation}/${total}  (Card 2 effective coverage)`);

  console.log("\n=== PER-TICKER ===");
  console.log("ticker  price    rec       recMean  fvDesc            fvDisc   target   upside%");
  for (const r of rows) {
    const px = r.price?.toFixed(2).padStart(8) ?? "  -    ";
    const rec = (r.recKey ?? "-").padEnd(10);
    const rm = (r.recMean?.toFixed(2) ?? "-").padStart(7);
    const fv = (r.fairValueDesc ?? "-").padEnd(18);
    const fvd = (r.fairValueDiscount ?? "-").padStart(8);
    const tgt = (r.targetMean?.toFixed(2) ?? "-").padStart(8);
    const up = (r.upsidePct?.toFixed(1) ?? "-").padStart(7);
    console.log(`${r.ticker.padEnd(7)} ${px}  ${rec} ${rm}  ${fv} ${fvd} ${tgt}  ${up}`);
  }
})();
