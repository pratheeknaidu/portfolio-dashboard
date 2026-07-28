import { relativeLuminance, contrastRatio, foregroundFor } from "@/lib/design/luminance";
import { RAMP_NORMAL, RAMP_CVD, rampColor } from "@/lib/design/ramp";

describe("relativeLuminance", () => {
  it("returns 0 for black and 1 for white", () => {
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 5);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
  });

  it("weights green most heavily, per WCAG", () => {
    expect(relativeLuminance([0, 255, 0])).toBeGreaterThan(relativeLuminance([255, 0, 0]));
    expect(relativeLuminance([255, 0, 0])).toBeGreaterThan(relativeLuminance([0, 0, 255]));
  });
});

describe("foregroundFor", () => {
  it("picks dark ink on light tiles and white on dark tiles", () => {
    expect(foregroundFor([168, 240, 198]).fg).toBe("#000000");
    expect(foregroundFor([70, 14, 26]).fg).toBe("#ffffff");
  });

  it("derives the secondary colour from the primary at ~0.77 alpha", () => {
    expect(foregroundFor([168, 240, 198]).fg2).toBe("#000000c4");
    expect(foregroundFor([70, 14, 26]).fg2).toBe("#ffffffc4");
  });

  it("flips at the luminance where white stops clearing 4.5:1", () => {
    // White clears 4.5:1 up to L = 1.05/4.5 - 0.05. Straddle that boundary:
    // a threshold placed anywhere higher hands white ink a background it
    // cannot carry, which is exactly how the handoff's 0.30 failed.
    const justUnder = [119, 119, 119] as const; // L = 0.184475 -> dark ink
    const justOver = [118, 118, 118] as const; // L = 0.181164 -> white ink
    expect(relativeLuminance(justUnder)).toBeGreaterThan(0.1833);
    expect(relativeLuminance(justOver)).toBeLessThan(0.1833);
    expect(foregroundFor(justUnder).fg).toBe("#000000");
    expect(foregroundFor(justOver).fg).toBe("#ffffff");
    expect(contrastRatio(justUnder, "#000000")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(justOver, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
});

describe.each([
  ["RAMP_NORMAL", RAMP_NORMAL],
  ["RAMP_CVD", RAMP_CVD],
])("%s tile contrast", (_name, ramp) => {
  it("clears WCAG AA 4.5:1 at every point on the ramp", () => {
    // Sampled at 0.005, not 0.05. The coarse grid is what let the handoff
    // ship a rule that fails across a ~200-sample-wide band on each ramp.
    const failures: string[] = [];
    for (let i = 0; i <= 400; i++) {
      const t = -1 + i * 0.005;
      const bg = rampColor(t, ramp);
      const { fg } = foregroundFor(bg);
      const r = contrastRatio(bg, fg);
      if (r < 4.5) failures.push(`t=${t.toFixed(3)} rgb(${bg}) on ${fg} = ${r.toFixed(3)}`);
    }
    expect(failures).toEqual([]);
  });

  it("beats a fixed white foreground, which fails on light tiles", () => {
    const lightGain = rampColor(1, ramp);
    const white: [number, number, number] = [255, 255, 255];
    expect(contrastRatio(lightGain, white)).toBeLessThan(4.5);
    expect(contrastRatio(lightGain, foregroundFor(lightGain).fg)).toBeGreaterThanOrEqual(4.5);
  });
});
