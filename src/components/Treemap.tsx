"use client";
import { ResponsiveTreeMapHtml } from "@nivo/treemap";
import type { PortfolioItem, SizingMode } from "@/types";
import type { TileRect } from "./TreemapTooltip";

function getColor(changePercent: number): string {
  const MAX_MAGNITUDE = 3;
  const t = Math.min(Math.abs(changePercent) / MAX_MAGNITUDE, 1);
  // Lightness ramps darker as magnitude grows; chroma grows for more saturation
  // at the extremes. Hues mirror the --positive (155) and --negative (25) tokens.
  const lightness = 0.62 - t * 0.22;
  const chroma = 0.08 + t * 0.13;
  const hue = changePercent >= 0 ? 155 : 25;
  return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue})`;
}

function sizeOf(item: PortfolioItem, sizing: SizingMode): number {
  return sizing === "profit" ? Math.abs(item.totalPL) : item.marketValue;
}

/**
 * Individual treemap tile. Exported separately so the keyboard + a11y
 * behavior is unit-testable without going through Nivo's render path.
 */
export interface TreemapTileProps {
  ticker: string;
  changePercent: number;
  width: number;
  height: number;
  x: number;
  y: number;
  color: string;
  item: PortfolioItem;
  onSelect: (item: PortfolioItem, rect: TileRect) => void;
}

export function TreemapTile({
  ticker,
  changePercent,
  width,
  height,
  x,
  y,
  color,
  item,
  onSelect,
}: TreemapTileProps) {
  const raw = Number(changePercent ?? 0);
  const pct = Math.abs(raw).toFixed(1);
  const sign = raw > 0 ? "+" : raw < 0 ? "−" : "";
  // Three-tier label rendering. On mobile / narrow viewports, packed
  // treemaps produce many small tiles — showing just the ticker (no
  // percent) at the medium size is more readable than hiding both,
  // which was the old behavior at anything under 50×30px.
  const showBoth = width >= 50 && height >= 30;
  const showTickerOnly = !showBoth && width >= 32 && height >= 18;
  const select = (target: HTMLElement) => {
    const r = target.getBoundingClientRect();
    onSelect(item, { top: r.top, left: r.left, width: r.width, height: r.height });
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${ticker}, ${raw >= 0 ? "up" : "down"} ${pct}%. Press Enter for details.`}
      data-ticker={ticker}
      style={{
        position: "absolute",
        top: y,
        left: x,
        width,
        height,
        background: color,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        borderRadius: 10,
        boxShadow: "inset 0 1px 0 0 oklch(1 0 0 / 0.08)",
        transition: "transform 150ms ease, filter 150ms ease",
        outline: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.filter = "brightness(1.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = "brightness(1)";
      }}
      onFocus={(e) => {
        // Visible focus ring so keyboard users see what's targeted
        e.currentTarget.style.boxShadow =
          "inset 0 1px 0 0 oklch(1 0 0 / 0.08), 0 0 0 2px oklch(0.85 0.15 90 / 0.9)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = "inset 0 1px 0 0 oklch(1 0 0 / 0.08)";
      }}
      onClick={(e) => {
        e.stopPropagation();
        select(e.currentTarget);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          select(e.currentTarget);
        }
      }}
    >
      {showBoth && (
        <>
          <span
            style={{
              color: "oklch(0.98 0.01 90)",
              fontFamily: "var(--font-display), system-ui, sans-serif",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              fontSize: Math.min(15, width / 6),
              lineHeight: 1.15,
              whiteSpace: "nowrap",
            }}
          >
            {ticker}
          </span>
          <span
            style={{
              color: "oklch(1 0 0 / 0.78)",
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: Math.min(11, width / 8.5),
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              marginTop: 2,
            }}
            data-testid="tile-percent"
          >
            {sign}{pct}%
          </span>
        </>
      )}
      {showTickerOnly && (
        <span
          style={{
            color: "oklch(0.98 0.01 90)",
            fontFamily: "var(--font-display), system-ui, sans-serif",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            fontSize: Math.min(11, width / 4),
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {ticker}
        </span>
      )}
    </div>
  );
}

interface Props {
  items: PortfolioItem[];
  sizing: SizingMode;
  onSelect: (item: PortfolioItem | null, rect: TileRect | null) => void;
}

export function Treemap({ items, sizing, onSelect }: Props) {
  const data = {
    id: "portfolio",
    children: [...items]
      .sort((a, b) => sizeOf(b, sizing) - sizeOf(a, sizing))
      .map((item) => ({
        id: item.ticker,
        value: sizeOf(item, sizing),
        changePercent: item.quote.changePercent,
        color: getColor(item.quote.changePercent),
        item,
      })),
  };

  return (
    <div className="w-full h-full">
      <ResponsiveTreeMapHtml
        data={data}
        identity="id"
        value="value"
        tile="squarify"
        innerPadding={2}
        outerPadding={4}
        colors={(node) => (node.data as Record<string, string>).color}
        borderWidth={0}
        leavesOnly={true}
        label={() => ""}
        labelSkipSize={0}
        nodeComponent={({ node }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const d = node.data as any;
          return (
            <TreemapTile
              ticker={String(node.id)}
              changePercent={Number(d.changePercent ?? 0)}
              width={node.width}
              height={node.height}
              x={node.x}
              y={node.y}
              color={node.color}
              item={d.item}
              onSelect={onSelect}
            />
          );
        }}
      />
    </div>
  );
}
