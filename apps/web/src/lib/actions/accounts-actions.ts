"use server";

import { defineAction } from "@zapaction/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ORPCError } from "@orpc/client";
import {
  accountSchema,
  createAccountInputSchema,
  deleteAccountInputSchema,
  listAccountsOutputSchema,
  recordBalanceChangeInputSchema,
  updateAccountInputSchema,
  type Account,
  type CreateAccountInput,
  type DeleteAccountInput,
  type RecordBalanceChangeInput,
  type UpdateAccountInput,
} from "@pekulo/validators";
import { accountsClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { accountsTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// Next.js Server Actions sanitise thrown Error messages in production
// (digest-only payload); each mutation that can throw a typed contract
// error catches the typed ORPCError and returns a discriminated-union
// envelope so the `code` survives the SA boundary. First monorepo
// precedent for typed-error surfacing through a SA — carries forward to
// 3-1 / 5-1 / 7-3.

/** Envelope for deleteAccount — preserves typed codes across the SA boundary. */
export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; code: "ACCOUNT_REFERENCED_FK" | "ACCOUNT_NOT_FOUND"; message: string };

/**
 * Envelope for updateAccount + recordBalanceChange — both can fail with
 * ACCOUNT_NOT_FOUND (cross-user attempt or stale id). Same shape, different
 * `okAccount`.
 */
export type UpdateAccountResult =
  | { ok: true; account: Account }
  | { ok: false; code: "ACCOUNT_NOT_FOUND"; message: string };

export type RecordBalanceChangeResult =
  | { ok: true; account: Account }
  | { ok: false; code: "ACCOUNT_NOT_FOUND"; message: string };

export const listAccounts = defineAction<void, Account[], ActionContext>({
  name: "listAccounts",
  input: z.void(),
  output: listAccountsOutputSchema,
  handler: async () => {
    await ensureRequestContext();
    return accountsClient.list();
  },
});

export const createAccount = defineAction<CreateAccountInput, Account, ActionContext>({
  name: "createAccount",
  input: createAccountInputSchema,
  output: accountSchema,
  tags: [accountsTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    const created = await accountsClient.create(input);
    revalidatePath("/dashboard/parametres");
    revalidatePath("/dashboard");
    return created;
  },
});

export const updateAccount = defineAction<UpdateAccountInput, UpdateAccountResult, ActionContext>({
  name: "updateAccount",
  input: updateAccountInputSchema,
  tags: [accountsTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const updated = await accountsClient.update(input);
      revalidatePath("/dashboard/parametres");
      revalidatePath("/dashboard");
      return { ok: true as const, account: updated };
    } catch (err) {
      if (err instanceof ORPCError && err.code === "ACCOUNT_NOT_FOUND") {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

export const deleteAccount = defineAction<DeleteAccountInput, DeleteAccountResult, ActionContext>({
  name: "deleteAccount",
  input: deleteAccountInputSchema,
  tags: [accountsTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      await accountsClient.delete(input);
      revalidatePath("/dashboard/parametres");
      revalidatePath("/dashboard");
      return { ok: true as const };
    } catch (err) {
      if (
        err instanceof ORPCError &&
        (err.code === "ACCOUNT_REFERENCED_FK" || err.code === "ACCOUNT_NOT_FOUND")
      ) {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

export const recordBalanceChange = defineAction<
  RecordBalanceChangeInput,
  RecordBalanceChangeResult,
  ActionContext
>({
  name: "recordBalanceChange",
  input: recordBalanceChangeInputSchema,
  tags: [accountsTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const updated = await accountsClient.recordBalanceChange(input);
      revalidatePath("/dashboard/parametres");
      revalidatePath("/dashboard");
      return { ok: true as const, account: updated };
    } catch (err) {
      if (err instanceof ORPCError && err.code === "ACCOUNT_NOT_FOUND") {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});
