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
    <div className="inline-flex gap-1 bg-surface-elevated/60 border border-border/60 rounded-full p-1">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => onChange(m.value)}
          className={`px-3.5 py-1 text-xs font-medium rounded-full transition-all ${
            selected === m.value
              ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
