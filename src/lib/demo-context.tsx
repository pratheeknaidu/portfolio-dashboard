"use client";

import { createContext, useContext } from "react";

/**
 * Demo mode is a public, read-only render of the dashboard backed entirely by
 * a static fixture (no auth, no Firestore, no network). The `/demo` route
 * segment wraps its subtree in <DemoProvider> so every component below can ask
 * `useIsDemo()` without prop-threading. Outside that segment the context
 * defaults to `false`, so the real (authenticated) app is untouched.
 */
const DemoContext = createContext<boolean>(false);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  return <DemoContext.Provider value={true}>{children}</DemoContext.Provider>;
}

export function useIsDemo(): boolean {
  return useContext(DemoContext);
}
