import { describe, expect, test, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

const { createPropertyMock } = vi.hoisted(() => ({ createPropertyMock: vi.fn() }));
vi.mock("../_actions/realestate-actions", () => ({
  createProperty: createPropertyMock,
}));

import { PropertyCreateForm } from "./property-create-form";

describe("PropertyCreateForm envelope (AC-3 + AC-4)", () => {
  test("ok:true — SA called once with trimmed/coerced payload, onSuccess fires once", async () => {
    createPropertyMock.mockResolvedValueOnce({
      ok: true,
      property: {
        id: "res_test",
        userId: "00000000-0000-0000-0000-000000000000",
        label: "Appartement",
        propertyType: "residence-principale",
        currentValuation: 250_000,
        lastValuedOn: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const onSuccess = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByLabelText, getByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <PropertyCreateForm onSuccess={onSuccess} />
      </QueryClientProvider>,
    );

    // Whitespace on label is trimmed by the form before mutate().
    fireEvent.change(getByLabelText(/Libellé/), { target: { value: "  Appartement  " } });
    fireEvent.change(getByLabelText(/Valorisation/), { target: { value: "250000" } });
    fireEvent.submit(getByRole("form", { name: "Ajouter un bien immobilier" }));

    await waitFor(() => expect(createPropertyMock).toHaveBeenCalledTimes(1));
    const call = createPropertyMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.label).toBe("Appartement");
    expect(call.propertyType).toBe("residence-principale");
    expect(call.currentValuation).toBe(250_000);
    expect(call.lastValuedOn).toBeInstanceOf(Date);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});
