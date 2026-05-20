"use server";

import { defineAction } from "@zapaction/core";
import { revalidatePath } from "next/cache";
import { z } from "@pekulo/zod";
import { ORPCError } from "@orpc/client";
import {
  holdingSchema,
  holdingLotSchema,
  derivedHoldingSchema,
  listHoldingsOutputSchema,
  createHoldingInputSchema,
  recordLotInputSchema,
  closeHoldingInputSchema,
  getDerivedHoldingInputSchema,
  type Holding,
  type HoldingLot,
  type DerivedHolding,
  type CreateHoldingInput,
  type RecordLotInput,
  type CloseHoldingInput,
  type GetDerivedHoldingInput,
} from "@pekulo/validators";
import { holdingsClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { holdingsTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// Story 3-4 — thin oRPC delegators co-located with the portefeuille
// route. MUST NOT import from any sibling feature actions file (lint
// pekulo/no-cross-feature-action-import). Each handler ensures request
// context defensively before the oRPC call (lesson L25).
//
// Three mutations return a discriminated-union envelope so typed
// ORPCError codes propagate through the Next.js Server Action boundary
// intact (precedent: accounts-actions.ts deleteAccount → 2-3-T2). The
// hook layer narrows on `result.ok` and surfaces the localised error.

/** Envelope for createHolding — preserves typed `ACCOUNT_NOT_FOUND` across the SA boundary. */
export type CreateHoldingResult =
  | { ok: true; holding: Holding }
  | { ok: false; code: "ACCOUNT_NOT_FOUND"; message: string };

/** Envelope for recordLot — preserves `HOLDING_NOT_FOUND` and `HOLDING_CLOSED` codes. */
export type RecordLotResult =
  | { ok: true; lot: HoldingLot }
  | { ok: false; code: "HOLDING_NOT_FOUND" | "HOLDING_CLOSED"; message: string };

/** Envelope for closeHolding — preserves `HOLDING_NOT_FOUND`. */
export type CloseHoldingResult =
  | { ok: true }
  | { ok: false; code: "HOLDING_NOT_FOUND"; message: string };

export const listHoldings = defineAction<void, Holding[], ActionContext>({
  name: "listHoldings",
  input: z.void(),
  output: listHoldingsOutputSchema,
  handler: async () => {
    await ensureRequestContext();
    return holdingsClient.list({ includeClosed: false });
  },
});

export const getDerivedHolding = defineAction<
  GetDerivedHoldingInput,
  DerivedHolding,
  ActionContext
>({
  name: "getDerivedHolding",
  input: getDerivedHoldingInputSchema,
  output: derivedHoldingSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    return holdingsClient.getDerived(input);
  },
});

export const createHolding = defineAction<CreateHoldingInput, CreateHoldingResult, ActionContext>({
  name: "createHolding",
  input: createHoldingInputSchema,
  tags: [holdingsTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const holding = await holdingsClient.create(input);
      revalidatePath("/dashboard/portefeuille");
      revalidatePath("/dashboard");
      return { ok: true, holding };
    } catch (err) {
      if (err instanceof ORPCError && err.code === "ACCOUNT_NOT_FOUND") {
        return { ok: false, code: "ACCOUNT_NOT_FOUND", message: err.message };
      }
      throw err;
    }
  },
});

export const recordLot = defineAction<RecordLotInput, RecordLotResult, ActionContext>({
  name: "recordLot",
  input: recordLotInputSchema,
  tags: [holdingsTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const lot = await holdingsClient.recordLot(input);
      revalidatePath("/dashboard/portefeuille");
      revalidatePath("/dashboard");
      return { ok: true, lot };
    } catch (err) {
      if (
        err instanceof ORPCError &&
        (err.code === "HOLDING_NOT_FOUND" || err.code === "HOLDING_CLOSED")
      ) {
        return { ok: false, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

// `output:` intentionally omitted — zapaction validates returns against the
// declared schema, and `closeHoldingOutputSchema` only accepts `{ok: true}`.
// Mirrors the deleteAccount precedent (accounts-actions.ts) so envelope errors
// survive the SA boundary.
export const closeHolding = defineAction<CloseHoldingInput, CloseHoldingResult, ActionContext>({
  name: "closeHolding",
  input: closeHoldingInputSchema,
  tags: [holdingsTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const result = await holdingsClient.close(input);
      revalidatePath("/dashboard/portefeuille");
      revalidatePath("/dashboard");
      return result;
    } catch (err) {
      if (err instanceof ORPCError && err.code === "HOLDING_NOT_FOUND") {
        return { ok: false, code: "HOLDING_NOT_FOUND", message: err.message };
      }
      throw err;
    }
  },
});

void holdingSchema;
void holdingLotSchema;
