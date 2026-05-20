import { describe, expect, test, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Account } from "@pekulo/validators";
import { renderWithTamagui } from "../../../../../../test/setup";

const { createHoldingMock } = vi.hoisted(() => ({ createHoldingMock: vi.fn() }));
vi.mock("../_actions/holdings-actions", () => ({
  createHolding: createHoldingMock,
}));

import { HoldingCreateForm } from "./holding-create-form";

const FAKE_ACCOUNT: Account = {
  id: "acc_test_pea",
  userId: "00000000-0000-0000-0000-000000000000",
  type: "pea",
  label: "PEA test",
  cashBalance: 0,
  currency: "EUR",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("HoldingCreateForm envelope handling (AC-4 + AC-8)", () => {
  test("ACCOUNT_NOT_FOUND envelope surfaces a localised role=alert", async () => {
    createHoldingMock.mockResolvedValueOnce({
      ok: false,
      code: "ACCOUNT_NOT_FOUND",
      message: "Account acc_x not found",
    });

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByLabelText, getByRole, findByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <HoldingCreateForm accounts={[FAKE_ACCOUNT]} />
      </QueryClientProvider>,
    );

    fireEvent.change(getByLabelText("Libellé"), { target: { value: "Amundi CW8" } });
    fireEvent.change(getByLabelText("Quantité"), { target: { value: "10" } });
    fireEvent.change(getByLabelText("Prix unitaire moyen"), { target: { value: "24.5" } });

    fireEvent.submit(getByRole("form", { name: "Ajouter un placement" }));

    await waitFor(() => expect(createHoldingMock).toHaveBeenCalledTimes(1));
    const alert = await findByRole("alert");
    expect(alert.textContent ?? "").toContain("Compte introuvable");
  });
});
