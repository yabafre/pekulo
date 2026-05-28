import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

vi.mock("../_actions/transactions-actions", () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  listTransactions: vi.fn(),
}));
vi.mock("../../_accounts/_actions/accounts-actions", () => ({
  listAccounts: vi.fn(async () => []),
}));

import { TransactionCreateForm } from "./transaction-create-form";

// AC-13 (verbatim from docs/stories/5-1-transactions-record.md:29):
//   Given A is on /dashboard/transactions, When A opens the Ajouter une
//   transaction form, fills valid input + submits, Then the new transaction
//   appears at the top of Récentes within 500 ms.
// AC-14: PekuloFieldError renders the message inline ; no crash, no toast spam.
describe("TransactionCreateForm a11y (AC-13/AC-14)", () => {
  test("zero axe violations", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionCreateForm />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
