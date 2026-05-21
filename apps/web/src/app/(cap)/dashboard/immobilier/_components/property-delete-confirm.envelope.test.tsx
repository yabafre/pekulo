import { describe, expect, test, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RealEstate } from "@pekulo/types";
import { renderWithTamagui } from "../../../../../../test/setup";

const { deletePropertyMock } = vi.hoisted(() => ({ deletePropertyMock: vi.fn() }));
vi.mock("../_actions/realestate-actions", () => ({
  deleteProperty: deletePropertyMock,
}));

import { PropertyDeleteConfirm } from "./property-delete-confirm";

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

describe("PropertyDeleteConfirm envelope (AC-4)", () => {
  test("REALESTATE_NOT_FOUND surfaces role=alert FR message", async () => {
    deletePropertyMock.mockResolvedValueOnce({
      ok: false,
      code: "REALESTATE_NOT_FOUND",
      message: "missing",
    });

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole, findByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <PropertyDeleteConfirm property={FAKE_PROPERTY} open onOpenChange={() => {}} />
      </QueryClientProvider>,
    );

    fireEvent.click(getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(deletePropertyMock).toHaveBeenCalledTimes(1));

    const alert = await findByRole("alert");
    expect(alert.textContent ?? "").toContain("introuvable");
  });
});
