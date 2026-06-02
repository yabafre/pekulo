"use client";

import { useActionQuery } from "@zapaction/query";
import { transactionsKeys } from "@/lib/zapaction/keys";
import { listTransactions } from "../_actions/transactions-actions";

// Story 6-9 (FR-64) — `month` ("YYYY-MM") scopes the list server-side. Absent
// = the unscoped recent window (pre-6-9 callers unchanged). The queryKey
// carries `month` so each month caches independently.
export function useTransactions(limit = 50, month?: string) {
  return useActionQuery(listTransactions, {
    input: month ? { limit, month } : { limit },
    queryKey: transactionsKeys.list(limit, month),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
