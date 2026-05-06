// packages/ui/src/animations/use-count-up.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCountUp } from "./use-count-up";

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
});
