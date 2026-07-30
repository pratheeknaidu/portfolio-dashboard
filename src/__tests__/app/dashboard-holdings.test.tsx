import { render, screen } from "@testing-library/react";
import DashboardPage from "@/app/page";
import type { PortfolioItem } from "@/types";

const mkItems = (n: number): PortfolioItem[] =>
  Array.from({ length: n }, (_, i) => ({
    ticker: `T${i}`,
    companyName: `T${i} Inc.`,
    sector: "Technology",
    shares: 10,
    avgCost: 100,
    addedAt: "2026-01-02T00:00:00.000Z",
    quote: { price: 110, change: 1, changePercent: 0.9, previousClose: 109 },
    marketValue: (n - i) * 100,
    totalPL: 5,
    totalPLPercent: 5,
  }));

let mockData = {
  items: mkItems(14),
  failed: [],
  status: "ready",
  snapshots: [],
  excludedValue: 0,
  refresh: jest.fn(),
};
jest.mock("@/lib/use-portfolio-data", () => ({ usePortfolioData: () => mockData }));
jest.mock("@/lib/use-is-mobile", () => ({ useIsMobile: () => false }));
jest.mock("@/lib/demo-context", () => ({ useIsDemo: () => false }));
jest.mock("@/components/AuthGuard", () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ getIdToken: async () => "t", signOut: jest.fn() }),
}));
jest.mock("@/lib/toast-context", () => ({
  useToast: () => ({
    error: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    show: jest.fn(),
    dismiss: jest.fn(),
    toasts: [],
  }),
}));
jest.mock("next/navigation", () => ({ usePathname: () => "/" }));
// The heat map pulls in nivo; stub it so this composition test stays fast.
jest.mock("@/components/HeatMapCard", () => ({ HeatMapCard: () => <div data-testid="heatmap" /> }));

describe("Dashboard holdings table", () => {
  it("caps the dashboard table at 10 rows even with more holdings", () => {
    mockData = { ...mockData, items: mkItems(14) };
    render(<DashboardPage />);
    expect(screen.getAllByRole("row").length - 1).toBe(10); // minus header row
  });

  it("links to the full holdings screen when capped", () => {
    mockData = { ...mockData, items: mkItems(14) };
    render(<DashboardPage />);
    expect(screen.getByRole("link", { name: /all holdings/i })).toHaveAttribute("href", "/holdings");
  });

  it("does not show the see-all link when 10 or fewer", () => {
    mockData = { ...mockData, items: mkItems(8) };
    render(<DashboardPage />);
    expect(screen.queryByRole("link", { name: /all holdings/i })).toBeNull();
  });
});
