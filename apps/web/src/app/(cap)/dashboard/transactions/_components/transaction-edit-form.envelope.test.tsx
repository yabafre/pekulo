import { describe, expect, test, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

// L25 (2026-05-20): vi.hoisted lets the per-test mock fn survive the
// vi.mock factory's hoist so we can call mockResolvedValueOnce later.
const { updateTransactionMock } = vi.hoisted(() => ({
  updateTransactionMock: vi.fn(),
}));
vi.mock("../_actions/transactions-actions", () => ({
  createTransaction: vi.fn(),
  updateTransaction: updateTransactionMock,
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
  createdAt: "2026-05-15T10:00:00.000Z",
};

describe("TransactionEditForm envelope (AC-3/AC-13/AC-14)", () => {
  test("no-op submit short-circuits client-side (no SA call, inline error)", async () => {
    const onSuccess = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole, findAllByText } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionEditForm transaction={fixtureTx} onSuccess={onSuccess} />
      </QueryClientProvider>,
    );

    fireEvent.submit(getByRole("form", { name: "Modifier la transaction" }));

    await findAllByText(/Aucune modification/);
    expect(updateTransactionMock).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  test("ok:true — SA called with only the changed fields, onSuccess fires", async () => {
    updateTransactionMock.mockResolvedValueOnce({
      ok: true,
      transaction: { ...fixtureTx, amount: 99 },
    });
    const onSuccess = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByLabelText, getByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionEditForm transaction={fixtureTx} onSuccess={onSuccess} />
      </QueryClientProvider>,
    );

    fireEvent.change(getByLabelText(/Montant/), { target: { value: "99" } });
    fireEvent.submit(getByRole("form", { name: "Modifier la transaction" }));

    await waitFor(() => expect(updateTransactionMock).toHaveBeenCalledTimes(1));
    const patch = updateTransactionMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(patch.id).toBe(fixtureTx.id);
    expect(patch.amount).toBe(99);
    // AC-3: only the changed field is sent — `label`, `category`, etc. are
    // OMITTED from the patch (not just equal to the original).
    expect(patch.label).toBeUndefined();
    expect(patch.category).toBeUndefined();
    expect(patch.type).toBeUndefined();
    expect(patch.occurredOn).toBeUndefined();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  test("ok:false TRANSACTION_NOT_FOUND — inline error renders, onSuccess does NOT fire", async () => {
    updateTransactionMock.mockResolvedValueOnce({
      ok: false,
      code: "TRANSACTION_NOT_FOUND",
      message: "Transaction introuvable",
    });
    const onSuccess = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByLabelText, getByRole, findAllByText } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionEditForm transaction={fixtureTx} onSuccess={onSuccess} />
      </QueryClientProvider>,
    );

    fireEvent.change(getByLabelText(/Montant/), { target: { value: "42" } });
    fireEvent.submit(getByRole("form", { name: "Modifier la transaction" }));

    await waitFor(() => expect(updateTransactionMock).toHaveBeenCalledTimes(1));
    expect(onSuccess).not.toHaveBeenCalled();
    await findAllByText(/Transaction introuvable/);
  });
});
