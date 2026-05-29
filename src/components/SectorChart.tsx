"use client";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { SERIES_COLORS } from "@/lib/chart-palette";

interface SectorChartProps {
  sectors: Record<string, number>;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function SectorChart({ sectors }: SectorChartProps) {
  const total = Object.values(sectors).reduce((sum, v) => sum + v, 0);

  const data = Object.entries(sectors)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .map((entry, index) => ({
      ...entry,
      percentage: total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0",
      color: SERIES_COLORS[index % SERIES_COLORS.length],
    }));

  return (
    <div className="w-full">
      <div className="relative h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={64}
              outerRadius={94}
              paddingAngle={2}
              cornerRadius={5}
              stroke="var(--surface)"
              strokeWidth={2}
              dataKey="value"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} className="focus:outline-none" />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Sectors
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {data.length}
          </span>
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
        {data.map((entry) => (
          <li
            key={entry.name}
            className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/20"
              style={{ backgroundColor: entry.color }}
            />
            <span className="truncate font-medium text-foreground/90">{entry.name}</span>
            <span className="ml-auto flex items-baseline gap-2 font-mono">
              <span className="text-foreground">{entry.percentage}%</span>
              <span className="text-xs text-muted-foreground">{fmt(entry.value)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
