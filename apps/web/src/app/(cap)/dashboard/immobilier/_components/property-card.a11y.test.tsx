import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RealEstate, PropertyDerivesItem } from "@pekulo/types";
import { renderWithTamagui } from "../../../../../../test/setup";

vi.mock("../_actions/realestate-actions", () => ({
  getProperty: vi.fn(),
  listValuations: vi.fn().mockResolvedValue([]),
  attachMortgage: vi.fn(),
  updateMortgage: vi.fn(),
  detachMortgage: vi.fn(),
  attachRental: vi.fn(),
  updateRental: vi.fn(),
  detachRental: vi.fn(),
  recordValuation: vi.fn(),
  deleteProperty: vi.fn(),
}));

import { PropertyCard } from "./property-card";

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

const FAKE_DERIVES: PropertyDerivesItem = {
  propertyId: "res_test",
  netEquityEur: 180_000,
  monthlyCashFlowEur: null,
};

describe("PropertyCard a11y (AC-6)", () => {
  test("zero axe violations with mortgage-less property", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <PropertyCard property={FAKE_PROPERTY} derives={FAKE_DERIVES} />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
