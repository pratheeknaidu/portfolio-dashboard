"use client";
import { useCallback, useRef } from "react";
import { ResponsiveTreeMapHtml } from "@nivo/treemap";
import { rampColor, rgbString, RAMP_NORMAL, RAMP_CVD, niceDomain } from "@/lib/design/ramp";
import { nextTile, type NavRect } from "@/lib/design/tile-nav";
import { usePreferences } from "@/lib/preferences-context";
import { useIsMobile } from "@/lib/use-is-mobile";
import { foregroundFor } from "@/lib/design/luminance";
import { labelTier, tileFontSize } from "@/lib/design/tiles";
import { money, signedMoney } from "@/lib/design/format";
import type { PortfolioItem, SizingMode } from "@/types";
import type { TileRect } from "./TreemapTooltip";

/**
 * Individual treemap tile. Exported separately so the keyboard + a11y
 * behavior is unit-testable without going through Nivo's render path.
 */
export interface TreemapTileProps {
  item: PortfolioItem;
  changePercent: number;
  /** The clamp domain in percent, from niceDomain(). */
  domain: number;
  cvd: boolean;
  isMobile: boolean;
  width: number;
  height: number;
  x: number;
  y: number;
  /** When set, the sub-label shows signed P&L instead of market value. */
  showPL?: boolean;
  onSelect: (item: PortfolioItem, rect: TileRect) => void;
}

export function TreemapTile({
  item,
  changePercent,
  domain,
  cvd,
  isMobile,
  width,
  height,
  x,
  y,
  showPL = false,
  onSelect,
}: TreemapTileProps) {
  const raw = Number.isFinite(changePercent) ? changePercent : 0;
  const bg = rampColor(raw / domain, cvd ? RAMP_CVD : RAMP_NORMAL);
  const { fg, fg2 } = foregroundFor(bg);
  const tier = labelTier(width, height, isMobile);
  const size = tileFontSize(width, height);

  // Sign is carried by a glyph as well as by colour, so it survives greyscale
  // and every form of colour vision deficiency.
  const glyph = raw > 0 ? "\u25b2" : raw < 0 ? "\u25bc" : "\u25c6";
  const direction = raw > 0 ? "up" : raw < 0 ? "down" : "flat";
  const sub = showPL ? signedMoney(item.totalPL) : money(item.marketValue);

  const select = (target: HTMLElement) => {
    const r = target.getBoundingClientRect();
    onSelect(item, { top: r.top, left: r.left, width: r.width, height: r.height });
  };

  return (
    <button
      type="button"
      data-ticker={item.ticker}
      aria-label={`${item.ticker}, ${item.companyName}, ${money(item.marketValue)}, ${direction} ${Math.abs(raw).toFixed(2)}% today`}
      className="rd-focusable"
      style={{
        position: "absolute",
        top: y,
        left: x,
        width,
        height,
        background: rgbString(bg),
        border: "none",
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        borderRadius: 6,
        // The only transition in the design. This is a glanceable data view;
        // animation is a liability.
        transition: "filter .12s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.filter = "brightness(1.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = "brightness(1)";
      }}
      onClick={(e) => {
        e.stopPropagation();
        select(e.currentTarget);
      }}
    >
      {tier !== "none" && (
        <span
          style={{
            color: fg,
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontWeight: 700,
            fontSize: size,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
          }}
        >
          {item.ticker}
        </span>
      )}
      {(tier === "percent" || tier === "full") && (
        <span
          data-testid="tile-percent"
          style={{
            color: fg,
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: Math.max(11, size * 0.62),
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.2,
            marginTop: 2,
            whiteSpace: "nowrap",
          }}
        >
          {glyph}
          {Math.abs(raw).toFixed(2)}%
        </span>
      )}
      {tier === "full" && (
        <span
          data-testid="tile-sub"
          style={{
            color: fg2,
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: Math.max(11, size * 0.52),
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.2,
            marginTop: 3,
            whiteSpace: "nowrap",
          }}
        >
          {sub}
        </span>
      )}
    </button>
  );
}

/**
 * Area for a tile. In P&L mode a floor of 0.4% of portfolio value keeps a
 * near-break-even position from vanishing entirely.
 *
 * The magnitude is `shares * quote.change`, NOT `totalPL`. `quote.change` is
 * range-aware — the hook rewrites it to `price - avgCost` in ALL mode — so
 * this keeps P&L sizing in step with the selected time range. `totalPL` is
 * always lifetime, which would make the 1D map show lifetime areas.
 */
function sizeOf(item: PortfolioItem, sizing: SizingMode, total: number): number {
  if (sizing !== "profit") return item.marketValue;
  return Math.max(Math.abs(item.shares * item.quote.change), total * 0.004);
}

interface Props {
  items: PortfolioItem[];
  sizing: SizingMode;
  /** Clamp domain in percent. Derived by the caller so the legend agrees. */
  domain: number;
  onSelect: (item: PortfolioItem | null, rect: TileRect | null) => void;
}

export function Treemap({ items, sizing, domain, onSelect }: Props) {
  const { cvd } = usePreferences();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);

  const total = items.reduce((s, i) => s + i.marketValue, 0);

  const data = {
    id: "portfolio",
    children: [...items]
      .sort((a, b) => sizeOf(b, sizing, total) - sizeOf(a, sizing, total))
      .map((item) => ({ id: item.ticker, value: sizeOf(item, sizing, total), item })),
  };

  // Arrow keys move focus between tiles. Without this the primary data view is
  // unreachable without a mouse.
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const current = target.dataset?.ticker;
    if (!current || !containerRef.current) return;

    const tiles = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>("[data-ticker]"),
    );
    const rects: NavRect[] = tiles.map((el) => ({
      ticker: el.dataset.ticker as string,
      x: el.offsetLeft,
      y: el.offsetTop,
      w: el.offsetWidth,
      h: el.offsetHeight,
    }));

    const next = nextTile(rects, current, e.key);
    if (next === null) return;
    e.preventDefault();
    tiles.find((el) => el.dataset.ticker === next)?.focus();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full" onKeyDown={handleKeyDown}>
      <ResponsiveTreeMapHtml
        data={data}
        identity="id"
        value="value"
        tile="squarify"
        innerPadding={2}
        outerPadding={0}
        borderWidth={0}
        leavesOnly={true}
        label={() => ""}
        labelSkipSize={0}
        nodeComponent={({ node }) => {
          const item = (node.data as unknown as { item: PortfolioItem }).item;
          return (
            <TreemapTile
              item={item}
              changePercent={item.quote.changePercent}
              domain={domain}
              cvd={cvd}
              isMobile={isMobile}
              width={node.width}
              height={node.height}
              x={node.x}
              y={node.y}
              showPL={sizing === "profit"}
              onSelect={onSelect}
            />
          );
        }}
      />
    </div>
  );
}

/** Clamp domain for a set of items — exported so the legend and caption agree. */
export function domainFor(items: PortfolioItem[]): number {
  return niceDomain(items.map((i) => i.quote.changePercent));
}
