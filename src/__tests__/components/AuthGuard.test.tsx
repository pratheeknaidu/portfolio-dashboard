import { render, screen } from "@testing-library/react";
import { AuthGuard } from "@/components/AuthGuard";

jest.mock("@/lib/auth-context", () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from "@/lib/auth-context";
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe("AuthGuard", () => {
  it("shows loading spinner when auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true } as any);
    render(<AuthGuard><div>Protected</div></AuthGuard>);
    expect(screen.queryByText("Protected")).not.toBeInTheDocument();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows sign-in button when not authenticated", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, signIn: jest.fn() } as any);
    render(<AuthGuard><div>Protected</div></AuthGuard>);
    expect(screen.queryByText("Protected")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders children when authenticated", () => {
    mockUseAuth.mockReturnValue({ user: { uid: "abc" }, loading: false } as any);
    render(<AuthGuard><div>Protected</div></AuthGuard>);
    expect(screen.getByText("Protected")).toBeInTheDocument();
  });
});
