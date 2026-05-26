"use client";
import { useEffect, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, Tooltip, YAxis } from "recharts";
import { useAuth } from "@/lib/auth-context";
import type { PortfolioItem, Snapshot } from "@/types";

const POSITIVE_OKLCH = "oklch(0.72 0.17 155)";

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtCurrencySigned(n: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  return n >= 0 ? `+${formatted}` : `−${formatted}`;
}

interface Props {
  items: PortfolioItem[];
}

export function PortfolioHeroCard({ items }: Props) {
  const { getIdToken } = useAuth();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch("/api/snapshot", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data: Snapshot[] = await res.json();
      if (!cancelled) {
        setSnapshots(
          [...data].sort((a, b) => a.date.localeCompare(b.date)).slice(-30),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  const totalValue = items.reduce((sum, i) => sum + i.marketValue, 0);
  const todayChange = items.reduce(
    (sum, i) => sum + i.quote.change * i.shares,
    0,
  );
  const baseline = totalValue - todayChange;
  const todayChangePct = baseline !== 0 ? (todayChange / baseline) * 100 : 0;
  const positive = todayChange >= 0;

  const chartData =
    snapshots.length >= 2
      ? snapshots.map((s) => ({ date: s.date, value: s.totalValue }))
      : Array.from({ length: 12 }, (_, i) => ({
          date: String(i),
          value: totalValue || 1,
        }));

  return (
    <div className="bento-card p-5 md:p-8 h-full flex flex-col">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">
            Portfolio Value
          </div>
          <div className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold text-foreground tabular-nums num-fade">
            {fmtCurrency(totalValue)}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span
              className={`delta-pill ${positive ? "delta-pill-positive" : "delta-pill-negative"}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-3 w-3"
                style={{ transform: positive ? "none" : "scaleY(-1)" }}
              >
                <path
                  d="M7 17L17 7M17 7H8M17 7V16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {fmtCurrencySigned(todayChange)} ({positive ? "+" : ""}
              {todayChangePct.toFixed(2)}%)
            </span>
            <span className="text-xs text-muted-foreground">today</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[140px] -mx-2 -mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={POSITIVE_OKLCH} stopOpacity={0.5} />
                <stop offset="100%" stopColor={POSITIVE_OKLCH} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
                color: "var(--foreground)",
                fontFamily: "var(--font-mono)",
              }}
              labelStyle={{ color: "var(--muted-foreground)", fontSize: 11 }}
              formatter={(value) => [fmtCurrency(Number(value)), "Value"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={POSITIVE_OKLCH}
              strokeWidth={2.5}
              fill="url(#heroFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
