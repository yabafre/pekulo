"use server";

import { defineAction } from "@zapaction/core";
import { ORPCError } from "@orpc/client";
import {
  confirmCategorisationInputSchema,
  createTransactionInputSchema,
  deleteTransactionInputSchema,
  importCsvInputSchema,
  listPendingSuggestionsInputSchema,
  listPendingSuggestionsOutputSchema,
  listTransactionsInputSchema,
  listTransactionsOutputSchema,
  monthSummaryInputSchema,
  monthSummaryOutputSchema,
  previewImportCsvInputSchema,
  updateTransactionInputSchema,
  type ConfirmCategorisationInput,
  type CreateTransactionInput,
  type DeleteTransactionInput,
  type ImportCsvInput,
  type ListPendingSuggestionsInput,
  type ListPendingSuggestionsOutput,
  type ListTransactionsInput,
  type ListTransactionsOutput,
  type MonthSummaryInput,
  type MonthSummaryOutput,
  type PreviewImportCsvInput,
  type PreviewImportCsvOutput,
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

export type ConfirmCategorisationResult =
  | { ok: true; transaction: Transaction }
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

export const monthSummary = defineAction<MonthSummaryInput, MonthSummaryOutput, ActionContext>({
  name: "monthSummary",
  input: monthSummaryInputSchema,
  output: monthSummaryOutputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    return transactionsClient.monthSummary(input);
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

// Story 6-4 (FR-33) — OMIT `output:` (discriminated-union envelope, lesson
// 2026-05-20). tags drive Next revalidate; React Query invalidation comes via
// the hook's invalidateWithTags (R12).
export const confirmCategorisation = defineAction<
  ConfirmCategorisationInput,
  ConfirmCategorisationResult,
  ActionContext
>({
  name: "confirmCategorisation",
  input: confirmCategorisationInputSchema,
  tags: [transactionsTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const transaction = await transactionsClient.confirmCategorisation(input);
      return { ok: true as const, transaction };
    } catch (err) {
      if (err instanceof ORPCError && err.code === "TRANSACTION_NOT_FOUND") {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

// Read — keeps `output:` (no typed error to surface). Offset-paginated (10/page).
export const listPendingSuggestions = defineAction<
  ListPendingSuggestionsInput,
  ListPendingSuggestionsOutput,
  ActionContext
>({
  name: "listPendingSuggestions",
  input: listPendingSuggestionsInputSchema,
  output: listPendingSuggestionsOutputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    return transactionsClient.listPendingSuggestions(input);
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

// ─── CSV import (story 5-2) ──────────────────────────────────────────────
// Both actions OMIT `output:` per the 2026-05-20 envelope-discipline lesson —
// zapaction core runs output.parse(result) unconditionally and would reject
// the { ok: false } branch otherwise. previewImportCsv has no `tags:` (it's
// a read-only side effect server-side); importCsv carries tags for Next's
// revalidateTag fetch-cache invalidation (React Query side comes via the
// useImportTransactionsCsvForm hook's invalidateWithTags option, per R12).

export type PreviewImportCsvResult =
  | ({ ok: true } & PreviewImportCsvOutput)
  | { ok: false; code: "INVALID_CSV" | "PAYLOAD_TOO_LARGE"; message: string };

export type ImportCsvResult =
  | { ok: true; persisted: number }
  | { ok: false; code: "ACCOUNT_NOT_FOUND"; message: string };

export const previewImportCsv = defineAction<
  PreviewImportCsvInput,
  PreviewImportCsvResult,
  ActionContext
>({
  name: "previewImportCsv",
  input: previewImportCsvInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const out = await transactionsClient.previewImportCsv(input);
      return { ok: true as const, ...out };
    } catch (err) {
      if (
        err instanceof ORPCError &&
        (err.code === "INVALID_CSV" || err.code === "PAYLOAD_TOO_LARGE")
      ) {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

export const importCsv = defineAction<ImportCsvInput, ImportCsvResult, ActionContext>({
  name: "importCsv",
  input: importCsvInputSchema,
  tags: [transactionsTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const out = await transactionsClient.importCsv(input);
      return { ok: true as const, persisted: out.persisted };
    } catch (err) {
      if (err instanceof ORPCError && err.code === "ACCOUNT_NOT_FOUND") {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});
