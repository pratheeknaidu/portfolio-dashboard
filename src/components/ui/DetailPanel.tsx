"use client";
import { ReactNode } from "react";
import { useIsMobile } from "@/lib/use-is-mobile";
import { Sheet } from "@/components/ui/Sheet";

export interface TileRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PANEL_W = 256;
const PANEL_H = 220;
const GAP = 8;

function position(rect: TileRect | null) {
  if (!rect) return { top: 0, left: 0 };
  const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080;

  let top = rect.top - PANEL_H - GAP;
  if (top < GAP) top = rect.top + rect.height + GAP;
  if (top + PANEL_H > vh - GAP) top = Math.max(GAP, vh - PANEL_H - GAP);

  let left = rect.left + rect.width / 2 - PANEL_W / 2;
  left = Math.max(GAP, Math.min(left, vw - PANEL_W - GAP));

  return { top, left };
}

interface DetailPanelProps {
  rect: TileRect | null;
  onClose: () => void;
  children: ReactNode;
}

export function DetailPanel({ rect, onClose, children }: DetailPanelProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open onClose={onClose}>
        <div className="p-5">{children}</div>
      </Sheet>
    );
  }

  const { top, left } = position(rect);
  return (
    <div
      className="bento-card fixed z-50 p-5 text-sm pointer-events-none transition-[top,left] duration-100 ease-out"
      style={{ top, left, width: PANEL_W }}
    >
      {children}
    </div>
  );
}
