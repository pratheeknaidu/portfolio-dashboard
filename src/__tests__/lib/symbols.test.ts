/**
 * @jest-environment node
 */
import { candidateSymbols } from "@/lib/symbols";

describe("candidateSymbols", () => {
  it("returns the bare symbol first, then the -USD crypto pair, for plain alphanumerics", () => {
    // Equity-first: a real equity named ETC must win over Ethereum Classic.
    expect(candidateSymbols("ETC")).toEqual(["ETC", "ETC-USD"]);
  });

  it("does not append -USD to symbols that already carry a separator", () => {
    expect(candidateSymbols("BRK.B")).toEqual(["BRK.B"]);
    expect(candidateSymbols("BRK-B")).toEqual(["BRK-B"]);
  });

  it("does not append -USD to index symbols", () => {
    expect(candidateSymbols("^VIX")).toEqual(["^VIX"]);
  });

  it("does not append a second -USD pair to a symbol already suffixed with -USD", () => {
    expect(candidateSymbols("ETC-USD")).toEqual(["ETC-USD"]);
  });
});
