import { beforeEach, describe, expect, test, vi } from "vitest";
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

describe("RentalForm envelope (AC-3 + AC-4)", () => {
  beforeEach(() => {
    attachRentalMock.mockReset();
    updateRentalMock.mockReset();
  });

  test("ok:true (attach) — SA called once with coerced payload, onSuccess fires once", async () => {
    attachRentalMock.mockResolvedValueOnce({ ok: true, rental: FAKE_RENTAL });

    const onSuccess = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <RentalForm property={FAKE_PROPERTY} rental={null} mode="attach" onSuccess={onSuccess} />
      </QueryClientProvider>,
    );

    fireEvent.submit(getByRole("form", { name: "Ajouter un loyer" }));

    await waitFor(() => expect(attachRentalMock).toHaveBeenCalledTimes(1));
    const call = attachRentalMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.propertyId).toBe("res_test");
    expect(typeof call.monthlyRent).toBe("number");
    expect(typeof call.monthlyCharges).toBe("number");
    expect(typeof call.furnished).toBe("boolean");

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  test("ok:true (update) — SA called once with coerced payload, onSuccess fires once", async () => {
    updateRentalMock.mockResolvedValueOnce({ ok: true, rental: FAKE_RENTAL });

    const onSuccess = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <RentalForm
          property={FAKE_PROPERTY}
          rental={FAKE_RENTAL}
          mode="update"
          onSuccess={onSuccess}
        />
      </QueryClientProvider>,
    );

    fireEvent.submit(getByRole("form", { name: "Modifier le loyer" }));

    await waitFor(() => expect(updateRentalMock).toHaveBeenCalledTimes(1));
    const call = updateRentalMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.propertyId).toBe("res_test");
    expect(call.monthlyRent).toBe(800);
    expect(call.monthlyCharges).toBe(50);
    expect(call.furnished).toBe(false);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

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
