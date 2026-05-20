"use client";

import { useActionMutation } from "@zapaction/query";
import { createAccount } from "../_actions/accounts-actions";

// Tag registry handles invalidation: `createAccount.tags` includes
// `accountsTags.list()`, mapped by setTagRegistry to `accountsKeys.list()`
// + the portfolio aggregate keys downstream.
export function useCreateAccount() {
  return useActionMutation(createAccount);
}
