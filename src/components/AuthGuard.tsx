"use client";
import { useAuth } from "@/lib/auth-context";

const isSandbox = process.env.NEXT_PUBLIC_USE_EMULATOR === "true";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn, signInAsSandbox } = useAuth();

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
      </div>
    );
  }

  return <>{children}</>;
}
