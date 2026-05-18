import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders title, message, and default button labels", () => {
    render(
      <ConfirmDialog
        title="Remove holding?"
        message="Remove AAPL from your portfolio?"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText(/remove holding\?/i)).toBeInTheDocument();
    expect(screen.getByText(/remove AAPL/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("uses a custom confirm label when provided", () => {
    render(
      <ConfirmDialog
        title="t" message="m" confirmLabel="Delete"
        onConfirm={jest.fn()} onCancel={jest.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("fires onCancel when Cancel is clicked", () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog title="t" message="m" onConfirm={jest.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("fires onConfirm when Confirm is clicked", () => {
    const onConfirm = jest.fn();
    render(<ConfirmDialog title="t" message="m" onConfirm={onConfirm} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while an async onConfirm is in flight", async () => {
    let resolve!: () => void;
    const onConfirm = jest.fn(() => new Promise<void>((r) => { resolve = r; }));
    render(
      <ConfirmDialog
        title="t" message="m" confirmLabel="Delete"
        onConfirm={onConfirm} onCancel={jest.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(screen.getByRole("button", { name: /delete/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    resolve();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /delete/i })).not.toBeDisabled();
    });
  });

  it("fires onCancel when Escape is pressed (not pending)", async () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog title="t" message="m" onConfirm={jest.fn()} onCancel={onCancel} />);
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
