import { RAMP_NORMAL, RAMP_CVD, rampColor, rgbString } from "@/lib/design/ramp";
import { relativeLuminance } from "@/lib/design/luminance";

describe("rampColor", () => {
  it("returns the exact stop colour at a stop position", () => {
    expect(rampColor(0, RAMP_NORMAL)).toEqual([92, 98, 106]);
    expect(rampColor(-1, RAMP_NORMAL)).toEqual([70, 14, 26]);
    expect(rampColor(1, RAMP_NORMAL)).toEqual([168, 240, 198]);
  });

  it("interpolates linearly between two stops", () => {
    // Midway between t=0 [92,98,106] and t=0.10 [78,110,94]
    expect(rampColor(0.05, RAMP_NORMAL)).toEqual([85, 104, 100]);
  });

  it("clamps beyond the domain instead of extrapolating", () => {
    expect(rampColor(4, RAMP_NORMAL)).toEqual(rampColor(1, RAMP_NORMAL));
    expect(rampColor(-9, RAMP_NORMAL)).toEqual(rampColor(-1, RAMP_NORMAL));
  });

  it("treats flat as neutral grey, never a pale green", () => {
    const [r, g, b] = rampColor(0, RAMP_NORMAL);
    expect(g).toBeLessThan(b); // grey-blue, not green-leaning
    expect(Math.abs(r - g)).toBeLessThan(10);
  });

  it("formats as a CSS rgb string", () => {
    expect(rgbString([1, 2, 3])).toBe("rgb(1,2,3)");
  });
});

/** CIE L*, the perceptually uniform lightness axis. 1.0 is roughly one JND. */
function lstar(y: number): number {
  return y > 0.008856 ? 116 * Math.pow(y, 1 / 3) - 16 : 903.3 * y;
}

describe.each([
  ["RAMP_NORMAL", RAMP_NORMAL],
  ["RAMP_CVD", RAMP_CVD],
])("%s luminance monotonicity", (_name, ramp) => {
  it("rises monotonically from loss to gain so magnitude survives greyscale", () => {
    const samples = Array.from({ length: 41 }, (_, i) => -1 + i * 0.05);
    const lums = samples.map((t) => relativeLuminance(rampColor(t, ramp)));
    for (let i = 1; i < lums.length; i++) {
      expect(lums[i]).toBeGreaterThan(lums[i - 1]);
    }
  });

  it("has no perceptible dip between stops, where a coarse grid cannot look", () => {
    // rampColor interpolates in sRGB, but luminance sums GAMMA-DECODED
    // channels, and that decode is convex — so lightness sags below the chord
    // in mid-segment even when both stops are correctly ordered. A strict
    // comparison at 0.005 therefore fails on physics, not on a design error.
    // What must hold is that no sag is VISIBLE, so the bar is one JND of L*.
    let runningMax = -Infinity;
    let worstDrawdown = 0;
    let worstAt = 0;
    for (let i = 0; i <= 400; i++) {
      const t = -1 + i * 0.005;
      const l = lstar(relativeLuminance(rampColor(t, ramp)));
      runningMax = Math.max(runningMax, l);
      if (runningMax - l > worstDrawdown) {
        worstDrawdown = runningMax - l;
        worstAt = t;
      }
    }
    const verdict =
      worstDrawdown < 1
        ? "no perceptible dip"
        : `dip of ${worstDrawdown.toFixed(2)} L* at t=${worstAt.toFixed(3)}`;
    expect(verdict).toBe("no perceptible dip");
  });
});
