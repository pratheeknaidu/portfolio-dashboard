"use client";
import { rampColor, rgbString, RAMP_NORMAL, RAMP_CVD } from "@/lib/design/ramp";

interface Props {
  domain: number;
  cvd: boolean;
}

export function TreemapLegend({ domain, cvd }: Props) {
  const stops = cvd ? RAMP_CVD : RAMP_NORMAL;
  const swatches = Array.from({ length: 21 }, (_, i) =>
    rgbString(rampColor(-1 + i / 10, stops)),
  );

  return (
    <div className="mt-4 pt-3.5 border-t border-rd-border flex items-center gap-3 flex-wrap">
      <span className="font-mono text-[10px] text-rd-dim tabular-nums">−{domain}%</span>
      <div className="flex h-3 w-[300px] max-w-full overflow-hidden rounded-[2px]">
        {swatches.map((c, i) => (
          <div key={i} data-testid="legend-stop" className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <span className="font-mono text-[10px] text-rd-dim tabular-nums">+{domain}%</span>

      <span className="ml-2 flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[2px]" style={{ background: "var(--rd-flat-tile)" }} />
        <span className="font-mono text-[10px] text-rd-dim">flat / no quote</span>
      </span>

      <span className="font-mono text-[10px] text-rd-faint">
        Lightness carries magnitude, so the map still reads in greyscale.
      </span>
    </div>
  );
}
