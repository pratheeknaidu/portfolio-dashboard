import type { ReactNode } from "react";

interface AppShellProps {
  topBar: ReactNode;
  children: ReactNode;
}

/**
 * Page frame. Owns the width cap and gutters so no screen re-declares them and
 * they cannot drift apart between routes.
 */
export function AppShell({ topBar, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-rd-page">
      {topBar}
      <main className="mx-auto w-full max-w-[1400px] px-4 py-4 lg:px-8 lg:py-6">{children}</main>
    </div>
  );
}
