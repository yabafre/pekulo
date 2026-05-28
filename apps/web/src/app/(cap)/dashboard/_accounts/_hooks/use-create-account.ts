"use client";

import { useActionMutation } from "@zapaction/query";
import { accountsTags } from "@/lib/zapaction/keys";
import { createAccount } from "../_actions/accounts-actions";

// Per lessons.md 2026-05-24 "defineAction tags is server-only": Next.js
// "use server" strips the .tags property from the client-side action
// stub, so the consumer must pass invalidateWithTags explicitly. The
// `tags: [...]` declaration on the action stays — it drives Next's
// fetch-cache revalidateTag — but it does NOT drive React Query.
export function useCreateAccount() {
  return useActionMutation(createAccount, {
    invalidateWithTags: [accountsTags.list()],
  });
}
