"use client";
import type { TimeRange } from "@/types";

const ranges: TimeRange[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"];

interface Props {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function TimeRangeToggle({ selected, onChange }: Props) {
  return (
    <div className="inline-flex gap-0.5 bg-surface-elevated/60 border border-border/60 rounded-full p-1">
      {ranges.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-full transition-all ${
            selected === r
              ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
