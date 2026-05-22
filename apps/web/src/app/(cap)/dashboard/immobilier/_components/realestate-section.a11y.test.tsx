import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RealEstate, PropertyDerivesItem } from "@pekulo/types";
import { renderWithTamagui } from "../../../../../../test/setup";

// AC-6 verbatim: "Given the screen renders against a 3-property fixture
// (including one with mortgage+rental, one with mortgage only, one bare),
// When axe-core runs against the page DOM ..., Then every result has zero
// violations."
//
// vi.mock is hoisted to the top of the module, so the factory cannot
// reference module-level consts directly — they get the TDZ trap. The
// fixtures live inside vi.hoisted so they share the hoist plateau.
const { listPropertiesMock, listPropertyDerivesMock, listValuationsMock, FIXTURE } = vi.hoisted(
  () => {
    const PROPERTY_MORTGAGE_RENTAL: RealEstate = {
      id: "res_mr",
      userId: "00000000-0000-0000-0000-000000000000",
      label: "Studio locatif",
      propertyType: "locatif",
      currentValuation: 180_000,
      lastValuedOn: new Date("2026-01-15"),
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2026-01-15"),
    };
    const PROPERTY_MORTGAGE_ONLY: RealEstate = {
      id: "res_m",
      userId: "00000000-0000-0000-0000-000000000000",
      label: "Résidence principale",
      propertyType: "residence-principale",
      currentValuation: 320_000,
      lastValuedOn: new Date("2026-02-10"),
      createdAt: new Date("2023-06-01"),
      updatedAt: new Date("2026-02-10"),
    };
    const PROPERTY_BARE: RealEstate = {
      id: "res_b",
      userId: "00000000-0000-0000-0000-000000000000",
      label: "Maison de campagne",
      propertyType: "autre",
      currentValuation: 95_000,
      lastValuedOn: new Date("2025-09-20"),
      createdAt: new Date("2022-04-12"),
      updatedAt: new Date("2025-09-20"),
    };
    const DERIVES_MORTGAGE_RENTAL: PropertyDerivesItem = {
      propertyId: "res_mr",
      netEquityEur: 60_000,
      monthlyCashFlowEur: 320,
    };
    const DERIVES_MORTGAGE_ONLY: PropertyDerivesItem = {
      propertyId: "res_m",
      netEquityEur: 220_000,
      monthlyCashFlowEur: null,
    };
    return {
      FIXTURE: { PROPERTY_MORTGAGE_RENTAL, PROPERTY_MORTGAGE_ONLY, PROPERTY_BARE },
      listPropertiesMock: vi
        .fn()
        .mockResolvedValue([PROPERTY_MORTGAGE_RENTAL, PROPERTY_MORTGAGE_ONLY, PROPERTY_BARE]),
      listPropertyDerivesMock: vi
        .fn()
        .mockResolvedValue([DERIVES_MORTGAGE_RENTAL, DERIVES_MORTGAGE_ONLY]),
      listValuationsMock: vi.fn().mockResolvedValue([]),
    };
  },
);

vi.mock("../_actions/realestate-actions", () => ({
  listProperties: listPropertiesMock,
  listPropertyDerives: listPropertyDerivesMock,
  listValuations: listValuationsMock,
  getProperty: vi.fn(),
  createProperty: vi.fn(),
  attachMortgage: vi.fn(),
  updateMortgage: vi.fn(),
  detachMortgage: vi.fn(),
  attachRental: vi.fn(),
  updateRental: vi.fn(),
  detachRental: vi.fn(),
  recordValuation: vi.fn(),
  deleteProperty: vi.fn(),
}));

import { RealestateSection } from "./realestate-section";

describe("RealestateSection a11y (AC-6)", () => {
  test("zero axe violations against 3-property fixture (mortgage+rental, mortgage only, bare)", async () => {
    const qc = new QueryClient();
    const { container, findByText } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <RealestateSection />
      </QueryClientProvider>,
    );

    // Wait for at least one property label so axe doesn't run against the
    // loading skeleton.
    await findByText(FIXTURE.PROPERTY_MORTGAGE_RENTAL.label);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
