"use client";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import type { PortfolioItem } from "@/types";

const SLICE_COLORS = [
  "oklch(0.72 0.17 155)",
  "oklch(0.78 0.13 85)",
  "oklch(0.60 0.13 162)",
  "oklch(0.65 0.15 200)",
  "oklch(0.70 0.16 50)",
  "oklch(0.55 0.13 280)",
];

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

interface Props {
  items: PortfolioItem[];
}

export function AllocationCard({ items }: Props) {
  const sectorMap: Record<string, number> = {};
  for (const item of items) {
    const sector = item.sector || "Other";
    sectorMap[sector] = (sectorMap[sector] ?? 0) + item.marketValue;
  }
  const total = Object.values(sectorMap).reduce((sum, v) => sum + v, 0);
  const data = Object.entries(sectorMap)
    .map(([name, value]) => ({
      name,
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="bento-card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Allocation
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
          By sector
        </span>
      </div>

      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          No holdings yet
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-6 items-center">
          <div className="relative h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={false}
                >
                  {data.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--foreground)",
                    fontFamily: "var(--font-mono)",
                  }}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                  formatter={(value) => [fmtCurrency(Number(value)), "Value"]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Total
              </div>
              <div className="font-mono text-sm font-semibold text-foreground tabular-nums">
                {fmtCurrency(total)}
              </div>
            </div>
          </div>

          <ul className="flex flex-col gap-2 text-sm">
            {data.map((entry, index) => (
              <li
                key={entry.name}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        SLICE_COLORS[index % SLICE_COLORS.length],
                    }}
                  />
                  <span className="text-foreground truncate">{entry.name}</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {entry.pct.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
