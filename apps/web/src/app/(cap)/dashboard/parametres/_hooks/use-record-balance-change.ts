"use client";

import { useActionMutation } from "@zapaction/query";
import { recordBalanceChange } from "../_actions/accounts-actions";

// `recordBalanceChange` returns `{ ok: false, code: "ACCOUNT_NOT_FOUND" }`
// as data on the not-found path. The tag registry still invalidates on this
// successful (non-throwing) call — the cache then re-fetches and matches
// what the server has (the row is unchanged, so this is a no-op extra
// round-trip — acceptable; surfacing the error remains the form's job via
// `result.code`).
export function useRecordBalanceChange() {
  return useActionMutation(recordBalanceChange);
}
