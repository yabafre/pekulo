import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// AC-1 (verbatim from story 12-4-advisory-private-page:17):
//   Given an allowlisted user (status: "active" or owner: true), When they open /dashboard/advisory,
//   Then the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.
// AC-3 (verbatim from story 12-4-advisory-private-page:19):
//   Given the rendered advisory page, When analysis and recommendations are shown,
//   Then the active provider, model, EU-region posture, and no-train guarantee are surfaced for transparency.

vi.mock("../_actions/advisory-actions", () => ({
  getAdvisoryStatus: vi.fn().mockResolvedValue({ access: "active", owner: true }),
  getLatestAdvisorySession: vi.fn().mockResolvedValue(null),
  generateAdvisoryAnalysis: vi.fn().mockResolvedValue({ id: "advs_test" }),
}));

import {
  useAdvisoryStatus,
  useAdvisoryLatestSession,
  useGenerateAdvisoryAnalysis,
} from "./use-advisory";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("use-advisory hooks", () => {
  it("useAdvisoryStatus loads status", async () => {
    const { result } = renderHook(() => useAdvisoryStatus(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ access: "active", owner: true });
  });

  it("useAdvisoryLatestSession loads latest session", async () => {
    const { result } = renderHook(() => useAdvisoryLatestSession(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("useGenerateAdvisoryAnalysis provides mutate method", () => {
    const { result } = renderHook(() => useGenerateAdvisoryAnalysis(), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current.mutate).toBe("function");
  });
});
