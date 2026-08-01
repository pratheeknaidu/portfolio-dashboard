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

export const metadata: Metadata = {
  metadataBase: new URL("https://robinhood-portfolio.vercel.app"),
  title: "Portfolio Dashboard",
  description: "Finviz-style treemap for your stock portfolio",
  openGraph: {
    title: "Portfolio Dashboard",
    description:
      "A Finviz-style heatmap for your stock portfolio — import Robinhood holdings and watch them as a live treemap.",
    url: "https://robinhood-portfolio.vercel.app",
    siteName: "Portfolio Dashboard",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${bodyFont.variable} ${monoFont.variable}`}
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
