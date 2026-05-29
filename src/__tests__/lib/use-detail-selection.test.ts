import { renderHook, act } from "@testing-library/react";
import { useDetailSelection } from "@/lib/use-detail-selection";

const rect = { top: 0, left: 0, width: 10, height: 10 };

describe("useDetailSelection", () => {
  it("selects an item and stores its rect", () => {
    const { result } = renderHook(() => useDetailSelection<{ id: string }>());
    const item = { id: "A" };
    act(() => result.current.select(item, rect));
    expect(result.current.selected).toBe(item);
    expect(result.current.rect).toBe(rect);
  });

  it("toggles off when the same item is re-selected", () => {
    const { result } = renderHook(() => useDetailSelection<{ id: string }>());
    const item = { id: "A" };
    act(() => result.current.select(item, rect));
    act(() => result.current.select(item, rect));
    expect(result.current.selected).toBeNull();
  });

  it("dismiss clears selection", () => {
    const { result } = renderHook(() => useDetailSelection<{ id: string }>());
    act(() => result.current.select({ id: "A" }, rect));
    act(() => result.current.dismiss());
    expect(result.current.selected).toBeNull();
  });

  it("dismisses on Escape", () => {
    const { result } = renderHook(() => useDetailSelection<{ id: string }>());
    act(() => result.current.select({ id: "A" }, rect));
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.selected).toBeNull();
  });

  it("dismisses on outside click after the deferral tick", () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useDetailSelection<{ id: string }>());
    act(() => result.current.select({ id: "A" }, rect));
    act(() => {
      jest.runOnlyPendingTimers(); // let the deferred click listener attach
      document.dispatchEvent(new MouseEvent("click"));
    });
    expect(result.current.selected).toBeNull();
    jest.useRealTimers();
  });
});
