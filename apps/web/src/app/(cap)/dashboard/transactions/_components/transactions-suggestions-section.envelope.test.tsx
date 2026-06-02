import { describe, expect, test, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithTamagui } from "../../../../../../test/setup";

const { confirmMock, pendingMock } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
  pendingMock: vi.fn(),
}));
vi.mock("../_hooks/use-pending-suggestions", () => ({
  usePendingSuggestions: () => pendingMock(),
}));
vi.mock("../_hooks/use-confirm-categorisation", () => ({
  useConfirmCategorisation: () => ({ mutate: confirmMock, isPending: false }),
}));
vi.mock("../../_accounts/_hooks/use-accounts", () => ({ useAccounts: () => ({ data: [] }) }));
vi.mock("../../_llm/_components/ai-transparency-notice", () => ({
  AiTransparencyNotice: () => null,
}));
vi.mock("./month-scope-context", () => ({
  useMonthScope: () => ({
    month: "2026-02",
    summary: undefined,
    isLoading: false,
    setMonth: () => {},
    goPrev: () => {},
    goNext: () => {},
  }),
}));

import { TransactionsSuggestionsSection } from "./transactions-suggestions-section";

const pendingTx = {
  id: "tx_aaaaaaaaaaaaaaaaaaaaa",
  accountId: "acc_aaaaaaaaaaaaaaaaaaaaa",
  occurredOn: "2026-05-01",
  label: "Carrefour",
  amount: 42,
  type: "outflow",
  category: "autre",
  isImprevu: false,
  notes: null,
  transferPairId: null,
  suggestedCategory: "courses",
  suggestedConfidence: 0.9,
  suggestedRoute: "ollama",
  suggestedAt: "2026-05-01T00:00:00.000Z",
  createdAt: "2026-05-01T00:00:00.000Z",
};

describe("TransactionsSuggestionsSection (6-4)", () => {
  // AC-5 (verbatim from story 6-4:23): Given no pending suggestions, the section
  // shows the Check-icon PekuloEmptyState "Tout est catégorisé".
  test("AC-5 empty → 'Tout est catégorisé'", async () => {
    pendingMock.mockReturnValue({ data: { items: [] }, isLoading: false, error: null });
    renderWithTamagui(<TransactionsSuggestionsSection />);
    expect(await screen.findByText("Tout est catégorisé")).toBeTruthy();
  });

  // AC-1 (verbatim from story 6-4:19): tapping ✓ Confirmer persists the suggested
  // category — the row sends { id, category: <suggested> } to the server.
  test("AC-1 confirm → mutate({ id, category: suggested })", async () => {
    pendingMock.mockReturnValue({ data: { items: [pendingTx] }, isLoading: false, error: null });
    renderWithTamagui(<TransactionsSuggestionsSection />);
    // Query by visible text → closest <button>. getByRole("button") is flaky on
    // Tamagui styled.button under happy-dom (dom-accessibility-api name compute),
    // though axe sees the buttons fine (a11y suite passes). Clicking the pill
    // text bubbles to the button onClick.
    const confirmPill = await screen.findByText("✓ Confirmer");
    fireEvent.click(confirmPill.closest("button")!);
    expect(confirmMock).toHaveBeenCalledWith(
      { id: pendingTx.id, category: "courses" },
      expect.anything(),
    );
  });

  // AC-2 (verbatim from story 6-4:20): tapping Modifier opens the CategoryPicker
  // dialog; saving sends the chosen category (override decided server-side).
  test("AC-2 override → open picker, submit → mutate with chosen category", async () => {
    pendingMock.mockReturnValue({ data: { items: [pendingTx] }, isLoading: false, error: null });
    renderWithTamagui(<TransactionsSuggestionsSection />);
    fireEvent.click((await screen.findByText("Modifier")).closest("button")!);
    // CategoryPicker defaults to the suggested value; submit confirms it as the
    // final category (the override path is exercised server-side by T8). Submit
    // via the form (not the button) — happy-dom doesn't reliably fire the parent
    // onSubmit on a button click (lesson 2026-05-20).
    const submit = await screen.findByText("Enregistrer la catégorie");
    fireEvent.submit(submit.closest("form")!);
    expect(confirmMock).toHaveBeenCalled();
  });

  // AC-3 (quick-spec 2026-06-01): 10/page with numbered pagination — when the
  // server reports more than one page, PekuloPagination renders.
  test("AC-3 pagination → numbered nav appears when totalCount exceeds the page size", async () => {
    pendingMock.mockReturnValue({
      data: { items: [pendingTx], totalCount: 25, page: 1, pageSize: 10 },
      isLoading: false,
      error: null,
    });
    const { container } = renderWithTamagui(<TransactionsSuggestionsSection />);
    expect(
      await screen.findByRole("navigation", { name: "Pagination des suggestions" }),
    ).toBeTruthy();
    // 25 / 10 → 3 pages; page 3 present, page 4 absent.
    expect(container.querySelector('[aria-label="Page 3"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Page 4"]')).toBeNull();
  });

  // Regression (2026-06-01): navigating to an un-cached page makes `data`
  // briefly undefined → totalCount 0 → pageCount 1. The clamp must NOT fire on
  // that transient (it was bouncing the user back to page 1). Here we assert the
  // undefined/loading branch renders the skeleton — not the empty state — and
  // never surfaces "page 1 of 1" semantics that would strand navigation.
  test("a loading page (data undefined) shows the skeleton, not the empty state", () => {
    pendingMock.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithTamagui(<TransactionsSuggestionsSection />);
    expect(screen.queryByText("Tout est catégorisé")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
