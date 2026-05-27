"use server";

// apps/web/src/app/(cap)/dashboard/parametres/_actions/bank-aggregator-actions.ts
// Server-action wrappers around bankAggregatorClient (story 5-6).
//
// Lesson 2026-05-20 — discriminated-union envelopes OMIT the `output:` slot
// on defineAction (zapaction runs output.parse on every handler return, and a
// narrow success-only schema rejects the { ok: false } branch). Both writes
// follow that pattern.
//
// Lesson 2026-05-24 — `defineAction({ tags: [...] })` is dead code without an
// RSC fetch-cache reader. The 5-6 callback page does NOT read via `await
// fetch(...)` ; it calls completeConnection via this server action, then
// redirects. The hooks consume `useActionMutation({ invalidateWithTags: [
// bankConnectionsTags.list() ] })` for React Query invalidation. So `tags:`
// is intentionally OMITTED on the wrappers below.

import { defineAction } from "@zapaction/core";
import { ORPCError } from "@orpc/client";
import {
  completeConnectionInputSchema,
  initiateConnectionInputSchema,
  type BankConnection,
  type CompleteConnectionInput,
  type InitiateConnectionInput,
  type InitiateConnectionOutput,
} from "@pekulo/validators";
import { bankAggregatorClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

/** Envelope for completeConnection — typed Bridge error codes survive the SA boundary. */
export type CompleteConnectionResult =
  | { ok: true; connection: BankConnection }
  | {
      ok: false;
      code: "BANK_CONNECTION_ALREADY_EXISTS" | "BANK_PROVIDER_UNAVAILABLE";
      message: string;
    };

/** Envelope for initiateConnection — only BANK_PROVIDER_UNAVAILABLE can surface. */
export type InitiateConnectionResult =
  | { ok: true; data: InitiateConnectionOutput }
  | { ok: false; code: "BANK_PROVIDER_UNAVAILABLE"; message: string };

export const initiateBankConnection = defineAction<
  InitiateConnectionInput,
  InitiateConnectionResult,
  ActionContext
>({
  name: "initiateBankConnection",
  input: initiateConnectionInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const data = await bankAggregatorClient.initiateConnection(input);
      return { ok: true as const, data };
    } catch (err) {
      if (err instanceof ORPCError && err.code === "BANK_PROVIDER_UNAVAILABLE") {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

export const completeBankConnection = defineAction<
  CompleteConnectionInput,
  CompleteConnectionResult,
  ActionContext
>({
  name: "completeBankConnection",
  input: completeConnectionInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const connection = await bankAggregatorClient.completeConnection(input);
      return { ok: true as const, connection };
    } catch (err) {
      if (
        err instanceof ORPCError &&
        (err.code === "BANK_CONNECTION_ALREADY_EXISTS" || err.code === "BANK_PROVIDER_UNAVAILABLE")
      ) {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});
