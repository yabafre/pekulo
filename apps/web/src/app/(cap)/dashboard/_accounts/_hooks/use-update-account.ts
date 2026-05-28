"use client";

import { useActionMutation } from "@zapaction/query";
import { accountsTags } from "@/lib/zapaction/keys";
import { updateAccount } from "../_actions/accounts-actions";

// invalidateWithTags explicit — see use-create-account.ts comment and
// lessons.md 2026-05-24 entry on SA-boundary tag stripping.
export function useUpdateAccount() {
  return useActionMutation(updateAccount, {
    invalidateWithTags: [accountsTags.list()],
  });
}
