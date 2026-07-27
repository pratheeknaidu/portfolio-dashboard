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
});
