"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useIsDemo } from "@/lib/demo-context";
import { DemoBanner } from "@/components/DemoBanner";

const isSandbox = process.env.NEXT_PUBLIC_USE_EMULATOR === "true";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn, signInAsSandbox } = useAuth();
  const isDemo = useIsDemo();

  // Demo mode renders the app without any Firebase user — data comes from a
  // static fixture, so we skip the auth gate entirely and show the banner.
  if (isDemo) {
    return (
      <>
        <DemoBanner />
        {children}
      </>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Portfolio Dashboard</h1>
        <button
          onClick={signIn}
          className="px-6 py-3 bg-accent rounded-lg text-white font-medium hover:bg-accent-dark"
        >
          Sign in with Google
        </button>
        {isSandbox && (
          <button
            onClick={signInAsSandbox}
            className="px-6 py-3 bg-surface-card border border-surface-border rounded-lg text-gray-200 font-medium hover:bg-surface-border"
          >
            Sign in as sandbox user
          </button>
        )}
        <Link
          href="/demo"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Or explore a live demo, no sign-in →
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
