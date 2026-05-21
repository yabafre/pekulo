// packages/types/src/realestate/realestate.types.ts
// Real-estate domain types (story 4-1). Canonical domain entities live in
// `@pekulo/validators` (Zod inference) and are re-exported here as the
// single import surface for feature modules.

import type { Id } from "../shared/shared.types";

// Closed enum literal mirrors the validator side (Turbo cycle constraint —
// `@pekulo/types` is downstream of `@pekulo/validators`, so the literal
// lives here and the validator inlines its own copy in z.enum).
export const PROPERTY_TYPES = ["residence-principale", "locatif", "autre"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export type RealEstateId = Id<"RealEstateId">;
export type RealEstateMortgageId = Id<"RealEstateMortgageId">;
export type RealEstateRentalId = Id<"RealEstateRentalId">;
export type RealEstateValuationId = Id<"RealEstateValuationId">;

export type {
  RealEstate,
  RealEstateMortgage,
  RealEstateRental,
  RealEstateValuation,
  PropertyWithChildren,
  PropertyDerives,
  PropertyDerivesItem,
  ListPropertyDerivesOutput,
  TotalEquityOutput,
} from "@pekulo/validators";

/** UI prop shape consumed by PekuloPropertyCard. Renamed from legacy `Property`
 * (T8) to disambiguate from the canonical `RealEstate` domain entity. */
export interface PropertyCardItem {
  label: string;
  valuationEur: number;
  debtRemainingEur: number;
  monthlyPaymentEur: number;
  yearsRemaining: number;
  repaidPct: number;
}
