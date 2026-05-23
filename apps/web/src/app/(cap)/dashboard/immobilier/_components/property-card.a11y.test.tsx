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

// AC-6 verbatim: 3-property fixture variants — mortgage+rental, mortgage
// only, bare. Each PropertyCard variant must axe-clean in isolation.

const PROPERTY_BASE: Omit<RealEstate, "id" | "label" | "propertyType"> = {
  userId: "00000000-0000-0000-0000-000000000000",
  currentValuation: 250_000,
  lastValuedOn: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const PROPERTY_MORTGAGE_RENTAL: RealEstate = {
  ...PROPERTY_BASE,
  id: "res_mr",
  label: "Studio locatif",
  propertyType: "locatif",
};

const PROPERTY_MORTGAGE_ONLY: RealEstate = {
  ...PROPERTY_BASE,
  id: "res_m",
  label: "Résidence principale",
  propertyType: "residence-principale",
};

const PROPERTY_BARE: RealEstate = {
  ...PROPERTY_BASE,
  id: "res_b",
  label: "Maison de campagne",
  propertyType: "autre",
};

const DERIVES_MORTGAGE_RENTAL: PropertyDerivesItem = {
  propertyId: "res_mr",
  netEquityEur: 60_000,
  monthlyCashFlowEur: 320,
};

const DERIVES_MORTGAGE_ONLY: PropertyDerivesItem = {
  propertyId: "res_m",
  netEquityEur: 180_000,
  monthlyCashFlowEur: null,
};

describe("PropertyCard a11y (AC-6)", () => {
  test.each([
    ["mortgage + rental variant", PROPERTY_MORTGAGE_RENTAL, DERIVES_MORTGAGE_RENTAL],
    ["mortgage-only variant", PROPERTY_MORTGAGE_ONLY, DERIVES_MORTGAGE_ONLY],
    ["bare variant (no derives)", PROPERTY_BARE, null],
  ] as const)("zero axe violations — %s", async (_name, property, derives) => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <PropertyCard property={property} derives={derives} />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
