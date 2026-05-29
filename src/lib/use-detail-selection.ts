"use client";
import { useCallback, useEffect, useState } from "react";
import type { TileRect } from "@/components/ui/DetailPanel";

export function useDetailSelection<T>() {
  const [selected, setSelected] = useState<T | null>(null);
  const [rect, setRect] = useState<TileRect | null>(null);

  const select = useCallback((item: T, r: TileRect) => {
    setSelected((prev) => {
      if (prev === item) {
        setRect(null);
        return null;
      }
      setRect(r);
      return item;
    });
  }, []);

  const dismiss = useCallback(() => {
    setSelected(null);
    setRect(null);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    const handleClickOutside = () => dismiss();
    document.addEventListener("keydown", handleEsc);
    const timer = window.setTimeout(
      () => document.addEventListener("click", handleClickOutside),
      0,
    );
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.removeEventListener("click", handleClickOutside);
      window.clearTimeout(timer);
    };
  }, [selected, dismiss]);

  return { selected, rect, select, dismiss };
}
