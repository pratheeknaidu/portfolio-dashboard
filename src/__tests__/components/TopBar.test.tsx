import { render, screen } from "@testing-library/react";
import { TopBar } from "@/components/TopBar";

jest.mock("next/navigation", () => ({ usePathname: () => "/" }));

const base = {
  onImportClick: jest.fn(),
  onAddClick: jest.fn(),
  onSignOut: jest.fn(),
  vix: null,
  marketOpen: false,
};

describe("TopBar", () => {
  it("keeps Sign out reachable without a hamburger", () => {
    render(<TopBar {...base} isDemo={false} />);
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /menu/i })).toBeNull();
  });

  it("offers Sign in instead when browsing the demo", () => {
    render(<TopBar {...base} isDemo />);
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
  });

  it("gives the auth control a 44px minimum touch target", () => {
    render(<TopBar {...base} isDemo={false} />);
    expect(screen.getByRole("button", { name: /sign out/i })).toHaveClass("min-h-[44px]");
  });

  it("shows market status as a status region, not a button", () => {
    render(<TopBar {...base} isDemo={false} marketOpen={false} />);
    expect(screen.getByRole("status")).toHaveTextContent(/closed/i);
  });

  it("exposes Import and Add", () => {
    render(<TopBar {...base} isDemo={false} />);
    expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
  });
});
