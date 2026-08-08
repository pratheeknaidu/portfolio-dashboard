import { render, screen, fireEvent } from "@testing-library/react";
import { DemoBanner } from "@/components/DemoBanner";
import { track } from "@vercel/analytics";

jest.mock("@vercel/analytics", () => ({ track: jest.fn() }));

// The real next/link needs an app-router context to handle a click. Stub it to
// a plain anchor, forwarding onClick so the tracking handler still runs.
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: React.MouseEventHandler;
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DemoBanner", () => {
  it("offers the sign-in call to action", () => {
    render(<DemoBanner />);
    expect(
      screen.getByRole("link", { name: /sign in to track your own/i }),
    ).toHaveAttribute("href", "/");
  });

  it("tracks a conversion event when the sign-in link is clicked", () => {
    render(<DemoBanner />);
    fireEvent.click(screen.getByRole("link", { name: /sign in to track your own/i }));
    expect(track).toHaveBeenCalledWith("demo_signin_click");
  });

  it("does not track anything before the link is clicked", () => {
    render(<DemoBanner />);
    expect(track).not.toHaveBeenCalled();
  });
});
