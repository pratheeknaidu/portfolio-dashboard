"use client";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { PortfolioItem } from "@/types";
import { useDetailSelection } from "@/lib/use-detail-selection";
import { DetailPanel } from "@/components/ui/DetailPanel";
import { SERIES_COLORS, MUTED_SERIES_COLOR } from "@/lib/chart-palette";

const TOP_N = 12;

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

interface EquityAllocationChartProps {
  items: PortfolioItem[];
}

export function EquityAllocationChart({ items }: EquityAllocationChartProps) {
  const total = items.reduce((sum, i) => sum + i.marketValue, 0);

  const sorted = [...items]
    .filter((i) => i.marketValue > 0)
    .sort((a, b) => b.marketValue - a.marketValue);

  const top: { name: string; value: number; ticker: string | null }[] = sorted
    .slice(0, TOP_N)
    .map((i) => ({ name: i.ticker, value: i.marketValue, ticker: i.ticker }));
  const rest = sorted.slice(TOP_N);
  if (rest.length > 0) {
    top.push({
      name: `Other (${rest.length})`,
      value: rest.reduce((sum, i) => sum + i.marketValue, 0),
      ticker: null,
    });
  }

  const data = top
    .map((entry, index) => ({
      ...entry,
      percentage: total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0",
      color: entry.ticker === null ? MUTED_SERIES_COLOR : SERIES_COLORS[index % SERIES_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  const byTicker = new Map(items.map((i) => [i.ticker, i]));
  const { selected, rect, select } = useDetailSelection<PortfolioItem>();

  const handleSelect = (ticker: string | null, e: { clientX: number; clientY: number }) => {
    if (!ticker) return; // "Other" slice has no single holding
    const item = byTicker.get(ticker);
    if (!item) return;
    select(item, { top: e.clientY, left: e.clientX, width: 0, height: 0 });
  };

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No holdings to display.</p>;
  }

  const selectedPct =
    selected && total > 0 ? ((selected.marketValue / total) * 100).toFixed(1) : "0.0";

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
              onClick={(d, _i, e) => {
                const t = (d as { ticker?: string | null; payload?: { ticker?: string | null } });
                handleSelect(t.ticker ?? t.payload?.ticker ?? null, e);
              }}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  className={entry.ticker ? "cursor-pointer focus:outline-none" : "focus:outline-none"}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Total Equity
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {fmt(total)}
          </span>
          <span className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {sorted.length} holdings
          </span>
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
        {data.map((entry) => (
          <li key={entry.name}>
            <button
              type="button"
              disabled={!entry.ticker}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(entry.ticker, e);
              }}
              className={`group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                entry.ticker ? "cursor-pointer hover:bg-muted/40" : "cursor-default"
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/20"
                style={{ backgroundColor: entry.color }}
              />
              <span className="truncate font-medium text-foreground/90 group-hover:text-foreground">
                {entry.name}
              </span>
              <span className="ml-auto flex items-baseline gap-2 font-mono">
                <span className="text-foreground">{entry.percentage}%</span>
                <span className="text-xs text-muted-foreground">{fmt(entry.value)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <DetailPanel rect={rect} onClose={() => select(selected, rect!)}>
          <div className="text-sm">
            <div className="font-display font-semibold text-foreground">{selected.companyName}</div>
            <div className="mb-2 font-mono text-xs text-muted-foreground">{selected.ticker}</div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">% of equity</span>
              <span className="font-mono text-foreground">{selectedPct}%</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Market value</span>
              <span className="font-mono text-foreground">{fmt(selected.marketValue)}</span>
            </div>
          </div>
        </DetailPanel>
      )}
    </div>
  );
}
