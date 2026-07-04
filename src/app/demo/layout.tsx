import type { ReactNode } from "react";
import { DemoProvider } from "@/lib/demo-context";

/**
 * Everything under /demo renders the real dashboard/analytics components, but
 * wrapped in DemoProvider so `useIsDemo()` returns true — flipping data sources
 * to the static fixture and disabling writes. No auth, no network.
 */
export default function DemoLayout({ children }: { children: ReactNode }) {
  return <DemoProvider>{children}</DemoProvider>;
}
