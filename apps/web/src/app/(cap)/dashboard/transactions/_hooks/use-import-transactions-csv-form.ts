"use client";

// Story 5-2 — bulk-insert mutation hook. R12 (2026-05-24 lesson): the
// invalidateWithTags option lives on the consumer side, not on the action's
// `tags:` field — Next's "use server" stub strips Object.defineProperty
// extras, so the action-level tags only drive Next's revalidateTag(). React
// Query cache invalidation must come from the hook here.

import { useActionMutation } from "@zapaction/query";
import { importCsv } from "../_actions/transactions-actions";
import { transactionsTags } from "@/lib/zapaction/keys";

export function useImportTransactionsCsvForm() {
  return useActionMutation(importCsv, {
    invalidateWithTags: [transactionsTags.list()],
  });
}
