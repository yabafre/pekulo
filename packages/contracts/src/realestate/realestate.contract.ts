// packages/contracts/src/realestate/realestate.contract.ts
// Realestate module oRPC contract (story 4-1). 12 procedures covering full
// CRUD on properties + 1:1 lifecycle on mortgage / rental children + audit
// trail on valuations. See ADR-0009 (mount under /rpc/v1/realestate).
//
// Typed-error declarations mirror holdings.contract.ts (story 3-1). Each
// error code surfaces on the wire as the canonical { code, status, message }
// envelope so the client (apps/web zapaction bridge) can narrow on `code`.

import { oc } from "@orpc/contract";
import {
  attachMortgageInputSchema,
  attachRentalInputSchema,
  createPropertyInputSchema,
  deletePropertyInputSchema,
  detachMortgageInputSchema,
  detachRentalInputSchema,
  getPropertyInputSchema,
  listPropertiesOutputSchema,
  listPropertyDerivesOutputSchema,
  listValuationsInputSchema,
  listValuationsOutputSchema,
  propertyDerivesSchema,
  propertyWithChildrenSchema,
  realEstateMortgageSchema,
  realEstateRentalSchema,
  realEstateSchema,
  realestateOkSchema,
  recordValuationInputSchema,
  totalEquityOutputSchema,
  updateMortgageInputSchema,
  updateRentalInputSchema,
} from "@pekulo/validators";

const realestateNotFoundError = {
  status: 404 as const,
  message: "real estate not found",
};
const mortgageAlreadyAttachedError = {
  status: 409 as const,
  message: "property already has a mortgage attached",
};
const mortgageNotFoundError = {
  status: 404 as const,
  message: "mortgage not found",
};
const rentalAlreadyAttachedError = {
  status: 409 as const,
  message: "property already has a rental attached",
};
const rentalNotFoundError = {
  status: 404 as const,
  message: "rental not found",
};

export const realestateContractV1 = {
  createProperty: oc.input(createPropertyInputSchema).output(realEstateSchema),
  getProperty: oc
    .errors({ REALESTATE_NOT_FOUND: realestateNotFoundError })
    .input(getPropertyInputSchema)
    .output(propertyWithChildrenSchema),
  listProperties: oc.output(listPropertiesOutputSchema),
  attachMortgage: oc
    .errors({
      REALESTATE_NOT_FOUND: realestateNotFoundError,
      MORTGAGE_ALREADY_ATTACHED: mortgageAlreadyAttachedError,
    })
    .input(attachMortgageInputSchema)
    .output(realEstateMortgageSchema),
  updateMortgage: oc
    .errors({
      REALESTATE_NOT_FOUND: realestateNotFoundError,
      MORTGAGE_NOT_FOUND: mortgageNotFoundError,
    })
    .input(updateMortgageInputSchema)
    .output(realEstateMortgageSchema),
  detachMortgage: oc
    .errors({ REALESTATE_NOT_FOUND: realestateNotFoundError })
    .input(detachMortgageInputSchema)
    .output(realestateOkSchema),
  attachRental: oc
    .errors({
      REALESTATE_NOT_FOUND: realestateNotFoundError,
      RENTAL_ALREADY_ATTACHED: rentalAlreadyAttachedError,
    })
    .input(attachRentalInputSchema)
    .output(realEstateRentalSchema),
  updateRental: oc
    .errors({
      REALESTATE_NOT_FOUND: realestateNotFoundError,
      RENTAL_NOT_FOUND: rentalNotFoundError,
    })
    .input(updateRentalInputSchema)
    .output(realEstateRentalSchema),
  detachRental: oc
    .errors({ REALESTATE_NOT_FOUND: realestateNotFoundError })
    .input(detachRentalInputSchema)
    .output(realestateOkSchema),
  recordValuation: oc
    .errors({ REALESTATE_NOT_FOUND: realestateNotFoundError })
    .input(recordValuationInputSchema)
    .output(realEstateSchema),
  listValuations: oc
    .errors({ REALESTATE_NOT_FOUND: realestateNotFoundError })
    .input(listValuationsInputSchema)
    .output(listValuationsOutputSchema),
  deleteProperty: oc
    .errors({ REALESTATE_NOT_FOUND: realestateNotFoundError })
    .input(deletePropertyInputSchema)
    .output(realestateOkSchema),
  // ─── 4-2 — derive surface (FR-24 / FR-25 / FR-26) ────────────────
  getPropertyDerives: oc
    .errors({ REALESTATE_NOT_FOUND: realestateNotFoundError })
    .input(getPropertyInputSchema)
    .output(propertyDerivesSchema),
  listPropertyDerives: oc.output(listPropertyDerivesOutputSchema),
  getTotalEquity: oc.output(totalEquityOutputSchema),
} as const;

export const realestateContract = realestateContractV1;
export const realestateContractMeta = {
  moduleKey: "realestate",
  mountPath: "/rpc/v1/realestate",
  version: "v1",
} as const;
