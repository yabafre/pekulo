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

  test("11-5 AC-1 — stays visible after markAiNotice refetch (seen: true) until user clicks dismiss", async () => {
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    const { rerender } = renderWithTamagui(<AiTransparencyNotice />);
    expect(await screen.findByRole("note")).toBeInTheDocument();

    // Simulate the query cache refetching `{ seen: true }` after markAiNotice settles
    aiNoticeMock.mockReturnValue({ data: { seen: true }, isLoading: false });
    rerender(<AiTransparencyNotice />);
    expect(screen.getByRole("note")).toBeInTheDocument();

    // Clicking the dismiss button hides the notice
    fireEvent.click(screen.getByTestId("ai-transparency-notice-dismiss"));
    expect(screen.queryByRole("note")).toBeNull();
  });

  test("11-5 AC-2 — re-shows the notice after opt-out → opt-in resets server seen to false", async () => {
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    const { rerender } = renderWithTamagui(<AiTransparencyNotice />);
    expect(await screen.findByRole("note")).toBeInTheDocument();
    expect(markMutate).toHaveBeenCalledTimes(1);

    // Server marks seen + user dismisses the banner
    aiNoticeMock.mockReturnValue({ data: { seen: true }, isLoading: false });
    fireEvent.click(screen.getByTestId("ai-transparency-notice-dismiss"));
    expect(screen.queryByRole("note")).toBeNull();

    // User opts out then opts back in → server resets seen to false
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    rerender(<AiTransparencyNotice />);
    expect(await screen.findByRole("note")).toBeInTheDocument();
    await waitFor(() => expect(markMutate).toHaveBeenCalledTimes(2));
  });

  test("11-5 AC-3 — LlmOptInToggle renders the AI transparency intro paragraph above the toggle", async () => {
    optInMock.mockReturnValue({ data: { thirdParty: false }, isLoading: false, error: null });
    renderWithTamagui(<LlmOptInToggle />);
    expect(await screen.findByText(fr.llm.optIn.intro)).toBeInTheDocument();
    expect(screen.getByText(fr.llm.optIn.toggleLabel)).toBeInTheDocument();
  });

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
