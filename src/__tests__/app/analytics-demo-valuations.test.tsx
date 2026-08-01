import { render, waitFor } from "@testing-library/react";
import AnalyticsPage from "@/app/analytics/page";
import type { PortfolioItem } from "@/types";

const items: PortfolioItem[] = [{
  ticker: "AAA", companyName: "AAA Inc.", sector: "Technology", shares: 10, avgCost: 100,
  addedAt: "2026-01-02T00:00:00.000Z",
  quote: { price: 110, change: 1, changePercent: 0.9, previousClose: 109 },
  marketValue: 1100, totalPL: 100, totalPLPercent: 10,
}];

jest.mock("@/lib/use-portfolio-data", () => ({
  usePortfolioData: () => ({ items, failed: [], status: "ready", snapshots: [], excludedValue: 0, refresh: jest.fn() }),
}));
jest.mock("@/lib/demo-context", () => ({ useIsDemo: () => true }));
jest.mock("@/components/AuthGuard", () => ({ AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
// Stable getIdToken/signOut: fetchValuations depends on getIdToken, so a fresh
// identity each render would spin the mount effect (the real AuthContext is stable).
const mockGetIdToken = jest.fn(async () => "t");
const mockSignOut = jest.fn();
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ getIdToken: mockGetIdToken, signOut: mockSignOut }) }));
jest.mock("@/lib/toast-context", () => ({ useToast: () => ({ error: jest.fn(), info: jest.fn(), success: jest.fn(), show: jest.fn(), dismiss: jest.fn(), toasts: [] }) }));
jest.mock("next/navigation", () => ({ usePathname: () => "/demo/analytics" }));
jest.mock("@/components/AnalystSentimentCard", () => ({ AnalystSentimentCard: () => <div data-testid="analyst" /> }));
jest.mock("@/components/ValuationCard", () => ({ ValuationCard: () => <div data-testid="valuation" /> }));
jest.mock("@/components/PerformanceCard", () => ({ PerformanceCard: () => <div data-testid="performance" /> }));

describe("AnalyticsPage demo valuations", () => {
  it("fetches /api/demo/valuations in demo mode", async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ AAA: { recommendationKey: "buy" } }) }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<AnalyticsPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/demo/valuations"));
  });
});
