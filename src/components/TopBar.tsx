"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { VixPill } from "@/components/VixPill";
import { StatusPill } from "@/components/StatusPill";
import { MobileTabs, NAV_TABS, normalizePath } from "@/components/MobileTabs";
import type { VixApiResponse } from "@/lib/vix-sentiment";

interface TopBarProps {
  onImportClick: () => void;
  onAddClick: () => void;
  onSignOut: () => void;
  isDemo: boolean;
  marketOpen: boolean;
  vix: VixApiResponse | null;
}

export function TopBar({ onImportClick, onAddClick, onSignOut, isDemo, marketOpen, vix }: TopBarProps) {
  const current = normalizePath(usePathname());

  return (
    <header className="sticky top-0 z-40 border-b border-rd-border-hairline bg-rd-chrome">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-4 px-4 lg:px-8">
        <span className="font-semibold tracking-tight text-rd-text">Portfolio</span>

        <nav aria-label="Sections" className="hidden lg:flex items-center gap-1">
          {NAV_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={isDemo ? `/demo${tab.href === "/" ? "" : tab.href}` : tab.href}
              aria-current={current === tab.href ? "page" : undefined}
              className={`rd-focusable rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                current === tab.href ? "bg-rd-control text-rd-text" : "text-rd-muted hover:text-rd-text"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <StatusPill open={marketOpen} asOf="4:00 PM ET" />
          </div>
          {/* VixPill's prop is `data`, and it handles null itself. */}
          <VixPill data={vix} />

          <button
            onClick={onAddClick}
            className="rd-focusable inline-flex min-h-[44px] items-center rounded-lg border border-rd-border-control bg-rd-control px-3 text-sm font-medium text-rd-text hover:border-rd-border-strong"
          >
            Add
          </button>
          <button
            onClick={onImportClick}
            className="rd-focusable inline-flex min-h-[44px] items-center rounded-lg border border-rd-border-control bg-rd-control px-3 text-sm font-medium text-rd-text hover:border-rd-border-strong"
          >
            Import
          </button>

          {/* MobileMenu carried these; it is deleted, so they live here at a
              real touch target rather than as the ~20px text link the review
              flagged as the only way out of the app. */}
          {isDemo ? (
            <Link
              href="/"
              className="rd-focusable inline-flex min-h-[44px] items-center rounded-lg border border-rd-border-control px-3 text-sm font-medium text-rd-text hover:border-rd-border-strong"
            >
              Sign in
            </Link>
          ) : (
            <button
              onClick={onSignOut}
              className="rd-focusable inline-flex min-h-[44px] items-center rounded-lg border border-rd-border-control px-3 text-sm font-medium text-rd-muted hover:text-rd-text"
            >
              Sign out
            </button>
          )}
        </div>
      </div>

      <div className="pb-3 lg:pb-0">
        <MobileTabs />
      </div>
    </header>
  );
}
