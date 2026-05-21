import { describe, expect, test, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RealEstate } from "@pekulo/types";
import { renderWithTamagui } from "../../../../../../test/setup";

const { attachMortgageMock, updateMortgageMock } = vi.hoisted(() => ({
  attachMortgageMock: vi.fn(),
  updateMortgageMock: vi.fn(),
}));
vi.mock("../_actions/realestate-actions", () => ({
  attachMortgage: attachMortgageMock,
  updateMortgage: updateMortgageMock,
}));

import { MortgageForm } from "./mortgage-form";

const FAKE_PROPERTY: RealEstate = {
  id: "res_test",
  userId: "00000000-0000-0000-0000-000000000000",
  label: "Appartement",
  propertyType: "residence-principale",
  currentValuation: 250_000,
  lastValuedOn: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("MortgageForm envelope (AC-4)", () => {
  test("MORTGAGE_ALREADY_ATTACHED surfaces role=alert FR message", async () => {
    attachMortgageMock.mockResolvedValueOnce({
      ok: false,
      code: "MORTGAGE_ALREADY_ATTACHED",
      message: "already attached",
    });

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole, findByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <MortgageForm property={FAKE_PROPERTY} mortgage={null} mode="attach" />
      </QueryClientProvider>,
    );

    fireEvent.submit(getByRole("form", { name: "Ajouter un crédit" }));
    await waitFor(() => expect(attachMortgageMock).toHaveBeenCalledTimes(1));

    const alert = await findByRole("alert");
    expect(alert.textContent ?? "").toContain("déjà un crédit");
  });

  test("REALESTATE_NOT_FOUND surfaces role=alert FR message", async () => {
    attachMortgageMock.mockResolvedValueOnce({
      ok: false,
      code: "REALESTATE_NOT_FOUND",
      message: "no property",
    });

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole, findByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <MortgageForm property={FAKE_PROPERTY} mortgage={null} mode="attach" />
      </QueryClientProvider>,
    );

    fireEvent.submit(getByRole("form", { name: "Ajouter un crédit" }));
    await waitFor(() => expect(attachMortgageMock).toHaveBeenCalledTimes(1));

    const alert = await findByRole("alert");
    expect(alert.textContent ?? "").toContain("introuvable");
  });
});
