"use client";

import { useActionMutation } from "@zapaction/query";
import { transactionsTags } from "@/lib/zapaction/keys";
import { confirmCategorisation } from "../_actions/transactions-actions";

// invalidateWithTags explicit — the SA boundary strips action.tags (lessons.md
// 2026-05-24). transactionsTags.list() → bare [TRANSACTIONS_KEY] prefix →
// refreshes BOTH the pending list AND Récentes in one shot.
export function useConfirmCategorisation() {
  return useActionMutation(confirmCategorisation, {
    invalidateWithTags: [transactionsTags.list()],
  });
}
