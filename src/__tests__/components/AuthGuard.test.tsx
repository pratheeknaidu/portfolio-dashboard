import { render, screen } from "@testing-library/react";
import { AuthGuard } from "@/components/AuthGuard";
import { DemoProvider } from "@/lib/demo-context";

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

  it("bypasses the auth gate in demo mode and shows the demo banner", () => {
    // No user, not loading — the real app would show the sign-in screen.
    mockUseAuth.mockReturnValue({ user: null, loading: false, signIn: jest.fn() } as any);
    render(
      <DemoProvider>
        <AuthGuard><div>Protected</div></AuthGuard>
      </DemoProvider>,
    );
    expect(screen.getByText("Protected")).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();
  });
});
