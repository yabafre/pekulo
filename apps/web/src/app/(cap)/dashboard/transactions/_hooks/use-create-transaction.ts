"use client";

import { useActionMutation } from "@zapaction/query";
import { transactionsTags } from "@/lib/zapaction/keys";
import { createTransaction } from "../_actions/transactions-actions";
import { armSuggestionPoll } from "./use-pending-suggestions";

// Pass invalidateWithTags explicitly — Next.js "use server" wraps every
// exported action in a client-side RPC stub that does NOT preserve the
// custom `.tags` property attached by defineAction. Reading `action.tags`
// on the client returns undefined and the tag-registry invalidation is
// silently skipped. The accounts/realestate hooks paper over this by
// shipping optimistic setQueryData paths; the transactions hook relies on
// the registry as SSOT, so the tag has to come from this side.
export function useCreateTransaction() {
  return useActionMutation(createTransaction, {
    invalidateWithTags: [transactionsTags.list()],
    // A successful "autre" create may produce an async LLM suggestion (the
    // server categorises fire-and-forget). Arm the bounded poll so the
    // Suggestions IA section picks it up without a manual refresh. Non-"autre"
    // creates never get a suggestion (server early-returns) → don't poll.
    onSuccess: (result, variables) => {
      if (result.ok && variables.category === "autre") armSuggestionPoll();
    },
  });
}
