"use client";
import type { TimeRange } from "@/types";

const ranges: TimeRange[] = ["1D", "1W", "1M", "YTD"];

interface Props {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function TimeRangeToggle({ selected, onChange }: Props) {
  return (
    <div className="flex gap-1 bg-surface-card rounded-lg p-1">
      {ranges.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            selected === r
              ? "bg-accent text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
