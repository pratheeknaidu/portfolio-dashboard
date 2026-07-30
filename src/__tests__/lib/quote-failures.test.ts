import { classifyFailure } from "@/lib/quote-failures";

describe("classifyFailure", () => {
  it("reads a delisted or misspelled symbol as unlisted", () => {
    expect(classifyFailure(new Error("Quote not found for symbol: ZZZZ"))).toBe("unlisted");
    expect(classifyFailure(new Error("No data found, symbol may be delisted"))).toBe("unlisted");
  });

  it("reads a slow or aborted request as a timeout", () => {
    expect(classifyFailure(new Error("ETIMEDOUT"))).toBe("timeout");
    expect(classifyFailure(new Error("The operation was aborted"))).toBe("timeout");
    expect(classifyFailure(new Error("network socket disconnected"))).toBe("timeout");
  });

  // A symbol that resolves but carries no price is a real, distinct case:
  // halted stocks and some ADRs do this, and calling them "unlisted" would
  // tell the user to remove a holding they should keep.
  it("reads a resolved symbol with no usable price as no_price", () => {
    expect(classifyFailure(new Error("regularMarketPrice missing"))).toBe("no_price");
  });

  it("falls back to no_price for anything unrecognised", () => {
    expect(classifyFailure(new Error("kaboom"))).toBe("no_price");
    expect(classifyFailure("a bare string")).toBe("no_price");
    expect(classifyFailure(undefined)).toBe("no_price");
  });

  it("matches case-insensitively, since the upstream wording varies", () => {
    expect(classifyFailure(new Error("SYMBOL MAY BE DELISTED"))).toBe("unlisted");
  });
});
