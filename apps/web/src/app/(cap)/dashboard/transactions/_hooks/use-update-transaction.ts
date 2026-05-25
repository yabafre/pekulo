"use client";

import { useActionMutation } from "@zapaction/query";
import { transactionsTags } from "@/lib/zapaction/keys";
import { updateTransaction } from "../_actions/transactions-actions";

// invalidateWithTags explicit — see use-create-transaction.ts comment for
// the SA-boundary tag-stripping rationale.
export function useUpdateTransaction() {
  return useActionMutation(updateTransaction, {
    invalidateWithTags: [transactionsTags.list()],
  });
}
