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

// AC-4 (verbatim from docs/stories/6-3-llm-opt-in.md:22):
//   Given the Paramètres page, When it renders, Then an "Intelligence
//   artificielle" section shows a toggle reflecting the stored opt-in (off by
//   default), and toggling it persists the new value so it survives a page
//   reload. Verified visually at GREEN.
// This test covers the "survives a page reload" mechanism: the mutation
// invalidates llmKeys.optIn() so the read refetches the persisted value.
describe("useSetLlmOptIn (AC-4)", () => {
  test("success → invalidates llmKeys.optIn()", async () => {
    setMock.mockReset().mockResolvedValueOnce({ thirdParty: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(llmKeys.optIn(), { thirdParty: false });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSetLlmOptIn(), { wrapper });
    result.current.mutate({ thirdParty: true });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: llmKeys.optIn() });
  });
});
