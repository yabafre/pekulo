import { afterEach, describe, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithTamagui } from "../../../../../../test/setup";

// AC-3 (story 6-4 / DR-12): the AI transparency notice appears exactly once and
// its "seen" state is server-flagged. The server side is covered by
// llm-ai-notice.test.ts; this exercises the CLIENT once-logic the section
// envelope/a11y tests mock away (they stub this component to () => null).
const { aiNoticeMock, markMutate } = vi.hoisted(() => ({
  aiNoticeMock: vi.fn(),
  markMutate: vi.fn(),
}));
vi.mock("../_hooks/use-ai-notice", () => ({
  useAiNotice: () => aiNoticeMock(),
  useMarkAiNotice: () => ({ mutate: markMutate, isPending: false }),
}));

import { AiTransparencyNotice } from "./ai-transparency-notice";

afterEach(() => {
  aiNoticeMock.mockReset();
  markMutate.mockReset();
});

describe("AiTransparencyNotice (AC-3 — shown exactly once, server-flagged)", () => {
  test("renders nothing when the server flag says it was already seen", () => {
    aiNoticeMock.mockReturnValue({ data: { seen: true }, isLoading: false });
    renderWithTamagui(<AiTransparencyNotice />);
    expect(screen.queryByRole("note")).toBeNull();
    expect(markMutate).not.toHaveBeenCalled();
  });

  test("renders nothing while the read is loading (no flash for returning users)", () => {
    aiNoticeMock.mockReturnValue({ data: undefined, isLoading: true });
    renderWithTamagui(<AiTransparencyNotice />);
    expect(screen.queryByRole("note")).toBeNull();
    expect(markMutate).not.toHaveBeenCalled();
  });

  test("shows the notice and marks it seen exactly once when never seen before", async () => {
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    renderWithTamagui(<AiTransparencyNotice />);
    expect(await screen.findByRole("note")).toBeInTheDocument();
    await waitFor(() => expect(markMutate).toHaveBeenCalledTimes(1));
  });
});
