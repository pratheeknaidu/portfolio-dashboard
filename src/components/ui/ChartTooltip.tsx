"use client";

interface TooltipPayload {
  name: string;
  value: number;
  percentage?: string;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { payload: TooltipPayload }[];
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;

  return (
    <div className="bento-card px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        {p.color && (
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: p.color }}
          />
        )}
        <span className="font-display font-medium text-foreground">{p.name}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-6">
        <span className="font-mono text-foreground">{fmt(p.value)}</span>
        {p.percentage !== undefined && (
          <span className="font-mono text-xs text-muted-foreground">{p.percentage}%</span>
        )}
      </div>
    </div>
  );
}
