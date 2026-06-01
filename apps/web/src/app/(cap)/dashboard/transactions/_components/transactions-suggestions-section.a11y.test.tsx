import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { renderWithTamagui } from "../../../../../../test/setup";

vi.mock("../_hooks/use-pending-suggestions", () => ({
  usePendingSuggestions: () => ({
    data: {
      items: [
        {
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
        },
      ],
    },
    isLoading: false,
    error: null,
  }),
}));
vi.mock("../_hooks/use-confirm-categorisation", () => ({
  useConfirmCategorisation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../_accounts/_hooks/use-accounts", () => ({ useAccounts: () => ({ data: [] }) }));
vi.mock("../../_llm/_components/ai-transparency-notice", () => ({
  AiTransparencyNotice: () => null,
}));

import { TransactionsSuggestionsSection } from "./transactions-suggestions-section";

describe("TransactionsSuggestionsSection a11y (AC-6)", () => {
  test("no axe violations with a pending suggestion", async () => {
    const { container } = renderWithTamagui(<TransactionsSuggestionsSection />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
