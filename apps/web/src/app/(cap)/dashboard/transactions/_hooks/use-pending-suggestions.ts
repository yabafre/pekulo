"use client";

import { useActionQuery } from "@zapaction/query";
import { transactionsKeys } from "@/lib/zapaction/keys";
import { listPendingSuggestions } from "../_actions/transactions-actions";

export function usePendingSuggestions() {
  return useActionQuery(listPendingSuggestions, {
    input: undefined,
    queryKey: transactionsKeys.pending(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
