"use client";

import { useActionMutation } from "@zapaction/query";
import { createTransaction } from "../_actions/transactions-actions";

// Tag registry handles invalidation: createTransaction.tags includes
// transactionsTags.list() → [TRANSACTIONS_KEY] + accountsKeys.list().
export function useCreateTransaction() {
  return useActionMutation(createTransaction);
}
