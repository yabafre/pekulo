"use client";

import { useActionQuery } from "@zapaction/query";
import { transactionsKeys } from "@/lib/zapaction/keys";
import { listTransactions } from "../_actions/transactions-actions";

// Story 6-9 (FR-64) — `month` ("YYYY-MM") scopes the list server-side; `page`
// (1-based) opts into numbered OFFSET pagination (story 6-9 ext, Récentes list)
// and `data.totalCount` then drives the page count. Absent page = cursor mode.
// The queryKey carries month + page so each month/page caches independently.
export function useTransactions(limit = 50, month?: string, page?: number) {
  return useActionQuery(listTransactions, {
    input: { limit, ...(month ? { month } : {}), ...(page ? { page } : {}) },
    queryKey: transactionsKeys.list(limit, month, page),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
