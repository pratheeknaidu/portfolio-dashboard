import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  delta?: {
    text: string;
    positive: boolean;
  };
  icon?: ReactNode;
  className?: string;
}

export function MetricCard({ label, value, delta, icon, className = "" }: MetricCardProps) {
  return (
    <div className={`bento-card p-6 flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        {icon && (
          <span className="text-muted-foreground/70">{icon}</span>
        )}
      </div>
      <div className="font-display text-3xl md:text-[2rem] font-semibold text-foreground tabular-nums leading-none num-fade">
        {value}
      </div>
      {delta && (
        <span
          className={`delta-pill self-start ${delta.positive ? "delta-pill-positive" : "delta-pill-negative"}`}
        >
          {delta.text}
        </span>
      )}
    </div>
  );
}
