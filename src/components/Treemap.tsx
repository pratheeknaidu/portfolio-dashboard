"use client";
import { ResponsiveTreeMapHtml } from "@nivo/treemap";
import type { PortfolioItem } from "@/types";

function getColor(changePercent: number): string {
  if (changePercent > 3) return "#26a641";
  if (changePercent > 1.5) return "#3fb950";
  if (changePercent > 0.5) return "#2ea043";
  if (changePercent > 0) return "#1a4d2e";
  if (changePercent > -0.5) return "#4d1a1a";
  if (changePercent > -1.5) return "#da3633";
  if (changePercent > -3) return "#f85149";
  return "#ff6b6b";
}

interface Props {
  items: PortfolioItem[];
  onHover: (item: PortfolioItem | null) => void;
}

export function Treemap({ items, onHover }: Props) {
  const data = {
    id: "portfolio",
    children: [...items]
      .sort((a, b) => b.marketValue - a.marketValue)
      .map((item) => ({
        id: item.ticker,
        value: item.marketValue,
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
        colors={(node) => node.data.color}
        borderWidth={0}
        leavesOnly={true}
        label={() => ""}
        labelSkipSize={0}
        nodeComponent={({ node }) => {
          const tooSmall = node.width < 50 || node.height < 30;
          const pct = node.data.changePercent?.toFixed(1) ?? "0.0";
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
              }}
              onMouseEnter={() => onHover(node.data.item)}
              onMouseLeave={() => onHover(null)}
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
