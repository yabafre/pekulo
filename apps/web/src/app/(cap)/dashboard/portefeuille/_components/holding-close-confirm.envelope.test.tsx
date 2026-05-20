import { describe, expect, test, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Holding } from "@pekulo/validators";
import { renderWithTamagui } from "../../../../../../test/setup";

const { closeHoldingMock } = vi.hoisted(() => ({ closeHoldingMock: vi.fn() }));
vi.mock("../_actions/holdings-actions", () => ({
  closeHolding: closeHoldingMock,
}));

import { HoldingCloseConfirm } from "./holding-close-confirm";

const FAKE_HOLDING: Holding = {
  id: "hld_test",
  userId: "00000000-0000-0000-0000-000000000000",
  accountId: "acc_test",
  kind: "etf",
  ticker: "CW8",
  isin: null,
  label: "Amundi CW8",
  currency: "EUR",
  quantity: 10,
  avgCost: 24.5,
  lastPrice: 26.1,
  lastPriceAt: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  closedAt: null,
};

describe("HoldingCloseConfirm envelope handling (AC-3 + AC-8)", () => {
  test("HOLDING_NOT_FOUND envelope surfaces a localised role=alert", async () => {
    closeHoldingMock.mockResolvedValueOnce({
      ok: false,
      code: "HOLDING_NOT_FOUND",
      message: "Holding gone",
    });

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole, findByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <HoldingCloseConfirm holding={FAKE_HOLDING} open onOpenChange={() => {}} />
      </QueryClientProvider>,
    );

    fireEvent.click(getByRole("button", { name: "Marquer comme clôturé" }));

    await waitFor(() => expect(closeHoldingMock).toHaveBeenCalledTimes(1));
    const alert = await findByRole("alert");
    expect(alert.textContent ?? "").toContain("introuvable");
  });
});
