"use client";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
} from "recharts";

const COLORS = ["#58a6ff", "#3fb950", "#d2a8ff", "#f0883e", "#f85149", "#8b949e"];

interface SectorChartProps {
  sectors: Record<string, number>;
}

export function SectorChart({ sectors }: SectorChartProps) {
  const total = Object.values(sectors).reduce((sum, v) => sum + v, 0);

  const data = Object.entries(sectors).map(([name, value]) => ({
    name,
    value,
    percentage: total > 0 ? ((value / total) * 100).toFixed(1) : "0.0",
  }));

  return (
    <div className="w-full">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) =>
                [`$${value.toLocaleString()}`, "Value"]
              }
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-4 space-y-2">
        {data.map((entry, index) => (
          <li key={entry.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-gray-300">{entry.name}</span>
            </div>
            <span className="text-gray-400">{entry.percentage}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
