"use client";
import { ResponsiveTreeMapHtml } from "@nivo/treemap";
import type { PortfolioItem, SizingMode } from "@/types";
import type { TileRect } from "./TreemapTooltip";

function getColor(changePercent: number): string {
  const MAX_MAGNITUDE = 3;
  const t = Math.min(Math.abs(changePercent) / MAX_MAGNITUDE, 1);
  const lightness = 50 - t * 28;
  const hue = changePercent >= 0 ? 142 : 0;
  return `hsl(${hue}, 55%, ${lightness}%)`;
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
          const pct = d.changePercent?.toFixed(1) ?? "0.0";
          const sign = Number(pct) >= 0 ? "+" : "";
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
              }}
              onClick={(e) => {
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                onSelect(d.item, { top: r.top, left: r.left, width: r.width, height: r.height });
              }}
            >
              {!tooSmall && (
                <>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: Math.min(14, node.width / 6), lineHeight: 1.2, whiteSpace: "nowrap" }}>
                    {node.id}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.85)", fontSize: Math.min(11, node.width / 8), lineHeight: 1.2, whiteSpace: "nowrap" }}>
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
