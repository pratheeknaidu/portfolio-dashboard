import { render, screen } from "@testing-library/react";
import HoldingsPage from "@/app/holdings/page";
import type { PortfolioItem } from "@/types";

const item = (ticker: string, mv: number): PortfolioItem => ({
  ticker,
  companyName: `${ticker} Inc.`,
  sector: "Technology",
  shares: 10,
  avgCost: 100,
  addedAt: "2026-01-02T00:00:00.000Z",
  quote: { price: mv / 10, change: 1, changePercent: 0.9, previousClose: 100 },
  marketValue: mv,
  totalPL: 5,
  totalPLPercent: 5,
});

let mockData = {
  items: [item("AAA", 100), item("BBB", 300)],
  failed: [],
  status: "ready",
  snapshots: [],
  excludedValue: 0,
  refresh: jest.fn(),
};
jest.mock("@/lib/use-portfolio-data", () => ({ usePortfolioData: () => mockData }));

let mockMobile = false;
jest.mock("@/lib/use-is-mobile", () => ({ useIsMobile: () => mockMobile }));
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
jest.mock("next/navigation", () => ({ usePathname: () => "/holdings" }));

describe("HoldingsPage", () => {
  beforeEach(() => {
    mockMobile = false;
    mockData = { ...mockData, status: "ready", items: [item("AAA", 100), item("BBB", 300)] };
  });

  it("renders the desktop table with every holding", () => {
    render(<HoldingsPage />);
    expect(screen.getByRole("row", { name: /AAA/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /BBB/ })).toBeInTheDocument();
  });

  it("renders the mobile list on a narrow viewport", () => {
    mockMobile = true;
    render(<HoldingsPage />);
    expect(screen.getAllByTestId("holding-row").length).toBe(2);
  });

  it("shows the empty state when there are no holdings", () => {
    mockData = { ...mockData, status: "empty", items: [] };
    render(<HoldingsPage />);
    expect(screen.getByText(/no holdings yet/i)).toBeInTheDocument();
  });

  it("shows a skeleton while loading", () => {
    mockData = { ...mockData, status: "loading", items: [] };
    render(<HoldingsPage />);
    // The TopBar's StatusPill is also role=status, so target by name.
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });
});
