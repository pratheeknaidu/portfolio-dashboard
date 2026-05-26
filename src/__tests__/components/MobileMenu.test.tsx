import { render, screen, fireEvent } from "@testing-library/react";
import { MobileMenu } from "@/components/MobileMenu";

const mockSignOut = jest.fn();
const mockPathname = jest.fn(() => "/");

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ signOut: mockSignOut }),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

jest.mock("@/lib/market-hours", () => ({
  isMarketOpen: () => true,
}));

describe("MobileMenu", () => {
  afterEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue("/");
  });

  it("renders nothing when closed", () => {
    render(<MobileMenu open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nav links when open", () => {
    render(<MobileMenu open onClose={() => {}} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
  });

  it("calls onClose when overlay is clicked", () => {
    const onClose = jest.fn();
    render(<MobileMenu open onClose={onClose} />);
    fireEvent.click(screen.getByTestId("mobile-menu-overlay"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Escape", () => {
    const onClose = jest.fn();
    render(<MobileMenu open onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when a nav link is clicked", () => {
    const onClose = jest.fn();
    render(<MobileMenu open onClose={onClose} />);
    fireEvent.click(screen.getByText("Analytics"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("highlights the active path", () => {
    mockPathname.mockReturnValue("/analytics");
    render(<MobileMenu open onClose={() => {}} />);
    const analyticsLink = screen.getByText("Analytics").closest("a");
    expect(analyticsLink?.className).toMatch(/from-primary/);
  });

  it("calls signOut when Sign out is clicked", () => {
    render(<MobileMenu open onClose={() => {}} />);
    fireEvent.click(screen.getByText("Sign out"));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
