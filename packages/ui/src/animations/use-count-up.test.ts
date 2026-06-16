// packages/ui/src/animations/use-count-up.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCountUp } from "./use-count-up";

const reducedMatchMedia = () =>
  vi.fn().mockReturnValue({
    matches: true,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });

describe("useCountUp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default: prefers-reduced-motion NOT set (animation runs).
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns target immediately when prefers-reduced-motion: reduce", () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    const { result } = renderHook(() => useCountUp(100));
    expect(result.current).toBe(100);
  });

  it("starts at the initial target on first render", () => {
    const { result } = renderHook(() => useCountUp(50));
    expect(result.current).toBe(50);
  });

  it("with fromZero, starts at 0 on first render (donut sweeps in)", () => {
    const { result } = renderHook(() => useCountUp(80, { fromZero: true }));
    expect(result.current).toBe(0);
  });

  it("with fromZero, sweeps from 0 to the target across frames", () => {
    // Drive rAF + performance.now by hand → deterministic, independent of the
    // fake-timer internals.
    let frame: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frame = cb;
      return 1;
    });
    let clock = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => clock);

    const { result } = renderHook(() => useCountUp(100, { durationMs: 500, fromZero: true }));
    expect(result.current).toBe(0);

    act(() => {
      clock = 1250; // 50 % through
      frame?.(clock);
    });
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(100);

    act(() => {
      clock = 1500; // 100 %
      frame?.(clock);
    });
    expect(result.current).toBe(100);
  });

  it("with fromZero + reduced motion, settles at target immediately (no sweep)", () => {
    window.matchMedia = reducedMatchMedia();
    const { result } = renderHook(() => useCountUp(100, { fromZero: true }));
    expect(result.current).toBe(100);
  });

  it("without fromZero, still starts at the target (default unchanged)", () => {
    const { result } = renderHook(() => useCountUp(42, { fromZero: false }));
    expect(result.current).toBe(42);
  });

  it("cancels the pending rAF on unmount (no leaked frames)", () => {
    // Spy on rAF / cAF so we can assert the cleanup branch fires.
    const requestSpy = vi.spyOn(window, "requestAnimationFrame");
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount, rerender } = renderHook(({ target }) => useCountUp(target), {
      initialProps: { target: 0 },
    });
    // Bump target to a different value — schedules a rAF tick.
    rerender({ target: 100 });
    expect(requestSpy).toHaveBeenCalled();
    const lastFrameId = requestSpy.mock.results.at(-1)?.value;
    unmount();
    // Cleanup must cancel the pending frame.
    expect(cancelSpy).toHaveBeenCalledWith(lastFrameId);
  });
});
