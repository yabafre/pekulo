import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { llmKeys, llmTags } from "@/lib/zapaction/keys";

const setMock = vi.fn();
// Post-ZAP-1: useActionMutation reads `action.tags` to drive the tag-registry
// invalidation. Attach `.tags` via Object.assign so the registry edge runs.
vi.mock("../_actions/llm-actions", () => ({
  setLlmOptIn: Object.assign((input: { thirdParty: boolean }) => setMock(input), {
    tags: [llmTags.optIn()],
  }),
}));

import { useSetLlmOptIn } from "./use-llm-opt-in";

// AC-4 (story 6-3) + AC-2 (story 11-5):
// Toggling the third-party opt-in invalidates both llmKeys.optIn() AND
// llmKeys.aiNotice() so an opt-out → opt-in transition immediately re-triggers
// the AI transparency notice without waiting for useAiNotice's 60s staleTime.
describe("useSetLlmOptIn (6-3 AC-4 + 11-5 AC-2)", () => {
  test("success → invalidates llmKeys.optIn() and llmKeys.aiNotice()", async () => {
    setMock.mockReset().mockResolvedValueOnce({ thirdParty: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(llmKeys.optIn(), { thirdParty: false });
    client.setQueryData(llmKeys.aiNotice(), { seen: true });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSetLlmOptIn(), { wrapper });
    result.current.mutate({ thirdParty: true });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: llmKeys.optIn() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: llmKeys.aiNotice() });
  });
});
