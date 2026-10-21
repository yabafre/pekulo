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

// AC-2 (verbatim from docs/stories/11-5-ai-transparency-notice.md:15):
//   Given I have already seen the AI transparency notice, When my third-party
//   AI model preference transitions from opted-out to opted-in (including after
//   an opt-in → opt-out → opt-in cycle), Then the server resets my AI
//   transparency notice seen status (whereas opting out or repeating an
//   already-enabled opt-in preserves the seen status), the client cache for the
//   AI notice is invalidated, and the notice is re-shown on the next user-visible
//   AI suggestion without requiring a hard page reload.
// AC-4 (verbatim from docs/stories/6-3-llm-opt-in.md:22) is also covered by the
// existing llmKeys.optIn() assertion below.
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
