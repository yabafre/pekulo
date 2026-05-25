import { describe, expect, test, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

const { deleteTransactionMock } = vi.hoisted(() => ({
  deleteTransactionMock: vi.fn(),
}));
vi.mock("../_actions/transactions-actions", () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: deleteTransactionMock,
  listTransactions: vi.fn(),
}));

import { TransactionDeleteConfirm } from "./transaction-delete-confirm";
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

describe("TransactionDeleteConfirm envelope (AC-4)", () => {
  test("ok:true — SA called with id, dialog closes via onOpenChange(false)", async () => {
    deleteTransactionMock.mockResolvedValueOnce({ ok: true });
    const onOpenChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionDeleteConfirm transaction={fixtureTx} open onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    );

    fireEvent.click(getByRole("button", { name: /^Supprimer$/ }));

    await waitFor(() => expect(deleteTransactionMock).toHaveBeenCalledTimes(1));
    expect(deleteTransactionMock.mock.calls[0]?.[0]).toEqual({ id: fixtureTx.id });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  test("ok:false TRANSACTION_NOT_FOUND — inline alert renders, dialog stays open", async () => {
    deleteTransactionMock.mockResolvedValueOnce({
      ok: false,
      code: "TRANSACTION_NOT_FOUND",
      message: "déjà supprimée",
    });
    const onOpenChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole, findByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionDeleteConfirm transaction={fixtureTx} open onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    );

    fireEvent.click(getByRole("button", { name: /^Supprimer$/ }));

    await waitFor(() => expect(deleteTransactionMock).toHaveBeenCalledTimes(1));
    const alert = await findByRole("alert");
    expect(alert.textContent).toMatch(/introuvable|déjà supprimée|Recharge/);
    // Dialog should not close on the not-found envelope branch — let the
    // user read the message and choose to dismiss themselves.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
