import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RealEstate, RealEstateMortgage } from "@pekulo/types";
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

const FAKE_MORTGAGE: RealEstateMortgage = {
  id: "rem_test",
  userId: "00000000-0000-0000-0000-000000000000",
  realEstateId: "res_test",
  outstandingPrincipal: 180_000,
  annualRate: 0.025,
  monthlyPayment: 850,
  termMonths: 240,
  startDate: new Date("2023-01-15"),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("MortgageForm envelope (AC-3 + AC-4)", () => {
  beforeEach(() => {
    attachMortgageMock.mockReset();
    updateMortgageMock.mockReset();
  });

  test("ok:true (attach) — SA called once with coerced payload, onSuccess fires once", async () => {
    attachMortgageMock.mockResolvedValueOnce({ ok: true, mortgage: FAKE_MORTGAGE });

    const onSuccess = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <MortgageForm
          property={FAKE_PROPERTY}
          mortgage={null}
          mode="attach"
          onSuccess={onSuccess}
        />
      </QueryClientProvider>,
    );

    fireEvent.submit(getByRole("form", { name: "Ajouter un crédit" }));

    await waitFor(() => expect(attachMortgageMock).toHaveBeenCalledTimes(1));
    const call = attachMortgageMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.propertyId).toBe("res_test");
    expect(typeof call.outstandingPrincipal).toBe("number");
    expect(typeof call.annualRate).toBe("number");
    expect(typeof call.monthlyPayment).toBe("number");
    expect(Number.isInteger(call.termMonths)).toBe(true);
    expect(call.startDate).toBeInstanceOf(Date);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  test("ok:true (update) — SA called once with coerced payload, onSuccess fires once", async () => {
    updateMortgageMock.mockResolvedValueOnce({ ok: true, mortgage: FAKE_MORTGAGE });

    const onSuccess = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <MortgageForm
          property={FAKE_PROPERTY}
          mortgage={FAKE_MORTGAGE}
          mode="update"
          onSuccess={onSuccess}
        />
      </QueryClientProvider>,
    );

    fireEvent.submit(getByRole("form", { name: "Modifier le crédit" }));

    await waitFor(() => expect(updateMortgageMock).toHaveBeenCalledTimes(1));
    const call = updateMortgageMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.propertyId).toBe("res_test");
    expect(call.outstandingPrincipal).toBe(180_000);
    expect(call.annualRate).toBe(0.025);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

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

  test("REALESTATE_NOT_FOUND (attach mode) surfaces role=alert FR message", async () => {
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

  test("MORTGAGE_NOT_FOUND (update mode) surfaces role=alert FR message", async () => {
    updateMortgageMock.mockResolvedValueOnce({
      ok: false,
      code: "MORTGAGE_NOT_FOUND",
      message: "no mortgage",
    });

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole, findByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <MortgageForm property={FAKE_PROPERTY} mortgage={FAKE_MORTGAGE} mode="update" />
      </QueryClientProvider>,
    );

    fireEvent.submit(getByRole("form", { name: "Modifier le crédit" }));
    await waitFor(() => expect(updateMortgageMock).toHaveBeenCalledTimes(1));

    const alert = await findByRole("alert");
    expect(alert.textContent ?? "").toContain("Aucun crédit attaché");
  });

  test("REALESTATE_NOT_FOUND (update mode) surfaces role=alert FR message", async () => {
    updateMortgageMock.mockResolvedValueOnce({
      ok: false,
      code: "REALESTATE_NOT_FOUND",
      message: "no property",
    });

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole, findByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <MortgageForm property={FAKE_PROPERTY} mortgage={FAKE_MORTGAGE} mode="update" />
      </QueryClientProvider>,
    );

    fireEvent.submit(getByRole("form", { name: "Modifier le crédit" }));
    await waitFor(() => expect(updateMortgageMock).toHaveBeenCalledTimes(1));

    const alert = await findByRole("alert");
    expect(alert.textContent ?? "").toContain("introuvable");
  });
});
