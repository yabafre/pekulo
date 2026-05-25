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

import { TransactionEditForm } from "./transaction-edit-form";
import type { Transaction } from "@pekulo/validators";

const fixtureTx: Transaction = {
  id: "tx_aaaaaaaaaaaaaaaaaaaaa",
  accountId: "acc_aaa111111111111111111",
  occurredOn: "2026-05-15",
  label: "Courses",
  amount: 87.5,
  type: "outflow",
  category: "courses",
  isImprevu: false,
  notes: null,
  transferPairId: null,
  createdAt: "2026-05-15T10:00:00.000Z",
};

describe("TransactionEditForm a11y (AC-13/AC-14)", () => {
  test("zero axe violations", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionEditForm transaction={fixtureTx} />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
