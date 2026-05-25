"use server";

import { defineAction } from "@zapaction/core";
import { z } from "@pekulo/zod";
import { ORPCError } from "@orpc/client";
import {
  createTransactionInputSchema,
  deleteTransactionInputSchema,
  listTransactionsInputSchema,
  listTransactionsOutputSchema,
  updateTransactionInputSchema,
  type CreateTransactionInput,
  type DeleteTransactionInput,
  type ListTransactionsInput,
  type ListTransactionsOutput,
  type Transaction,
  type UpdateTransactionInput,
} from "@pekulo/validators";
import { transactionsClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { transactionsTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// L25 (2026-05-20): write paths that may return { ok: false } envelopes MUST
// omit `output:` — zapaction core runs output.parse(result) unconditionally
// and would reject the error branch. Reads stay typed because their handler
// returns the success shape unconditionally.

export type CreateTransactionResult =
  | { ok: true; transaction: Transaction }
  | { ok: false; code: "ACCOUNT_NOT_FOUND"; message: string };

export type UpdateTransactionResult =
  | { ok: true; transaction: Transaction }
  | { ok: false; code: "TRANSACTION_NOT_FOUND" | "ACCOUNT_NOT_FOUND"; message: string };

export type DeleteTransactionResult =
  | { ok: true }
  | { ok: false; code: "TRANSACTION_NOT_FOUND"; message: string };

export const listTransactions = defineAction<
  ListTransactionsInput,
  ListTransactionsOutput,
  ActionContext
>({
  name: "listTransactions",
  input: listTransactionsInputSchema,
  output: listTransactionsOutputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    return transactionsClient.listTransactions(input);
  },
});

export const createTransaction = defineAction<
  CreateTransactionInput,
  CreateTransactionResult,
  ActionContext
>({
  name: "createTransaction",
  input: createTransactionInputSchema,
  tags: [transactionsTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const created = await transactionsClient.createTransaction(input);
      return { ok: true as const, transaction: created };
    } catch (err) {
      if (err instanceof ORPCError && err.code === "ACCOUNT_NOT_FOUND") {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

export const updateTransaction = defineAction<
  UpdateTransactionInput,
  UpdateTransactionResult,
  ActionContext
>({
  name: "updateTransaction",
  input: updateTransactionInputSchema,
  tags: [transactionsTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const updated = await transactionsClient.updateTransaction(input);
      return { ok: true as const, transaction: updated };
    } catch (err) {
      if (
        err instanceof ORPCError &&
        (err.code === "TRANSACTION_NOT_FOUND" || err.code === "ACCOUNT_NOT_FOUND")
      ) {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

export const deleteTransaction = defineAction<
  DeleteTransactionInput,
  DeleteTransactionResult,
  ActionContext
>({
  name: "deleteTransaction",
  input: deleteTransactionInputSchema,
  tags: [transactionsTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      await transactionsClient.deleteTransaction(input);
      return { ok: true as const };
    } catch (err) {
      if (err instanceof ORPCError && err.code === "TRANSACTION_NOT_FOUND") {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

// Avoid `z.void()` import elision warning when only used in listTransactions —
// no-op below to keep this file self-contained and `z` not orphaned.
void z;
