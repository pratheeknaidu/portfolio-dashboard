"use client";
import type { SizingMode } from "@/types";

const modes: { value: SizingMode; label: string }[] = [
  { value: "equity", label: "Equity" },
  { value: "profit", label: "Profit" },
];

interface Props {
  selected: SizingMode;
  onChange: (mode: SizingMode) => void;
}

export function SizingToggle({ selected, onChange }: Props) {
  return (
    <div className="flex gap-1 bg-surface-card rounded-lg p-1">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => onChange(m.value)}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            selected === m.value
              ? "bg-accent text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
