import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/lib/toast-context";
import { ToastStack } from "@/components/ToastStack";
import { PreferencesProvider } from "@/lib/preferences-context";

// One proportional sans for prose, one tabular mono for every number. That
// pairing rule is the spec; the specific families are replaceable.
const bodyFont = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

// --font-display still has ~14 consumers on the not-yet-migrated screens, so
// it is re-pointed at the same family rather than deleted. It has to be its
// own loader call: `bodyFont.variable` is the literal string "--font-body",
// so aliasing the constant would leave --font-display undefined and drop
// every heading in the app to system-ui until plan 4 removes the last use.
const displayFont = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Portfolio Dashboard",
  description: "Finviz-style treemap for your stock portfolio",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
    >
      <body className="min-h-screen overflow-x-hidden">
        <AuthProvider>
          <PreferencesProvider>
            <ToastProvider>
              {children}
              <ToastStack />
            </ToastProvider>
          </PreferencesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
