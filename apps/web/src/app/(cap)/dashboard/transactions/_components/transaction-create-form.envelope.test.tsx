import { describe, expect, test, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

// L25 (2026-05-20): use vi.hoisted to share the mock fn between vi.mock
// hoisted phase and per-test reassignment (mockResolvedValueOnce).
const { createTransactionMock, listAccountsMock } = vi.hoisted(() => ({
  createTransactionMock: vi.fn(),
  listAccountsMock: vi.fn(async () => [
    {
      id: "acc_aaa111111111111111111",
      userId: "00000000-0000-0000-0000-000000000000",
      label: "Compte test",
      type: "livret" as const,
      currency: "EUR" as const,
      cashBalance: 1000,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
}));
vi.mock("../_actions/transactions-actions", () => ({
  createTransaction: createTransactionMock,
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  listTransactions: vi.fn(),
}));
vi.mock("../../_accounts/_actions/accounts-actions", () => ({
  listAccounts: listAccountsMock,
}));

import { TransactionCreateForm } from "./transaction-create-form";

// AC-13 / AC-14 — envelope narrowing path.
// AC-2 (verbatim, story 5-1:18):
//   Given user A owns acc_aaa… and user B owns acc_bbb…, When A calls
//   createTransaction({ accountId: "acc_bbb…", … }), Then the service
//   rejects with ACCOUNT_NOT_FOUND.
describe("TransactionCreateForm envelope (AC-2/AC-13/AC-14)", () => {
  test("ok:true — SA called with trimmed/coerced payload, onSuccess fires", async () => {
    createTransactionMock.mockResolvedValueOnce({
      ok: true,
      transaction: {
        id: "tx_aaaaaaaaaaaaaaaaaaaaa",
        accountId: "acc_aaa111111111111111111",
        occurredOn: "2026-05-15",
        label: "Courses",
        amount: 87.5,
        type: "outflow",
        category: "courses",
        isImprevu: false,
        notes: null,
        createdAt: "2026-05-15T10:00:00.000Z",
      },
    });

    const onSuccess = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByLabelText, getByRole, findAllByText } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionCreateForm onSuccess={onSuccess} />
      </QueryClientProvider>,
    );

    // Wait for accounts to load so the form's accountId defaults populate.
    await findAllByText(/Compte test/);

    fireEvent.change(getByLabelText(/Libellé/), { target: { value: "  Courses  " } });
    fireEvent.change(getByLabelText(/Montant/), { target: { value: "87.5" } });
    fireEvent.submit(getByRole("form", { name: "Ajouter une transaction" }));

    await waitFor(() => expect(createTransactionMock).toHaveBeenCalledTimes(1));
    const call = createTransactionMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.label).toBe("Courses");
    expect(call.amount).toBe(87.5);
    expect(call.type).toBe("outflow");
    expect(call.accountId).toBe("acc_aaa111111111111111111");

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  test("ok:false ACCOUNT_NOT_FOUND — inline error renders, onSuccess does NOT fire", async () => {
    createTransactionMock.mockResolvedValueOnce({
      ok: false,
      code: "ACCOUNT_NOT_FOUND",
      message: "Compte introuvable",
    });
    const onSuccess = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByLabelText, getByRole, findAllByText } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionCreateForm onSuccess={onSuccess} />
      </QueryClientProvider>,
    );
    await findAllByText(/Compte test/);

    fireEvent.change(getByLabelText(/Libellé/), { target: { value: "Test" } });
    fireEvent.change(getByLabelText(/Montant/), { target: { value: "10" } });
    fireEvent.submit(getByRole("form", { name: "Ajouter une transaction" }));

    await waitFor(() => expect(createTransactionMock).toHaveBeenCalledTimes(1));
    expect(onSuccess).not.toHaveBeenCalled();
    await findAllByText(/Compte introuvable/);
  });
});
