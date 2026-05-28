"use server";

// apps/web/src/app/(cap)/dashboard/_bank/_actions/bank-aggregator-actions.ts
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
import { z } from "@pekulo/zod";
import {
  completeConnectionInputSchema,
  initiateConnectionInputSchema,
  listConnectionsOutputSchema,
  reconnectConnectionInputSchema,
  renameConnectionInputSchema,
  revokeConnectionInputSchema,
  type BankConnection,
  type CompleteConnectionInput,
  type InitiateConnectionInput,
  type InitiateConnectionOutput,
  type ReconnectConnectionInput,
  type RenameConnectionInput,
  type RevokeConnectionInput,
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

/** Read — connections list for the Patrimoine connections section. */
export const listBankConnections = defineAction<void, BankConnection[], ActionContext>({
  name: "listBankConnections",
  input: z.void(),
  output: listConnectionsOutputSchema,
  handler: async () => {
    await ensureRequestContext();
    return bankAggregatorClient.listConnections();
  },
});

/** Envelope for renameConnection — NOT_FOUND survives the SA boundary. */
export type RenameBankConnectionResult =
  | { ok: true; connection: BankConnection }
  | { ok: false; code: "BANK_CONNECTION_NOT_FOUND"; message: string };

export const renameBankConnection = defineAction<
  RenameConnectionInput,
  RenameBankConnectionResult,
  ActionContext
>({
  name: "renameBankConnection",
  input: renameConnectionInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const connection = await bankAggregatorClient.renameConnection(input);
      return { ok: true as const, connection };
    } catch (err) {
      if (err instanceof ORPCError && err.code === "BANK_CONNECTION_NOT_FOUND") {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

/** Envelope for revokeConnection — NOT_FOUND + PROVIDER_UNAVAILABLE survive the SA boundary. */
export type RevokeBankConnectionResult =
  | { ok: true }
  | {
      ok: false;
      code: "BANK_CONNECTION_NOT_FOUND" | "BANK_PROVIDER_UNAVAILABLE";
      message: string;
    };

export const revokeBankConnection = defineAction<
  RevokeConnectionInput,
  RevokeBankConnectionResult,
  ActionContext
>({
  name: "revokeBankConnection",
  input: revokeConnectionInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      await bankAggregatorClient.revokeConnection(input);
      return { ok: true as const };
    } catch (err) {
      if (
        err instanceof ORPCError &&
        (err.code === "BANK_CONNECTION_NOT_FOUND" || err.code === "BANK_PROVIDER_UNAVAILABLE")
      ) {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

/** Envelope for reconnectConnection (SCA re-auth) — same error surface as revoke. */
export type ReconnectBankConnectionResult =
  | { ok: true; connectUrl: string }
  | {
      ok: false;
      code: "BANK_CONNECTION_NOT_FOUND" | "BANK_PROVIDER_UNAVAILABLE";
      message: string;
    };

export const reconnectBankConnection = defineAction<
  ReconnectConnectionInput,
  ReconnectBankConnectionResult,
  ActionContext
>({
  name: "reconnectBankConnection",
  input: reconnectConnectionInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const { connectUrl } = await bankAggregatorClient.reconnectConnection(input);
      return { ok: true as const, connectUrl };
    } catch (err) {
      if (
        err instanceof ORPCError &&
        (err.code === "BANK_CONNECTION_NOT_FOUND" || err.code === "BANK_PROVIDER_UNAVAILABLE")
      ) {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});
