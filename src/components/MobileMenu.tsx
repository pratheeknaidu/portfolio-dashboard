"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useIsDemo } from "@/lib/demo-context";
import { isMarketOpen } from "@/lib/market-hours";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const isDemo = useIsDemo();
  const marketOpen = isMarketOpen();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const tabs = isDemo
    ? [
        { href: "/demo", label: "Dashboard" },
        { href: "/demo/analytics", label: "Analytics" },
      ]
    : [
        { href: "/", label: "Dashboard" },
        { href: "/analytics", label: "Analytics" },
      ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      className="fixed inset-0 z-50 md:hidden"
    >
      <div
        data-testid="mobile-menu-overlay"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <aside className="absolute left-0 top-0 h-full w-[75vw] max-w-[320px] bg-surface-card border-r border-border/60 shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 p-5 border-b border-border/40">
          <div className="brand-mark h-10 w-10 rounded-xl flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-primary-foreground">
              <path d="M4 18L9 11L13 14L20 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="20" cy="6" r="1.6" fill="currentColor" />
            </svg>
          </div>
          <span className="font-display text-lg font-semibold text-foreground">Portfolio</span>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={onClose}
                className={`px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                  active
                    ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-3 space-y-2 border-t border-border/40">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border ${
              marketOpen
                ? "bg-positive/10 text-positive border-positive/30"
                : "bg-surface-elevated/60 text-muted-foreground border-border/60"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${marketOpen ? "bg-positive" : "bg-muted-foreground/60"}`} />
            {marketOpen ? "Market Open" : "Market Closed"}
          </div>
          {isDemo ? (
            <Link
              href="/"
              onClick={onClose}
              className="block w-full text-left px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated rounded-lg transition-colors"
            >
              Sign in
            </Link>
          ) : (
            <button
              onClick={signOut}
              className="w-full text-left px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated rounded-lg transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
