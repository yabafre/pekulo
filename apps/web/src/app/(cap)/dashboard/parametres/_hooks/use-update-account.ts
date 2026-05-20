"use client";

import { useActionMutation } from "@zapaction/query";
import { updateAccount } from "../_actions/accounts-actions";

// Envelope `{ ok: false }` is data; the form renders `result.message` in
// role=alert. The tag registry invalidates regardless (no-op refetch on the
// not-found path — acceptable cost for one consistent pattern).
export function useUpdateAccount() {
  return useActionMutation(updateAccount);
}
