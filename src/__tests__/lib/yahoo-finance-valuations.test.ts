/**
 * @jest-environment node
 */
import { parseFairValueDiscount } from "@/lib/yahoo-finance-valuations";

describe("parseFairValueDiscount", () => {
  it("parses signed percent strings", () => {
    expect(parseFairValueDiscount("-17%")).toBe(-17);
    expect(parseFairValueDiscount("+47%")).toBe(47);
    expect(parseFairValueDiscount("16%")).toBe(16);
    expect(parseFairValueDiscount("0%")).toBe(0);
  });

  it("handles whitespace and decimal values", () => {
    expect(parseFairValueDiscount(" -7.5% ")).toBe(-7.5);
  });

  it("returns undefined for empty or malformed input", () => {
    expect(parseFairValueDiscount("")).toBeUndefined();
    expect(parseFairValueDiscount(undefined)).toBeUndefined();
    expect(parseFairValueDiscount("not a number")).toBeUndefined();
    expect(parseFairValueDiscount("%")).toBeUndefined();
  });
});
