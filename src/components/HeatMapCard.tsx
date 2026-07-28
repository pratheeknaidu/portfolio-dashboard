"use client";
import { useRef } from "react";
import { Treemap, domainFor } from "@/components/Treemap";
import { TreemapLegend } from "@/components/TreemapLegend";
import { TreemapTooltip, type TileRect } from "@/components/TreemapTooltip";
import { usePreferences } from "@/lib/preferences-context";
import type { PortfolioItem, SizingMode, TimeRange } from "@/types";

interface SegmentedProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function SegmentedGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-rd-dim shrink-0">
        {label}
      </span>
      <div
        role="group"
        aria-label={label}
        className="inline-flex gap-[3px] p-[3px] rounded-lg bg-rd-control border border-rd-border-control"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={`rd-focusable rounded-md px-3 py-1.5 text-xs font-semibold transition-none ${
                active ? "bg-rd-text text-rd-chrome" : "bg-transparent text-[#8b97a4]"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SIZE_OPTIONS: { value: SizingMode; label: string }[] = [
  { value: "equity", label: "Equity" },
  { value: "profit", label: "P&L" },
];

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = (
  ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"] as TimeRange[]
).map((r) => ({ value: r, label: r }));

interface Props {
  items: PortfolioItem[];
  sizing: SizingMode;
  range: TimeRange;
  onSizingChange: (m: SizingMode) => void;
  onRangeChange: (r: TimeRange) => void;
  onSelect: (item: PortfolioItem | null, rect: TileRect | null) => void;
  /** Currently selected tile, rendered as a tooltip inside the map body. */
  selected: PortfolioItem | null;
  selectedRect: TileRect | null;
  onDismiss: () => void;
  children?: React.ReactNode;
}

export function HeatMapCard({
  items,
  sizing,
  range,
  onSizingChange,
  onRangeChange,
  onSelect,
  selected,
  selectedRect,
  onDismiss,
  children,
}: Props) {
  const { cvd } = usePreferences();
  const domain = domainFor(items);
  const bodyRef = useRef<HTMLDivElement>(null);

  // The tooltip is positioned in the map body's coordinate space, so the card
  // owns the measurement. Read at render time rather than stored in state:
  // it is only needed while a tile is selected, and caching it would go stale
  // on resize.
  const bodyRect = selected ? bodyRef.current?.getBoundingClientRect() ?? null : null;

  const total = items.reduce((s, i) => s + i.marketValue, 0);
  const weightPct = selected && total > 0 ? (selected.marketValue / total) * 100 : 0;

  return (
    <section className="rounded-[14px] bg-rd-card border border-rd-border px-5 pt-[18px] pb-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-bold text-rd-text">Heat map</h2>
          <p className="font-mono text-[11px] text-rd-dim mt-1">
            Tile size by {sizing === "equity" ? "market value" : "absolute P&L"} · colour by{" "}
            {range} change, clamped ±{domain}%
          </p>
        </div>
        {/* COLOUR is seven segments; at 375px the two groups need ~409px and
            overflow the card, clipping 1Y and ALL out of reach. Scrolling the
            control strip keeps every range tappable without wrapping a
            segmented control mid-run, which reads as broken. */}
        <div className="flex items-center gap-[18px] overflow-x-auto lg:overflow-x-visible lg:flex-wrap -mx-1 px-1 py-0.5">
          <SegmentedGroup
            label="Size"
            options={SIZE_OPTIONS}
            value={sizing}
            onChange={onSizingChange}
          />
          <SegmentedGroup
            label="Colour"
            options={RANGE_OPTIONS}
            value={range}
            onChange={onRangeChange}
          />
        </div>
      </div>

      {children}

      <div ref={bodyRef} className="h-[456px] relative">
        <Treemap items={items} sizing={sizing} domain={domain} onSelect={onSelect} />
        <TreemapTooltip
          item={selected}
          tileRect={selectedRect}
          cardRect={bodyRect}
          weightPct={weightPct}
          onClose={onDismiss}
        />
      </div>

      <TreemapLegend domain={domain} cvd={cvd} />
    </section>
  );
}
