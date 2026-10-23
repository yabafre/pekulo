import { afterEach, describe, expect, test, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { renderWithTamagui } from "../../../../../../test/setup";
import fr from "../../../../../../messages/fr.json";
import en from "../../../../../../messages/en.json";

const { aiNoticeMock, markMutate, optInMock, setOptInMutate } = vi.hoisted(() => ({
  aiNoticeMock: vi.fn(),
  markMutate: vi.fn(),
  optInMock: vi.fn(),
  setOptInMutate: vi.fn(),
}));
vi.mock("../_hooks/use-ai-notice", () => ({
  useAiNotice: () => aiNoticeMock(),
  useMarkAiNotice: () => ({ mutate: markMutate, isPending: false }),
}));
vi.mock("../_hooks/use-llm-opt-in", () => ({
  useLlmOptIn: () => optInMock(),
  useSetLlmOptIn: () => ({ mutate: setOptInMutate, isPending: false }),
}));

import { AiTransparencyNotice } from "./ai-transparency-notice";
import { LlmOptInToggle } from "./llm-opt-in-toggle";

afterEach(() => {
  aiNoticeMock.mockReset();
  markMutate.mockReset();
  optInMock.mockReset();
  setOptInMutate.mockReset();
});

describe("AiTransparencyNotice (6-4 AC-3 + 6-7 AC-2 + 11-5 AC-1/AC-2/AC-3/AC-4)", () => {
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

  test("6-7 — the copy states categories can be applied automatically and stay editable (AC-2)", async () => {
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    renderWithTamagui(<AiTransparencyNotice />);
    const note = await screen.findByRole("note");
    expect(note.textContent).toContain("appliquées automatiquement");
    expect(note.textContent).toContain("modifiable");
  });

  // AC-1 (verbatim from docs/stories/11-5-ai-transparency-notice.md:14):
  //   Given I have not yet seen the AI transparency notice and at least one
  //   pending AI category suggestion or auto-applied AI categorisation is
  //   visible on the Transactions screen, When the list renders, Then the AI
  //   transparency notice appears once, records my seen status on the server,
  //   remains visible on screen after the seen status refreshes, and can be
  //   explicitly dismissed via a keyboard-accessible control. On subsequent
  //   visits (while my seen status remains set), the notice does not appear.
  test("11-5 AC-1 — stays visible after markAiNotice refetch (seen: true) until user clicks dismiss", async () => {
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    const { rerender } = renderWithTamagui(<AiTransparencyNotice />);
    expect(await screen.findByRole("note")).toBeInTheDocument();

    // Simulate the query cache refetching `{ seen: true }` after markAiNotice settles
    aiNoticeMock.mockReturnValue({ data: { seen: true }, isLoading: false });
    rerender(<AiTransparencyNotice />);
    expect(screen.getByRole("note")).toBeInTheDocument();

    // Dismiss button carries font_body (lesson 2026-07-13) and hides the notice on click
    const dismissBtn = screen.getByTestId("ai-transparency-notice-dismiss");
    expect(dismissBtn).toHaveClass("font_body");
    fireEvent.click(dismissBtn);
    expect(screen.queryByRole("note")).toBeNull();
  });

  // AC-2 (verbatim from docs/stories/11-5-ai-transparency-notice.md:15):
  //   Given I have already seen the AI transparency notice, When my third-party
  //   AI model preference transitions from opted-out to opted-in (including after
  //   an opt-in → opt-out → opt-in cycle), Then the server resets my AI
  //   transparency notice seen status (whereas opting out or repeating an
  //   already-enabled opt-in preserves the seen status), the client cache for the
  //   AI notice is invalidated, and the notice is re-shown on the next user-visible
  //   AI suggestion without requiring a hard page reload.
  test("11-5 AC-2 — re-shows the notice after opt-out → opt-in resets server seen to false (including after fast dismiss before markAiNotice refetch)", async () => {
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    const { rerender } = renderWithTamagui(<AiTransparencyNotice />);
    expect(await screen.findByRole("note")).toBeInTheDocument();
    expect(markMutate).toHaveBeenCalledTimes(1);

    // User clicks dismiss BEFORE the markAiNotice refetch resolves (data still seen: false)
    fireEvent.click(screen.getByTestId("ai-transparency-notice-dismiss"));
    expect(screen.queryByRole("note")).toBeNull();

    // Intermediate re-render while seen is still false (or loading) keeps the banner suppressed
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    rerender(<AiTransparencyNotice />);
    expect(screen.queryByRole("note")).toBeNull();
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: true });
    rerender(<AiTransparencyNotice />);
    expect(screen.queryByRole("note")).toBeNull();

    // Server refetch confirms seen: true → stays hidden and re-arms suppression
    aiNoticeMock.mockReturnValue({ data: { seen: true }, isLoading: false });
    rerender(<AiTransparencyNotice />);
    expect(screen.queryByRole("note")).toBeNull();

    // User opts out then opts back in → server resets seen to false
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    rerender(<AiTransparencyNotice />);
    expect(await screen.findByRole("note")).toBeInTheDocument();
    await waitFor(() => expect(markMutate).toHaveBeenCalledTimes(2));
  });

  // AC-3 (verbatim from docs/stories/11-5-ai-transparency-notice.md:16):
  //   Given I open the Settings screen, When the Artificial Intelligence section
  //   renders, Then it displays an introductory transparency explanation above
  //   the third-party AI model toggle informing me that transactions are
  //   categorised automatically by default on-device or on the private server and
  //   that no data leaves that perimeter unless third-party models are explicitly
  //   enabled, and all AI notice and settings copy is localised in both French
  //   and English with complete key parity.
  test("11-5 AC-3 — LlmOptInToggle renders the AI transparency intro paragraph above the toggle", async () => {
    optInMock.mockReturnValue({ data: { thirdParty: false }, isLoading: false, error: null });
    renderWithTamagui(<LlmOptInToggle />);
    expect(await screen.findByText(fr.llm.optIn.intro)).toBeInTheDocument();
    expect(screen.getByText(fr.llm.optIn.toggleLabel)).toBeInTheDocument();
  });

  // AC-3 (same verbatim quote as above) — the "complete key parity" clause.
  test("11-5 AC-3 — ships identical llm.aiNotice and llm.optIn keys in fr and en", () => {
    expect(Object.keys(en.llm.aiNotice).sort()).toEqual(Object.keys(fr.llm.aiNotice).sort());
    expect(Object.keys(en.llm.optIn).sort()).toEqual(Object.keys(fr.llm.optIn).sort());
    for (const key of Object.keys(fr.llm.aiNotice)) {
      expect((en.llm.aiNotice as Record<string, string>)[key]).toBeTruthy();
    }
    for (const key of Object.keys(fr.llm.optIn)) {
      expect((en.llm.optIn as Record<string, string>)[key]).toBeTruthy();
    }
  });

  // AC-4 (verbatim from docs/stories/11-5-ai-transparency-notice.md:17):
  //   Given two distinct users User A and User B, When User A marks the AI
  //   transparency notice as seen or transitions from opt-out to opt-in, Then
  //   User B's seen status and third-party opt-in preference remain completely
  //   unaffected, and automated accessibility checks report zero WCAG 2.2 AA
  //   violations on both the AI transparency notice and the Artificial
  //   Intelligence settings section.
  // The two-user half is asserted in llm-ai-notice.test.ts; this test covers the
  // accessibility half.
  test("11-5 AC-4 — has zero axe violations on AiTransparencyNotice and LlmOptInToggle", async () => {
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    optInMock.mockReturnValue({ data: { thirdParty: false }, isLoading: false, error: null });
    const { container } = renderWithTamagui(
      <div>
        <AiTransparencyNotice />
        <LlmOptInToggle />
      </div>,
    );
    expect(await screen.findByRole("note")).toBeInTheDocument();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
