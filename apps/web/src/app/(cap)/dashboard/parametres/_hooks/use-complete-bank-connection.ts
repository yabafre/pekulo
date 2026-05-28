"use client";

// Story 5-6 (T26) — ZapAction mutation hook for Bridge OAuth completion.
//
// On success, both the bank connections list AND the transactions list
// invalidate so the parametres connections row + the transactions list
// repaint after a successful complete. The transactions edge in
// keys.ts already cascades to MONTHLY_KEY + accountsKeys.list, so a single
// transactionsTags.list() in the invalidate array refreshes everything
// downstream.

import { useActionMutation } from "@zapaction/query";
import { completeBankConnection } from "../_actions/bank-aggregator-actions";
import { bankConnectionsTags, transactionsTags } from "@/lib/zapaction/keys";

export function useCompleteBankConnection() {
  return useActionMutation(completeBankConnection, {
    invalidateWithTags: [bankConnectionsTags.list(), transactionsTags.list()],
  });
}
