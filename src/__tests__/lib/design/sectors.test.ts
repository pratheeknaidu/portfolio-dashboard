import { SECTOR_COLORS, OTHER_COLOR, sectorColor } from "@/lib/design/sectors";

describe("sectorColor", () => {
  it("returns the palette entry for a known sector", () => {
    expect(sectorColor("Technology")).toBe("#5b8dd6");
    expect(sectorColor("Healthcare")).toBe("#3fa9a0");
  });

  it("falls back to the Other colour for unknown or missing sectors", () => {
    expect(sectorColor("Widgets")).toBe(OTHER_COLOR);
    expect(sectorColor(undefined)).toBe(OTHER_COLOR);
    expect(sectorColor("")).toBe(OTHER_COLOR);
  });
});

describe("SECTOR_COLORS", () => {
  it("covers the ten sectors Yahoo returns", () => {
    expect(Object.keys(SECTOR_COLORS)).toHaveLength(10);
  });

  // The palette must never collide with P&L semantics: a green sector wedge
  // beside a green gain figure makes both meaningless.
  it("contains no green and no red hue", () => {
    for (const hex of Object.values(SECTOR_COLORS)) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const isGreen = g > r + 30 && g > b + 30;
      const isRed = r > g + 40 && r > b + 40;
      expect({ hex, isGreen, isRed }).toEqual({ hex, isGreen: false, isRed: false });
    }
  });
});
