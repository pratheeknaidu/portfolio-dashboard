import { render, screen, fireEvent } from "@testing-library/react";
import { Sheet } from "@/components/ui/Sheet";

describe("Sheet", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("renders nothing when open is false", () => {
    render(
      <Sheet open={false} onClose={() => {}}>
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.queryByText("Body")).not.toBeInTheDocument();
  });

  it("renders children when open is true", () => {
    render(
      <Sheet open onClose={() => {}}>
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("renders with role=dialog and aria-modal=true", () => {
    render(
      <Sheet open onClose={() => {}}>
        <p>Body</p>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("calls onClose when overlay is clicked", () => {
    const onClose = jest.fn();
    render(
      <Sheet open onClose={onClose}>
        <p>Body</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByTestId("sheet-overlay"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stops propagation on overlay click", () => {
    const onClose = jest.fn();
    const docClick = jest.fn();
    document.addEventListener("click", docClick);
    render(
      <Sheet open onClose={onClose}>
        <p>Body</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByTestId("sheet-overlay"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(docClick).not.toHaveBeenCalled();
    document.removeEventListener("click", docClick);
  });

  it("does not call onClose when clicking inside the panel", () => {
    const onClose = jest.fn();
    render(
      <Sheet open onClose={onClose}>
        <button>Inside</button>
      </Sheet>,
    );
    fireEvent.click(screen.getByText("Inside"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const onClose = jest.fn();
    render(
      <Sheet open onClose={onClose}>
        <p>Body</p>
      </Sheet>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("locks body scroll while open", () => {
    const { rerender } = render(
      <Sheet open onClose={() => {}}>
        <p>Body</p>
      </Sheet>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Sheet open={false} onClose={() => {}}>
        <p>Body</p>
      </Sheet>,
    );
    expect(document.body.style.overflow).toBe("");
  });
});
