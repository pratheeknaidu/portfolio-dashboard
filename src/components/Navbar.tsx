"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useIsDemo } from "@/lib/demo-context";
import { isMarketOpen } from "@/lib/market-hours";
import { MobileMenu } from "@/components/MobileMenu";
import { VixPill } from "@/components/VixPill";
import type { VixApiResponse } from "@/lib/vix-sentiment";

interface NavbarProps {
  onImportClick: () => void;
  onAddClick?: () => void;
  vix?: VixApiResponse | null;
}

export function Navbar({ onImportClick, onAddClick, vix }: NavbarProps) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const isDemo = useIsDemo();
  const marketOpen = isMarketOpen();
  const [menuOpen, setMenuOpen] = useState(false);

  const tabs: { href: string; label: string }[] = isDemo
    ? [
        { href: "/demo", label: "Dashboard" },
        { href: "/demo/analytics", label: "Analytics" },
      ]
    : [
        { href: "/", label: "Dashboard" },
        { href: "/analytics", label: "Analytics" },
      ];

  return (
    <>
      {/* `relative z-40` lifts the navbar's stacking context above page
          content. The nav's `backdrop-blur` already forms a stacking context;
          without an explicit z-index it paints behind later-in-DOM siblings
          like `.bento-card` (which forms its own context via `backdrop-filter`),
          which would otherwise hide the VIX info popover behind the chart.
          Stays below the z-50/z-[60] modal+toast tier so overlays still cover it. */}
      <nav className="app-divider relative z-40 h-16 flex items-center px-4 md:px-8 justify-between backdrop-blur-md bg-background/40">
        <div className="flex items-center gap-3 md:gap-8">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="md:hidden inline-flex items-center justify-center h-11 w-11 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <div className="brand-mark h-10 w-10 rounded-xl flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-primary-foreground">
                <path d="M4 18L9 11L13 14L20 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="20" cy="6" r="1.6" fill="currentColor" />
              </svg>
            </div>
            <span className="font-display text-lg font-semibold tracking-tight text-foreground">
              Portfolio
            </span>
          </div>

          <div className="hidden md:inline-flex items-center gap-1 bg-surface-elevated/60 border border-border/60 rounded-full p-1">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                    active
                      ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-sm shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <VixPill data={vix ?? null} />
          <span
            className={`hidden md:inline-flex items-center gap-2 h-10 px-3.5 rounded-full text-xs font-medium tracking-wide border ${
              marketOpen
                ? "bg-positive/10 text-positive border-positive/30"
                : "bg-surface-elevated/60 text-muted-foreground border-border/60"
            }`}
          >
            <span className="relative flex h-2 w-2 items-center justify-center">
              {marketOpen && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-positive/60 animate-ping" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  marketOpen ? "bg-positive" : "bg-muted-foreground/60"
                }`}
              />
            </span>
            {marketOpen ? "Market Open" : "Market Closed"}
          </span>

          {onAddClick && (
            <button
              onClick={onAddClick}
              aria-label="Add stock"
              title="Add a single stock"
              className="inline-flex items-center gap-1.5 h-10 px-3 sm:px-4 rounded-full text-sm font-medium text-foreground bg-surface-elevated/60 border border-border/60 hover:bg-surface-elevated hover:-translate-y-px transition-all"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-4 w-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="hidden sm:inline">Add</span>
            </button>
          )}

          <button
            onClick={onImportClick}
            aria-label="Import"
            className="inline-flex items-center gap-1.5 h-10 px-3 sm:px-4 rounded-full text-sm font-medium text-primary-foreground bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-px transition-all"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
              <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            <span className="hidden sm:inline">Import</span>
          </button>

          {isDemo ? (
            <Link
              href="/"
              aria-label="Sign in"
              title="Sign in to track your own portfolio"
              className="hidden md:inline-flex items-center h-10 px-4 rounded-full text-sm font-medium text-foreground bg-surface-elevated/60 border border-border/60 hover:bg-surface-elevated hover:-translate-y-px transition-all"
            >
              Sign in
            </Link>
          ) : (
            <button
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
              className="hidden md:inline-flex items-center justify-center h-10 w-10 rounded-full bg-surface-elevated/60 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-4 w-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          )}
        </div>
      </nav>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
