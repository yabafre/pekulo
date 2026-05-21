import { describe, expect, test, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RealEstate } from "@pekulo/types";
import { renderWithTamagui } from "../../../../../../test/setup";

const { attachRentalMock, updateRentalMock } = vi.hoisted(() => ({
  attachRentalMock: vi.fn(),
  updateRentalMock: vi.fn(),
}));
vi.mock("../_actions/realestate-actions", () => ({
  attachRental: attachRentalMock,
  updateRental: updateRentalMock,
}));

import { RentalForm } from "./rental-form";

const FAKE_PROPERTY: RealEstate = {
  id: "res_test",
  userId: "00000000-0000-0000-0000-000000000000",
  label: "Studio",
  propertyType: "locatif",
  currentValuation: 100_000,
  lastValuedOn: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("RentalForm envelope (AC-4)", () => {
  test("RENTAL_ALREADY_ATTACHED surfaces role=alert FR message", async () => {
    attachRentalMock.mockResolvedValueOnce({
      ok: false,
      code: "RENTAL_ALREADY_ATTACHED",
      message: "already attached",
    });

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole, findByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <RentalForm property={FAKE_PROPERTY} rental={null} mode="attach" />
      </QueryClientProvider>,
    );

    fireEvent.submit(getByRole("form", { name: "Ajouter un loyer" }));
    await waitFor(() => expect(attachRentalMock).toHaveBeenCalledTimes(1));

    const alert = await findByRole("alert");
    expect(alert.textContent ?? "").toContain("déjà un loyer");
  });
});
