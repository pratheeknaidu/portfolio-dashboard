"use client";
import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { Snapshot } from "@/types";

type Range = "1W" | "1M" | "3M" | "6M" | "1Y" | "All";

const RANGES: Range[] = ["1W", "1M", "3M", "6M", "1Y", "All"];

function getDaysBack(range: Range): number | null {
  switch (range) {
    case "1W": return 7;
    case "1M": return 30;
    case "3M": return 90;
    case "6M": return 180;
    case "1Y": return 365;
    case "All": return null;
  }
}

interface PerformanceChartProps {
  snapshots: Snapshot[];
}

export function PerformanceChart({ snapshots }: PerformanceChartProps) {
  const [range, setRange] = useState<Range>("All");

  const filtered = (() => {
    const daysBack = getDaysBack(range);
    if (daysBack === null) return snapshots;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    return snapshots.filter((s) => s.date >= cutoffStr);
  })();

  const chartData = filtered.map((s) => ({
    date: s.date,
    value: s.totalValue,
  }));

  const hasData = chartData.length >= 2;

  return (
    <div className="w-full">
      <div className="flex gap-2 mb-4">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2 py-1 text-xs rounded ${
              range === r
                ? "bg-accent text-white"
                : "bg-surface-border text-gray-400 hover:text-gray-200"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      {hasData ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "#8b949e", fontSize: 11 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value) => [`$${Number(value).toLocaleString()}`, "Value"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#58a6ff"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center text-gray-500">
          Not enough data yet
        </div>
      )}
    </div>
  );
}
