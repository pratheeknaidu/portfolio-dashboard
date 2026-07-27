import { labelTier, tileFontSize, MIN_TILE } from "@/lib/design/tiles";

describe("labelTier", () => {
  it.each([
    [200, 160, "full"],
    [92, 78, "full"],
    [91, 78, "percent"],
    [92, 77, "percent"],
    [62, 44, "percent"],
    [61, 44, "ticker"],
    [34, 24, "ticker"],
    [33, 24, "none"],
    [34, 23, "none"],
    [10, 10, "none"],
  ])("desktop %ix%i is %s", (w, h, expected) => {
    expect(labelTier(w, h, false)).toBe(expected);
  });

  it("uses a lower ticker threshold on mobile, where maps are denser", () => {
    expect(labelTier(30, 22, true)).toBe("ticker");
    expect(labelTier(30, 22, false)).toBe("none");
    expect(labelTier(29, 22, true)).toBe("none");
  });

  it("exposes the mobile ticker minimum for the aggregate-strip cutoff", () => {
    expect(MIN_TILE.mobile).toEqual({ w: 30, h: 22 });
    expect(MIN_TILE.desktop).toEqual({ w: 34, h: 24 });
  });
});

describe("tileFontSize", () => {
  it("scales with the tile's tighter dimension", () => {
    expect(tileFontSize(92, 84)).toBe(20);
  });

  it("never drops below the 11px legibility floor", () => {
    expect(tileFontSize(34, 24)).toBe(11);
    expect(tileFontSize(1, 1)).toBe(11);
  });

  it("caps at 22px so a dominant position does not shout", () => {
    expect(tileFontSize(600, 400)).toBe(22);
  });
});
