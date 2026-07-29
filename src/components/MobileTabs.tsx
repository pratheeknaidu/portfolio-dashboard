"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavTab {
  href: string;
  label: string;
}

/**
 * Route tabs, in order.
 *
 * Plan 3 appends `{ href: "/holdings", label: "Holdings" }` when that screen
 * exists. Listing it before the route does would ship a dead tab.
 */
export const NAV_TABS: NavTab[] = [
  { href: "/", label: "Dashboard" },
  { href: "/analytics", label: "Analytics" },
];

const DEMO_PREFIX = "/demo";

/** Strip the demo prefix so one comparison serves both route trees. */
export function normalizePath(pathname: string): string {
  if (pathname === DEMO_PREFIX) return "/";
  return pathname.startsWith(`${DEMO_PREFIX}/`) ? pathname.slice(DEMO_PREFIX.length) : pathname;
}

/**
 * Full-width segmented route control. Replaces the hamburger outright: a menu
 * that hides two destinations behind a tap costs more than it saves.
 */
export function MobileTabs() {
  const pathname = usePathname();
  const inDemo = pathname === DEMO_PREFIX || pathname.startsWith(`${DEMO_PREFIX}/`);
  const current = normalizePath(pathname);

  return (
    <nav
      aria-label="Sections"
      className="lg:hidden grid grid-flow-col auto-cols-fr gap-[3px] p-[3px] mx-4 rounded-lg bg-rd-control border border-rd-border-control"
    >
      {NAV_TABS.map((tab) => {
        const active = current === tab.href;
        const href = inDemo ? `${DEMO_PREFIX}${tab.href === "/" ? "" : tab.href}` : tab.href;
        return (
          <Link
            key={tab.href}
            href={href || DEMO_PREFIX}
            aria-current={active ? "page" : undefined}
            className={`rd-focusable flex min-h-[44px] items-center justify-center rounded-md text-sm font-medium transition-colors ${
              active ? "bg-rd-card text-rd-text" : "text-rd-muted hover:text-rd-text"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
