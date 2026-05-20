// packages/validators/src/realestate.ts
// Single source of truth for the realestate aggregate (story 4-1). Consumed by
// @pekulo/contracts (oRPC procedure I/O) and apps/api realestate
// service/handler/repository.

import { z } from "zod";

// ─── ID regexes ──────────────────────────────────────────────────────────
export const REAL_ESTATE_ID_PREFIX_RE = /^res_[0-9A-Za-z]{21}$/;
export const REAL_ESTATE_MORTGAGE_ID_PREFIX_RE = /^resm_[0-9A-Za-z]{21}$/;
export const REAL_ESTATE_RENTAL_ID_PREFIX_RE = /^resr_[0-9A-Za-z]{21}$/;
export const REAL_ESTATE_VALUATION_ID_PREFIX_RE = /^resv_[0-9A-Za-z]{21}$/;

export const realEstateIdSchema = z
  .string()
  .regex(REAL_ESTATE_ID_PREFIX_RE, "id must match /^res_[0-9A-Za-z]{21}$/");
export const realEstateMortgageIdSchema = z
  .string()
  .regex(REAL_ESTATE_MORTGAGE_ID_PREFIX_RE, "id must match /^resm_[0-9A-Za-z]{21}$/");
export const realEstateRentalIdSchema = z
  .string()
  .regex(REAL_ESTATE_RENTAL_ID_PREFIX_RE, "id must match /^resr_[0-9A-Za-z]{21}$/");
export const realEstateValuationIdSchema = z
  .string()
  .regex(REAL_ESTATE_VALUATION_ID_PREFIX_RE, "id must match /^resv_[0-9A-Za-z]{21}$/");

// ─── Enums ───────────────────────────────────────────────────────────────
export const PROPERTY_TYPES = ["residence-principale", "locatif", "autre"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const propertyTypeSchema = z.enum(PROPERTY_TYPES);

// ─── Row / DTO shapes ────────────────────────────────────────────────────
export const realEstateSchema = z.object({
  id: realEstateIdSchema,
  userId: z.string().uuid(),
  label: z.string().min(1).max(120),
  propertyType: propertyTypeSchema,
  currentValuation: z.number().min(0),
  lastValuedOn: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type RealEstate = z.infer<typeof realEstateSchema>;

export const realEstateMortgageSchema = z.object({
  id: realEstateMortgageIdSchema,
  userId: z.string().uuid(),
  realEstateId: realEstateIdSchema,
  outstandingPrincipal: z.number().min(0),
  annualRate: z.number().min(0).max(1),
  monthlyPayment: z.number().min(0),
  termMonths: z.number().int().min(1).max(600),
  startDate: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type RealEstateMortgage = z.infer<typeof realEstateMortgageSchema>;

export const realEstateRentalSchema = z.object({
  id: realEstateRentalIdSchema,
  userId: z.string().uuid(),
  realEstateId: realEstateIdSchema,
  monthlyRent: z.number().min(0),
  monthlyCharges: z.number().min(0),
  furnished: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type RealEstateRental = z.infer<typeof realEstateRentalSchema>;

export const realEstateValuationSchema = z.object({
  id: realEstateValuationIdSchema,
  userId: z.string().uuid(),
  realEstateId: realEstateIdSchema,
  amount: z.number().min(0),
  valuedOn: z.date(),
  createdAt: z.date(),
});
export type RealEstateValuation = z.infer<typeof realEstateValuationSchema>;

// ─── Input schemas (oRPC procedure inputs) ───────────────────────────────
export const createPropertyInputSchema = z.object({
  label: z.string().min(1).max(120),
  propertyType: propertyTypeSchema,
  currentValuation: z.number().min(0),
  lastValuedOn: z.coerce.date(),
});
export type CreatePropertyInput = z.infer<typeof createPropertyInputSchema>;

export const attachMortgageInputSchema = z.object({
  propertyId: realEstateIdSchema,
  outstandingPrincipal: z.number().min(0),
  annualRate: z.number().min(0).max(1),
  monthlyPayment: z.number().min(0),
  termMonths: z.number().int().min(1).max(600),
  startDate: z.coerce.date(),
});
export type AttachMortgageInput = z.infer<typeof attachMortgageInputSchema>;

export const updateMortgageInputSchema = z
  .object({
    propertyId: realEstateIdSchema,
    outstandingPrincipal: z.number().min(0).optional(),
    annualRate: z.number().min(0).max(1).optional(),
    monthlyPayment: z.number().min(0).optional(),
    termMonths: z.number().int().min(1).max(600).optional(),
    startDate: z.coerce.date().optional(),
  })
  .refine(
    (v) =>
      v.outstandingPrincipal !== undefined ||
      v.annualRate !== undefined ||
      v.monthlyPayment !== undefined ||
      v.termMonths !== undefined ||
      v.startDate !== undefined,
    { message: "at least one field besides propertyId is required" },
  );
export type UpdateMortgageInput = z.infer<typeof updateMortgageInputSchema>;

export const detachMortgageInputSchema = z.object({
  propertyId: realEstateIdSchema,
});
export type DetachMortgageInput = z.infer<typeof detachMortgageInputSchema>;

export const attachRentalInputSchema = z.object({
  propertyId: realEstateIdSchema,
  monthlyRent: z.number().min(0),
  monthlyCharges: z.number().min(0),
  furnished: z.boolean(),
});
export type AttachRentalInput = z.infer<typeof attachRentalInputSchema>;

export const updateRentalInputSchema = z
  .object({
    propertyId: realEstateIdSchema,
    monthlyRent: z.number().min(0).optional(),
    monthlyCharges: z.number().min(0).optional(),
    furnished: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.monthlyRent !== undefined || v.monthlyCharges !== undefined || v.furnished !== undefined,
    { message: "at least one field besides propertyId is required" },
  );
export type UpdateRentalInput = z.infer<typeof updateRentalInputSchema>;

export const detachRentalInputSchema = z.object({
  propertyId: realEstateIdSchema,
});
export type DetachRentalInput = z.infer<typeof detachRentalInputSchema>;

export const recordValuationInputSchema = z.object({
  propertyId: realEstateIdSchema,
  amount: z.number().min(0),
  valuedOn: z.coerce.date(),
});
export type RecordValuationInput = z.infer<typeof recordValuationInputSchema>;

export const getPropertyInputSchema = z.object({
  id: realEstateIdSchema,
});
export type GetPropertyInput = z.infer<typeof getPropertyInputSchema>;

export const deletePropertyInputSchema = z.object({
  id: realEstateIdSchema,
});
export type DeletePropertyInput = z.infer<typeof deletePropertyInputSchema>;

export const listValuationsInputSchema = z.object({
  propertyId: realEstateIdSchema,
});
export type ListValuationsInput = z.infer<typeof listValuationsInputSchema>;

// ─── Composite output shapes ─────────────────────────────────────────────
export const propertyWithChildrenSchema = z.object({
  property: realEstateSchema,
  mortgage: realEstateMortgageSchema.nullable(),
  rental: realEstateRentalSchema.nullable(),
});
export type PropertyWithChildren = z.infer<typeof propertyWithChildrenSchema>;
