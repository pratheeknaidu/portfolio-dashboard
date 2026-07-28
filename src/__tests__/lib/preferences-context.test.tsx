import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreferencesProvider, usePreferences } from "@/lib/preferences-context";

function Probe() {
  const { cvd, setCvd } = usePreferences();
  return <button onClick={() => setCvd(!cvd)}>{cvd ? "cvd-on" : "cvd-off"}</button>;
}

const renderProbe = () =>
  render(
    <PreferencesProvider>
      <Probe />
    </PreferencesProvider>,
  );

describe("usePreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-cvd");
  });

  it("defaults to the normal ramp", () => {
    renderProbe();
    expect(screen.getByText("cvd-off")).toBeInTheDocument();
  });

  it("persists the preference to localStorage", async () => {
    renderProbe();
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText("cvd-on")).toBeInTheDocument();
    expect(window.localStorage.getItem("pref:cvd")).toBe("true");
  });

  it("rehydrates a stored preference on mount", () => {
    window.localStorage.setItem("pref:cvd", "true");
    renderProbe();
    expect(screen.getByText("cvd-on")).toBeInTheDocument();
  });

  // This attribute is what lets every P&L text colour in the app flip via CSS
  // alone, with no re-render and no prop drilling.
  it("mirrors the preference onto the document root", async () => {
    renderProbe();
    expect(document.documentElement.getAttribute("data-cvd")).toBe("false");
    await userEvent.click(screen.getByRole("button"));
    expect(document.documentElement.getAttribute("data-cvd")).toBe("true");
  });

  it("survives localStorage being unavailable", () => {
    const spy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => renderProbe()).not.toThrow();
    expect(screen.getByText("cvd-off")).toBeInTheDocument();
    spy.mockRestore();
  });
});
