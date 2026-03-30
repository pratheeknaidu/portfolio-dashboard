"use client";
import { ResponsiveTreeMap } from "@nivo/treemap";
import type { PortfolioItem } from "@/types";

function getColor(changePercent: number): string {
  if (changePercent > 3) return "#26a641";
  if (changePercent > 1) return "#3fb950";
  if (changePercent > 0) return "#2ea043";
  if (changePercent > -1) return "#1f6feb";
  if (changePercent > -3) return "#da3633";
  return "#f85149";
}

interface Props {
  items: PortfolioItem[];
  onHover: (item: PortfolioItem | null) => void;
}

export function Treemap({ items, onHover }: Props) {
  const data = {
    id: "portfolio",
    children: items.map((item) => ({
      id: item.ticker,
      value: item.marketValue,
      changePercent: item.quote.changePercent,
      color: getColor(item.quote.changePercent),
      item,
    })),
  };

  return (
    <div className="w-full h-full">
      <ResponsiveTreeMap
        data={data}
        identity="id"
        value="value"
        tile="squarify"
        innerPadding={2}
        outerPadding={4}
        colors={(node) => node.data.color}
        borderWidth={0}
        label={(node) => `${node.id}\n${node.data.changePercent >= 0 ? "+" : ""}${node.data.changePercent.toFixed(1)}%`}
        labelSkipSize={40}
        labelTextColor="#ffffff"
        onMouseEnter={(node) => onHover(node.data.item)}
        onMouseLeave={() => onHover(null)}
      />
    </div>
  );
}
