import { render, screen } from "@testing-library/react";
import AnalyticsPage from "@/app/analytics/page";
import type { PortfolioItem } from "@/types";

const item = (ticker: string, sector: string, mv: number, pl: number): PortfolioItem => ({
  ticker,
  companyName: `${ticker} Inc.`,
  sector,
  shares: 10,
  avgCost: 100,
  addedAt: "2026-01-02T00:00:00.000Z",
  quote: { price: mv / 10, change: 1, changePercent: 0.9, previousClose: 100 },
  marketValue: mv,
  totalPL: pl,
  totalPLPercent: pl / 10,
});

let mockData = {
  items: [item("AAA", "Technology", 600, 100), item("BBB", "Healthcare", 300, -50)],
  failed: [],
  status: "ready",
  snapshots: [],
  excludedValue: 0,
  refresh: jest.fn(),
};
jest.mock("@/lib/use-portfolio-data", () => ({ usePortfolioData: () => mockData }));
jest.mock("@/lib/demo-context", () => ({ useIsDemo: () => false }));
jest.mock("@/components/AuthGuard", () => ({ AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ getIdToken: async () => "t", signOut: jest.fn() }) }));
jest.mock("@/lib/toast-context", () => ({ useToast: () => ({ error: jest.fn(), info: jest.fn(), success: jest.fn(), show: jest.fn(), dismiss: jest.fn(), toasts: [] }) }));
jest.mock("next/navigation", () => ({ usePathname: () => "/analytics" }));
// Valuation cards fetch their own data and pull recharts; stub for a fast composition test.
jest.mock("@/components/AnalystSentimentCard", () => ({ AnalystSentimentCard: () => <div data-testid="analyst" /> }));
jest.mock("@/components/ValuationCard", () => ({ ValuationCard: () => <div data-testid="valuation" /> }));
jest.mock("@/components/PerformanceCard", () => ({ PerformanceCard: () => <div data-testid="performance" /> }));

describe("AnalyticsPage", () => {
  it("renders performance, allocation, P&L-by-sector and the valuation block", () => {
    render(<AnalyticsPage />);
    expect(screen.getByTestId("performance")).toBeInTheDocument();
    expect(screen.getByLabelText("Allocation")).toBeInTheDocument();
    expect(screen.getByLabelText("P&L by sector")).toBeInTheDocument();
    expect(screen.getByTestId("analyst")).toBeInTheDocument();
    expect(screen.getByTestId("valuation")).toBeInTheDocument();
  });

  it("does not render a heat map or a holdings table", () => {
    render(<AnalyticsPage />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByLabelText(/heat map/i)).toBeNull();
  });

  it("marks the Analytics tab active", () => {
    render(<AnalyticsPage />);
    const links = screen.getAllByRole("link", { name: "Analytics" });
    expect(links.some((l) => l.getAttribute("aria-current") === "page")).toBe(true);
  });
});
