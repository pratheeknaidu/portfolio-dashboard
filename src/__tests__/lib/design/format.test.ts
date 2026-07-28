import { MINUS, money, signedMoney, signedPct, axisMoney } from "@/lib/design/format";

describe("money", () => {
  it("always shows two decimals with thousands separators", () => {
    expect(money(155876.26)).toBe("$155,876.26");
    expect(money(8)).toBe("$8.00");
  });

  it("puts a true minus sign before the dollar sign", () => {
    expect(money(-60.97)).toBe("−$60.97");
    expect(money(-60.97).startsWith(MINUS)).toBe(true);
  });

  it("never uses a hyphen, which does not align in tabular figures", () => {
    expect(money(-60.97)).not.toContain("-");
  });

  it("accepts a decimal-place override for axis-adjacent use", () => {
    expect(money(1234.5, 0)).toBe("$1,235");
  });
});

describe("signedMoney", () => {
  it("shows an explicit plus on gains", () => {
    expect(signedMoney(80.92)).toBe("+$80.92");
    expect(signedMoney(-60.97)).toBe("−$60.97");
  });

  it("treats zero as positive rather than emitting a bare value", () => {
    expect(signedMoney(0)).toBe("+$0.00");
  });
});

describe("signedPct", () => {
  it("always shows two decimals and a sign", () => {
    expect(signedPct(0.06)).toBe("+0.06%");
    expect(signedPct(-1.2)).toBe("−1.20%");
    expect(signedPct(0)).toBe("+0.00%");
  });
});

describe("axisMoney", () => {
  it("abbreviates thousands and millions — the only place abbreviation is allowed", () => {
    expect(axisMoney(165000)).toBe("$165k");
    expect(axisMoney(1250000)).toBe("$1.3m");
    expect(axisMoney(940)).toBe("$940");
  });

  it("keeps the true minus sign", () => {
    expect(axisMoney(-165000)).toBe("−$165k");
  });
});
