"use client";

import { useActionMutation } from "@zapaction/query";
import { accountsTags } from "@/lib/zapaction/keys";
import { recordBalanceChange } from "../_actions/accounts-actions";

// invalidateWithTags explicit — see use-create-account.ts comment.
export function useRecordBalanceChange() {
  return useActionMutation(recordBalanceChange, {
    invalidateWithTags: [accountsTags.list()],
  });
}
