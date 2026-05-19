/**
 * @jest-environment node
 */
import { parseCsv } from "@/lib/import/parse-csv";

const HEADER = `"Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"`;
const row = (
  date: string,
  ticker: string,
  code: string,
  qty: string,
  price = "",
  amount = "",
) =>
  `"${date}","${date}","${date}","${ticker}","desc","${code}","${qty}","${price}","${amount}"`;

const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");

describe("parseCsv — transaction history", () => {
  describe("the AMD bug — reverse-chronological history with closed position", () => {
    it("produces shares=0 when buys and sells net out, even if the CSV is newest-first", () => {
      // Real AMD history from the production bug, in CSV order (newest first):
      const text = csv(
        row("9/18/2025", "AMD", "Sell", "30.677325", "$158.13", "$4,851.01"),
        row("2/28/2025", "AMD", "Buy", "5", "$99.60", "($498.00)"),
        row("1/27/2025", "AMD", "Buy", "9", "$113.98", "($1,025.82)"),
        row("1/10/2025", "AMD", "Buy", "0.58672", "$116.46", "($68.33)"),
        row("1/10/2025", "AMD", "Buy", "8", "$116.46", "($931.67)"),
        row("12/30/2024", "AMD", "Buy", "8.07135", "$123.60", "($997.62)"),
        row("12/30/2024", "AMD", "Buy", "0.019255", "$123.60", "($2.38)"),
        row("8/13/2024", "AMD", "Sell", "5", "$140.00", "$699.98"),
        row("9/19/2023", "AMD", "Buy", "5", "$101.34", "($506.68)"),
      );
      const { holdings, errors } = parseCsv(text);
      const amd = holdings.get("AMD");
      // Position fully closed → either absent or shares effectively zero
      const shares = amd?.shares ?? 0;
      expect(Math.abs(shares)).toBeLessThan(1e-6);
      expect(amd?.totalCost ?? 0).toBe(0);
      expect(errors).toEqual([]);
    });

    it("does not produce huge negative totalCost from epsilon division", () => {
      // Construct a scenario where the OLD parser would explode: a sell
      // happens to drive shares to floating-point epsilon, then another sell
      // divides by it.
      const text = csv(
        row("1/15/2024", "TEST", "Sell", "100", "$10", "$1000"),
        row("1/14/2024", "TEST", "Buy", "33.33333333", "$10", "($333.33)"),
        row("1/13/2024", "TEST", "Buy", "33.33333333", "$10", "($333.33)"),
        row("1/12/2024", "TEST", "Buy", "33.33333334", "$10", "($333.33)"),
      );
      const { holdings } = parseCsv(text);
      const test = holdings.get("TEST");
      // After sorting chronologically: 3 Buys totaling exactly 100 shares,
      // then a Sell of 100. Net = 0. No epsilon nonsense.
      expect(Math.abs(test?.shares ?? 0)).toBeLessThan(1e-6);
      expect(test?.totalCost ?? 0).toBe(0);
      expect(Math.abs(test?.totalCost ?? 0)).toBeLessThan(1);
    });
  });

  describe("chronological processing (regardless of CSV order)", () => {
    it("computes the right cost basis when rows are out of order", () => {
      // 10 shares @ $100, sell 5 @ $200, hold remaining 5 @ $100 avg cost.
      const text = csv(
        row("3/1/2024", "AAA", "Sell", "5", "$200", "$1000"),
        row("1/1/2024", "AAA", "Buy", "10", "$100", "($1000)"),
      );
      const { holdings } = parseCsv(text);
      const aaa = holdings.get("AAA");
      expect(aaa?.shares).toBeCloseTo(5, 6);
      expect(aaa?.totalCost).toBeCloseTo(500, 4);
    });
  });

  describe("new trans codes", () => {
    it("SPL: stock split adds shares without changing cost basis", () => {
      // Buy 10 @ $400, then 4-for-1 split adds 30 shares
      const text = csv(
        row("1/1/2024", "BBB", "Buy", "10", "$400", "($4000)"),
        row("6/1/2024", "BBB", "SPL", "30"),
      );
      const { holdings } = parseCsv(text);
      const bbb = holdings.get("BBB");
      expect(bbb?.shares).toBeCloseTo(40, 6);
      expect(bbb?.totalCost).toBeCloseTo(4000, 4);
      // avg cost falls from $400 to $100 — that's what a split should do
      expect(bbb!.totalCost / bbb!.shares).toBeCloseTo(100, 4);
    });

    it("REC: received shares add to count without adding cost", () => {
      const text = csv(
        row("1/1/2024", "CCC", "Buy", "10", "$50", "($500)"),
        row("2/1/2024", "CCC", "REC", "0.0135"),
      );
      const { holdings } = parseCsv(text);
      const ccc = holdings.get("CCC");
      expect(ccc?.shares).toBeCloseTo(10.0135, 6);
      expect(ccc?.totalCost).toBeCloseTo(500, 4);
    });

    it("MRGS: merger sent closes the position", () => {
      const text = csv(
        row("1/1/2024", "ELEV", "Buy", "100", "$5", "($500)"),
        row("7/24/2025", "ELEV", "MRGS", "100S"),
      );
      const { holdings } = parseCsv(text);
      const elev = holdings.get("ELEV");
      expect(elev?.shares).toBe(0);
      expect(elev?.totalCost).toBe(0);
    });

    it("MRGC: merger cash received is ignored for share tracking", () => {
      // MRGS closes the position; MRGC is just the cash side
      const text = csv(
        row("1/1/2024", "ELEV", "Buy", "100", "$5", "($500)"),
        row("7/24/2025", "ELEV", "MRGS", "100S"),
        row("7/24/2025", "ELEV", "MRGC", "", "", "$36.00"),
      );
      const { holdings } = parseCsv(text);
      const elev = holdings.get("ELEV");
      expect(elev?.shares).toBe(0);
      expect(elev?.totalCost).toBe(0);
    });

    it("LIQ: cash liquidation closes the position", () => {
      const text = csv(
        row("1/1/2024", "DDD", "Buy", "3575", "$0.50", "($1787.50)"),
        row("9/24/2025", "DDD", "LIQ", "", "", "$92.92"),
      );
      const { holdings } = parseCsv(text);
      const ddd = holdings.get("DDD");
      expect(ddd?.shares).toBe(0);
      expect(ddd?.totalCost).toBe(0);
    });

    it("SPR: paired reverse-split rows net shares correctly, cost basis preserved", () => {
      // Buy 10 shares @ $100, then 1:10 reverse split via SPR pair
      // (10 outgoing, 1 incoming → 1 share with same $1000 cost basis)
      const text = csv(
        row("1/1/2024", "EEE", "Buy", "10", "$100", "($1000)"),
        row("3/19/2026", "EEE", "SPR", "10S"),
        row("3/19/2026", "EEE", "SPR", "1"),
      );
      const { holdings } = parseCsv(text);
      const eee = holdings.get("EEE");
      expect(eee?.shares).toBeCloseTo(1, 6);
      expect(eee?.totalCost).toBeCloseTo(1000, 4);
    });
  });

  describe("Sell cost-basis math", () => {
    it("realizes proportional cost on partial sells", () => {
      // Buy 10 @ $100 ($1000 basis), sell 4 @ any price → 6 shares @ $600 basis
      const text = csv(
        row("1/1/2024", "FFF", "Buy", "10", "$100", "($1000)"),
        row("2/1/2024", "FFF", "Sell", "4", "$150", "$600"),
      );
      const { holdings } = parseCsv(text);
      const fff = holdings.get("FFF");
      expect(fff?.shares).toBeCloseTo(6, 6);
      expect(fff?.totalCost).toBeCloseTo(600, 4);
    });

    it("clamps near-zero shares to exactly zero (no epsilon residual)", () => {
      // Three buys totaling 1 share, then one sell of exactly 1
      const text = csv(
        row("1/1/2024", "GGG", "Buy", "0.333333", "$100", "($33.33)"),
        row("1/2/2024", "GGG", "Buy", "0.333333", "$100", "($33.33)"),
        row("1/3/2024", "GGG", "Buy", "0.333334", "$100", "($33.34)"),
        row("2/1/2024", "GGG", "Sell", "1", "$150", "$150"),
      );
      const { holdings } = parseCsv(text);
      const ggg = holdings.get("GGG");
      expect(ggg?.shares).toBe(0);
      expect(ggg?.totalCost).toBe(0);
    });
  });

  describe("graceful skips", () => {
    it("skips rows with unparseable dates with a clear error message", () => {
      const text = csv(
        row("not-a-date", "HHH", "Buy", "10", "$100", "($1000)"),
        row("1/1/2024", "HHH", "Buy", "5", "$50", "($250)"),
      );
      const { holdings, errors } = parseCsv(text);
      const hhh = holdings.get("HHH");
      expect(hhh?.shares).toBeCloseTo(5, 6);
      expect(hhh?.totalCost).toBeCloseTo(250, 4);
      expect(errors.some((e) => e.includes("HHH") && e.includes("unparseable"))).toBe(true);
    });

    it("ignores cash-only trans codes (CDIV, INT, SLIP, etc.)", () => {
      const text = csv(
        row("1/1/2024", "III", "Buy", "10", "$100", "($1000)"),
        row("2/1/2024", "III", "CDIV", "", "", "$25"),
        row("3/1/2024", "III", "SLIP", "", "", "$1.50"),
      );
      const { holdings, errors } = parseCsv(text);
      const iii = holdings.get("III");
      expect(iii?.shares).toBeCloseTo(10, 6);
      expect(iii?.totalCost).toBeCloseTo(1000, 4);
      expect(errors).toEqual([]);
    });
  });

  describe("positions snapshot format (unaffected by fix)", () => {
    it("still parses Robinhood positions CSV with Average Cost column", () => {
      const text = [
        `"Instrument","Quantity","Average Cost"`,
        `"AAPL","50","$142.80"`,
        `"MSFT","30","$280.50"`,
      ].join("\n");
      const { holdings } = parseCsv(text);
      expect(holdings.get("AAPL")?.shares).toBe(50);
      expect(holdings.get("AAPL")?.totalCost).toBeCloseTo(50 * 142.8, 4);
      expect(holdings.get("MSFT")?.shares).toBe(30);
    });
  });
});
