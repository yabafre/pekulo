"use client";

import { useActionQuery } from "@zapaction/query";
import { transactionsKeys } from "@/lib/zapaction/keys";
import { listTransactions } from "../_actions/transactions-actions";

export function useTransactions(limit = 50) {
  return useActionQuery(listTransactions, {
    input: { limit },
    queryKey: transactionsKeys.list(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
