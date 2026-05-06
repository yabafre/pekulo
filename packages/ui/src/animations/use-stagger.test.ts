import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStagger } from "./use-stagger";

describe("useStagger", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
  });

  it("returns linear stagger [0, 40, 80] for 3 items @ 40ms", () => {
    const { result } = renderHook(() => useStagger(3, 40));
    expect(result.current).toEqual([0, 40, 80]);
  });

  it("returns zeros when reduced motion is set", () => {
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
    const { result } = renderHook(() => useStagger(4, 40));
    expect(result.current).toEqual([0, 0, 0, 0]);
  });
});
