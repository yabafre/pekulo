"use server";

import { defineAction } from "@zapaction/core";
import { z } from "@pekulo/zod";
import { ORPCError } from "@orpc/client";
import {
  realEstateSchema,
  realEstateMortgageSchema,
  realEstateRentalSchema,
  propertyWithChildrenSchema,
  listPropertiesOutputSchema,
  listValuationsOutputSchema,
  listPropertyDerivesOutputSchema,
  propertyDerivesSchema,
  createPropertyInputSchema,
  attachMortgageInputSchema,
  updateMortgageInputSchema,
  detachMortgageInputSchema,
  attachRentalInputSchema,
  updateRentalInputSchema,
  detachRentalInputSchema,
  recordValuationInputSchema,
  getPropertyInputSchema,
  listValuationsInputSchema,
  deletePropertyInputSchema,
  type RealEstate,
  type RealEstateMortgage,
  type RealEstateRental,
  type PropertyWithChildren,
  type ListPropertyDerivesOutput,
  type CreatePropertyInput,
  type AttachMortgageInput,
  type UpdateMortgageInput,
  type DetachMortgageInput,
  type AttachRentalInput,
  type UpdateRentalInput,
  type DetachRentalInput,
  type RecordValuationInput,
  type GetPropertyInput,
  type ListValuationsInput,
  type DeletePropertyInput,
} from "@pekulo/validators";
import type { RealEstateValuation } from "@pekulo/types";
import { realestateClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { realestateTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// Story 4-3 — thin oRPC delegators co-located with the immobilier route.
// The 9 mutating SAs return a discriminated-union envelope so typed
// ORPCError codes propagate through the Next.js Server Action boundary
// intact. The hook layer narrows on `result.ok` and surfaces the localised
// error to the form. `output:` is intentionally OMITTED on every envelope
// SA — zapaction would otherwise validate the `{ok:false,…}` shape against
// the narrow success schema and silently reject the error branch (lesson
// 2026-05-20).
//
// Tag policy — every mutation invalidates `realestateTags.list()`. The
// aggregate covers the 3 read consumers (`useProperties`,
// `useListPropertyDerives`, `useProperty`) via the registry edge already
// installed in `lib/zapaction/keys.ts`. No per-id tag is required for
// V1; an optimistic `byId(id)` edge can be wired later.

/** Envelope for createProperty — no typed errors in 4-1's contract; envelope kept for API parity. */
export type CreatePropertyResult = { ok: true; property: RealEstate };

export type AttachMortgageResult =
  | { ok: true; mortgage: RealEstateMortgage }
  | {
      ok: false;
      code: "REALESTATE_NOT_FOUND" | "MORTGAGE_ALREADY_ATTACHED";
      message: string;
    };

export type UpdateMortgageResult =
  | { ok: true; mortgage: RealEstateMortgage }
  | {
      ok: false;
      code: "REALESTATE_NOT_FOUND" | "MORTGAGE_NOT_FOUND";
      message: string;
    };

export type DetachMortgageResult =
  | { ok: true }
  | { ok: false; code: "REALESTATE_NOT_FOUND"; message: string };

export type AttachRentalResult =
  | { ok: true; rental: RealEstateRental }
  | {
      ok: false;
      code: "REALESTATE_NOT_FOUND" | "RENTAL_ALREADY_ATTACHED";
      message: string;
    };

export type UpdateRentalResult =
  | { ok: true; rental: RealEstateRental }
  | {
      ok: false;
      code: "REALESTATE_NOT_FOUND" | "RENTAL_NOT_FOUND";
      message: string;
    };

export type DetachRentalResult =
  | { ok: true }
  | { ok: false; code: "REALESTATE_NOT_FOUND"; message: string };

export type RecordValuationResult =
  | { ok: true; property: RealEstate }
  | { ok: false; code: "REALESTATE_NOT_FOUND"; message: string };

export type DeletePropertyResult =
  | { ok: true }
  | { ok: false; code: "REALESTATE_NOT_FOUND"; message: string };

export type GetPropertyResult =
  | { ok: true; data: PropertyWithChildren }
  | { ok: false; code: "REALESTATE_NOT_FOUND"; message: string };

// ─── Read SAs (output: declared — single-shape returns) ──────────────────

export const listProperties = defineAction<void, RealEstate[], ActionContext>({
  name: "listProperties",
  input: z.void(),
  output: listPropertiesOutputSchema,
  handler: async () => {
    await ensureRequestContext();
    return realestateClient.listProperties();
  },
});

export const listPropertyDerives = defineAction<void, ListPropertyDerivesOutput, ActionContext>({
  name: "listPropertyDerives",
  input: z.void(),
  output: listPropertyDerivesOutputSchema,
  handler: async () => {
    await ensureRequestContext();
    return realestateClient.listPropertyDerives();
  },
});

export const listValuations = defineAction<
  ListValuationsInput,
  RealEstateValuation[],
  ActionContext
>({
  name: "listValuations",
  input: listValuationsInputSchema,
  output: listValuationsOutputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    return realestateClient.listValuations(input);
  },
});

// ─── Envelope SAs (output: OMITTED — discriminated-union returns) ────────

export const createProperty = defineAction<
  CreatePropertyInput,
  CreatePropertyResult,
  ActionContext
>({
  name: "createProperty",
  input: createPropertyInputSchema,
  tags: [realestateTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    const property = await realestateClient.createProperty(input);
    return { ok: true, property };
  },
});

export const attachMortgage = defineAction<
  AttachMortgageInput,
  AttachMortgageResult,
  ActionContext
>({
  name: "attachMortgage",
  input: attachMortgageInputSchema,
  tags: [realestateTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const mortgage = await realestateClient.attachMortgage(input);
      return { ok: true, mortgage };
    } catch (err) {
      if (
        err instanceof ORPCError &&
        (err.code === "REALESTATE_NOT_FOUND" || err.code === "MORTGAGE_ALREADY_ATTACHED")
      ) {
        return { ok: false, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

export const updateMortgage = defineAction<
  UpdateMortgageInput,
  UpdateMortgageResult,
  ActionContext
>({
  name: "updateMortgage",
  input: updateMortgageInputSchema,
  tags: [realestateTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const mortgage = await realestateClient.updateMortgage(input);
      return { ok: true, mortgage };
    } catch (err) {
      if (
        err instanceof ORPCError &&
        (err.code === "REALESTATE_NOT_FOUND" || err.code === "MORTGAGE_NOT_FOUND")
      ) {
        return { ok: false, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

export const detachMortgage = defineAction<
  DetachMortgageInput,
  DetachMortgageResult,
  ActionContext
>({
  name: "detachMortgage",
  input: detachMortgageInputSchema,
  tags: [realestateTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const result = await realestateClient.detachMortgage(input);
      return result;
    } catch (err) {
      if (err instanceof ORPCError && err.code === "REALESTATE_NOT_FOUND") {
        return { ok: false, code: "REALESTATE_NOT_FOUND", message: err.message };
      }
      throw err;
    }
  },
});

export const attachRental = defineAction<AttachRentalInput, AttachRentalResult, ActionContext>({
  name: "attachRental",
  input: attachRentalInputSchema,
  tags: [realestateTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const rental = await realestateClient.attachRental(input);
      return { ok: true, rental };
    } catch (err) {
      if (
        err instanceof ORPCError &&
        (err.code === "REALESTATE_NOT_FOUND" || err.code === "RENTAL_ALREADY_ATTACHED")
      ) {
        return { ok: false, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

export const updateRental = defineAction<UpdateRentalInput, UpdateRentalResult, ActionContext>({
  name: "updateRental",
  input: updateRentalInputSchema,
  tags: [realestateTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const rental = await realestateClient.updateRental(input);
      return { ok: true, rental };
    } catch (err) {
      if (
        err instanceof ORPCError &&
        (err.code === "REALESTATE_NOT_FOUND" || err.code === "RENTAL_NOT_FOUND")
      ) {
        return { ok: false, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

export const detachRental = defineAction<DetachRentalInput, DetachRentalResult, ActionContext>({
  name: "detachRental",
  input: detachRentalInputSchema,
  tags: [realestateTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const result = await realestateClient.detachRental(input);
      return result;
    } catch (err) {
      if (err instanceof ORPCError && err.code === "REALESTATE_NOT_FOUND") {
        return { ok: false, code: "REALESTATE_NOT_FOUND", message: err.message };
      }
      throw err;
    }
  },
});

export const recordValuation = defineAction<
  RecordValuationInput,
  RecordValuationResult,
  ActionContext
>({
  name: "recordValuation",
  input: recordValuationInputSchema,
  tags: [realestateTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const property = await realestateClient.recordValuation(input);
      return { ok: true, property };
    } catch (err) {
      if (err instanceof ORPCError && err.code === "REALESTATE_NOT_FOUND") {
        return { ok: false, code: "REALESTATE_NOT_FOUND", message: err.message };
      }
      throw err;
    }
  },
});

export const deleteProperty = defineAction<
  DeletePropertyInput,
  DeletePropertyResult,
  ActionContext
>({
  name: "deleteProperty",
  input: deletePropertyInputSchema,
  tags: [realestateTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const result = await realestateClient.deleteProperty(input);
      return result;
    } catch (err) {
      if (err instanceof ORPCError && err.code === "REALESTATE_NOT_FOUND") {
        return { ok: false, code: "REALESTATE_NOT_FOUND", message: err.message };
      }
      throw err;
    }
  },
});

// Helper SA — used by the per-card detail panel; envelope-shaped so a
// concurrent delete races into a clean 404 instead of a thrown exception.
export const getProperty = defineAction<GetPropertyInput, GetPropertyResult, ActionContext>({
  name: "getProperty",
  input: getPropertyInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const data = await realestateClient.getProperty(input);
      return { ok: true, data };
    } catch (err) {
      if (err instanceof ORPCError && err.code === "REALESTATE_NOT_FOUND") {
        return { ok: false, code: "REALESTATE_NOT_FOUND", message: err.message };
      }
      throw err;
    }
  },
});

// Re-export schemas so the route-local consumers don't reach into
// @pekulo/validators directly for forward-pointer barrel hygiene.
void realEstateSchema;
void realEstateMortgageSchema;
void realEstateRentalSchema;
void propertyWithChildrenSchema;
void propertyDerivesSchema;
