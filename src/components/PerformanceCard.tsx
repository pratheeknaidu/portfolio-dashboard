"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { axisMoney } from "@/lib/design/format";
import type { Snapshot } from "@/types";

export const MIN_POINTS = 5;

/**
 * Y-axis bounds from the data's own range with a 5% margin — NOT anchored at
 * zero. A portfolio chart anchored at zero flattens every real day-to-day move
 * into a straight line near the top; the whole point of this card is to make
 * that movement legible. The `|| ...` guards a flat series from a zero-height
 * band.
 */
export function yDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const margin = (max - min || max * 0.01 || 1) * 0.05;
  return [min - margin, max + margin];
}

export function PerformanceCard({ snapshots }: { snapshots: Snapshot[] }) {
  const values = snapshots.map((s) => s.totalValue);

  return (
    <section
      aria-label="Performance"
      className="rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6"
    >
      <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-rd-label">
        Performance over time
      </h2>

      {snapshots.length < MIN_POINTS ? (
        <p className="mt-6 text-sm text-rd-faint">
          Not enough history yet — a few more days of snapshots and your portfolio&apos;s
          trajectory appears here.
        </p>
      ) : (
        <div className="mt-4 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={snapshots} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--rd-gridline)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--rd-text-faint)", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "var(--rd-border)" }}
              />
              <YAxis
                domain={yDomain(values)}
                tickFormatter={axisMoney}
                tick={{ fill: "var(--rd-text-faint)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Line
                type="monotone"
                dataKey="totalValue"
                stroke="var(--rd-gain)"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
