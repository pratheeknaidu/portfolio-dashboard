import { tooltipPosition } from "@/lib/design/tooltip-position";

const card = { top: 0, left: 0, width: 1000, height: 500 };

describe("tooltipPosition", () => {
  it("anchors below a tile in the top 45% of the card", () => {
    const p = tooltipPosition({ top: 40, left: 400, width: 100, height: 80 }, card);
    expect(p.placement).toBe("below");
  });

  it("anchors above a tile lower down, so it does not fall off the bottom", () => {
    const p = tooltipPosition({ top: 400, left: 400, width: 100, height: 80 }, card);
    expect(p.placement).toBe("above");
  });

  it("clamps the horizontal centre to 9-91% so it never clips at an edge", () => {
    const left = tooltipPosition({ top: 40, left: 0, width: 40, height: 40 }, card);
    expect(left.centerPct).toBeGreaterThanOrEqual(9);

    const right = tooltipPosition({ top: 40, left: 980, width: 20, height: 40 }, card);
    expect(right.centerPct).toBeLessThanOrEqual(91);
  });

  it("centres on the tile when there is room on both sides", () => {
    const p = tooltipPosition({ top: 40, left: 450, width: 100, height: 80 }, card);
    expect(p.centerPct).toBeCloseTo(50, 1);
  });

  it("handles a zero-height card without dividing by zero", () => {
    const p = tooltipPosition({ top: 0, left: 0, width: 10, height: 10 }, { ...card, height: 0 });
    expect(Number.isFinite(p.centerPct)).toBe(true);
  });
});
