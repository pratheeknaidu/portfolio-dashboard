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
          const tooSmall = node.width < 50 || node.height < 30;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const d = node.data as any;
          const raw = Number(d.changePercent ?? 0);
          const pct = Math.abs(raw).toFixed(1);
          const sign = raw > 0 ? "+" : raw < 0 ? "−" : "";
          return (
            <div
              style={{
                position: "absolute",
                top: node.y,
                left: node.x,
                width: node.width,
                height: node.height,
                background: node.color,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                borderRadius: 10,
                boxShadow: "inset 0 1px 0 0 oklch(1 0 0 / 0.08)",
                transition: "transform 150ms ease, filter 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = "brightness(1.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = "brightness(1)";
              }}
              onClick={(e) => {
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                onSelect(d.item, { top: r.top, left: r.left, width: r.width, height: r.height });
              }}
            >
              {!tooSmall && (
                <>
                  <span
                    style={{
                      color: "oklch(0.98 0.01 90)",
                      fontFamily: "var(--font-display), system-ui, sans-serif",
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      fontSize: Math.min(15, node.width / 6),
                      lineHeight: 1.15,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {node.id}
                  </span>
                  <span
                    style={{
                      color: "oklch(1 0 0 / 0.78)",
                      fontFamily: "var(--font-mono), ui-monospace, monospace",
                      fontSize: Math.min(11, node.width / 8.5),
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                      marginTop: 2,
                    }}
                  >
                    {sign}{pct}%
                  </span>
                </>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}
