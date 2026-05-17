import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";
import { accountsKeys } from "@/lib/zapaction/keys";

vi.mock("@/lib/actions/accounts-actions", () => ({
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
  recordBalanceChange: vi.fn(),
}));

import { AccountsSection } from "./accounts-section";

// AC-10 (verbatim from docs/stories/2-3-accounts-ui.md:29):
//   axe-core reports zero violations on accounts-section.tsx.
describe("AccountsSection a11y (AC-10)", () => {
  test("no axe violations with 2 accounts", async () => {
    const client = new QueryClient();
    client.setQueryData(accountsKeys.list(), [
      {
        id: "acc_aaaaaaaaaaaaaaaaaaaaa",
        userId: "00000000-0000-0000-0000-000000000001",
        label: "Livret A",
        type: "livret",
        currency: "EUR",
        cashBalance: 5_000,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "acc_bbbbbbbbbbbbbbbbbbbbb",
        userId: "00000000-0000-0000-0000-000000000001",
        label: "PEA Bourso",
        type: "pea",
        currency: "EUR",
        cashBalance: 45_200,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const { container } = renderWithTamagui(
      <QueryClientProvider client={client}>
        <AccountsSection />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
