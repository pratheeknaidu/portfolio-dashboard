"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isMarketOpen } from "@/lib/market-hours";

interface NavbarProps {
  onImportClick: () => void;
}

export function Navbar({ onImportClick }: NavbarProps) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const marketOpen = isMarketOpen();

  return (
    <nav className="h-14 bg-surface-card border-b border-surface-border flex items-center px-6 justify-between">
      <div className="flex items-center gap-6">
        <span className="text-lg font-bold text-white">Portfolio</span>
        <Link href="/" className={pathname === "/" ? "text-accent" : "text-gray-400 hover:text-gray-200"}>
          Dashboard
        </Link>
        <Link href="/analytics" className={pathname === "/analytics" ? "text-accent" : "text-gray-400 hover:text-gray-200"}>
          Analytics
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <span className={`text-xs ${marketOpen ? "text-gain" : "text-gray-500"}`}>
          {marketOpen ? "Market Open" : "Market Closed"}
        </span>
        <button onClick={onImportClick} className="px-3 py-1.5 bg-accent-dark text-white text-sm rounded hover:bg-accent">
          Import CSV
        </button>
        <button onClick={signOut} className="text-gray-400 hover:text-gray-200 text-sm">
          Sign Out
        </button>
      </div>
    </nav>
  );
}
