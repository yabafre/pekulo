import { describe, expect, test, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Holding } from "@pekulo/validators";
import { renderWithTamagui } from "../../../../../../test/setup";

const { recordLotMock } = vi.hoisted(() => ({ recordLotMock: vi.fn() }));
vi.mock("../_actions/holdings-actions", () => ({
  recordLot: recordLotMock,
}));

import { LotForm } from "./lot-form";

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

function fillLotForm(getByLabelText: (s: string) => HTMLElement) {
  fireEvent.change(getByLabelText("Quantité"), { target: { value: "2" } });
  fireEvent.change(getByLabelText("Prix unitaire"), { target: { value: "26.1" } });
}

describe("LotForm envelope handling (AC-2 + AC-8)", () => {
  test("HOLDING_NOT_FOUND envelope surfaces a localised role=alert", async () => {
    recordLotMock.mockResolvedValueOnce({
      ok: false,
      code: "HOLDING_NOT_FOUND",
      message: "Holding gone",
    });

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByLabelText, getByRole, findByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <LotForm holding={FAKE_HOLDING} open onOpenChange={() => {}} />
      </QueryClientProvider>,
    );

    fillLotForm(getByLabelText);
    fireEvent.submit(getByRole("form", { name: "Enregistrer un lot" }));

    await waitFor(() => expect(recordLotMock).toHaveBeenCalledTimes(1));
    const alert = await findByRole("alert");
    expect(alert.textContent ?? "").toContain("introuvable");
  });

  test("HOLDING_CLOSED envelope surfaces a localised role=alert", async () => {
    recordLotMock.mockResolvedValueOnce({
      ok: false,
      code: "HOLDING_CLOSED",
      message: "Holding closed",
    });

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByLabelText, getByRole, findByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <LotForm holding={FAKE_HOLDING} open onOpenChange={() => {}} />
      </QueryClientProvider>,
    );

    fillLotForm(getByLabelText);
    fireEvent.submit(getByRole("form", { name: "Enregistrer un lot" }));

    await waitFor(() => expect(recordLotMock).toHaveBeenCalledTimes(1));
    const alert = await findByRole("alert");
    expect(alert.textContent ?? "").toContain("clôturé");
  });
});
