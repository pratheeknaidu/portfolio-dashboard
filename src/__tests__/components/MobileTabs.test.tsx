import { render, screen } from "@testing-library/react";
import { MobileTabs, NAV_TABS } from "@/components/MobileTabs";

jest.mock("next/navigation", () => ({ usePathname: () => mockPathname() }));
const mockPathname = jest.fn(() => "/");

describe("MobileTabs", () => {
  beforeEach(() => mockPathname.mockReturnValue("/"));

  it("renders one link per configured tab", () => {
    render(<MobileTabs />);
    for (const tab of NAV_TABS) {
      expect(screen.getByRole("link", { name: tab.label })).toBeInTheDocument();
    }
  });

  it("marks the tab matching the current route as current", () => {
    mockPathname.mockReturnValue("/analytics");
    render(<MobileTabs />);
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  // The demo routes mirror the real ones. Without prefix-awareness every tab
  // under /demo renders inactive and the control looks broken.
  it("resolves the active tab under the /demo prefix", () => {
    mockPathname.mockReturnValue("/demo/analytics");
    render(<MobileTabs />);
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps links inside /demo when browsing the demo", () => {
    mockPathname.mockReturnValue("/demo");
    render(<MobileTabs />);
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute("href", "/demo/analytics");
  });

  it("does not mark Dashboard current on a nested route", () => {
    mockPathname.mockReturnValue("/analytics");
    render(<MobileTabs />);
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("includes a Holdings tab between Dashboard and Analytics", () => {
    expect(NAV_TABS.map((t) => t.label)).toEqual(["Dashboard", "Holdings", "Analytics"]);
  });

  it("marks Holdings current on the /holdings route", () => {
    mockPathname.mockReturnValue("/holdings");
    render(<MobileTabs />);
    expect(screen.getByRole("link", { name: "Holdings" })).toHaveAttribute("aria-current", "page");
  });

  it("resolves Holdings active under the /demo prefix", () => {
    mockPathname.mockReturnValue("/demo/holdings");
    render(<MobileTabs />);
    expect(screen.getByRole("link", { name: "Holdings" })).toHaveAttribute("aria-current", "page");
  });
});
