import { describe, expect, test, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RealEstate, RealEstateRental } from "@pekulo/types";
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

const FAKE_RENTAL: RealEstateRental = {
  id: "rer_test",
  userId: "00000000-0000-0000-0000-000000000000",
  realEstateId: "res_test",
  monthlyRent: 800,
  monthlyCharges: 50,
  furnished: false,
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

  test("REALESTATE_NOT_FOUND (attach mode) surfaces role=alert FR message", async () => {
    attachRentalMock.mockResolvedValueOnce({
      ok: false,
      code: "REALESTATE_NOT_FOUND",
      message: "no property",
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
    expect(alert.textContent ?? "").toContain("introuvable");
  });

  test("RENTAL_NOT_FOUND (update mode) surfaces role=alert FR message", async () => {
    updateRentalMock.mockResolvedValueOnce({
      ok: false,
      code: "RENTAL_NOT_FOUND",
      message: "no rental",
    });

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole, findByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <RentalForm property={FAKE_PROPERTY} rental={FAKE_RENTAL} mode="update" />
      </QueryClientProvider>,
    );

    fireEvent.submit(getByRole("form", { name: "Modifier le loyer" }));
    await waitFor(() => expect(updateRentalMock).toHaveBeenCalledTimes(1));

    const alert = await findByRole("alert");
    expect(alert.textContent ?? "").toContain("Aucun loyer attaché");
  });

  test("REALESTATE_NOT_FOUND (update mode) surfaces role=alert FR message", async () => {
    updateRentalMock.mockResolvedValueOnce({
      ok: false,
      code: "REALESTATE_NOT_FOUND",
      message: "no property",
    });

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole, findByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <RentalForm property={FAKE_PROPERTY} rental={FAKE_RENTAL} mode="update" />
      </QueryClientProvider>,
    );

    fireEvent.submit(getByRole("form", { name: "Modifier le loyer" }));
    await waitFor(() => expect(updateRentalMock).toHaveBeenCalledTimes(1));

    const alert = await findByRole("alert");
    expect(alert.textContent ?? "").toContain("introuvable");
  });
});
