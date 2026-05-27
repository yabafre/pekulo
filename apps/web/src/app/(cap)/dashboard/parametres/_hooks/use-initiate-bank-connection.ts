"use client";

// Story 5-6 (T26) — ZapAction mutation hook for Bridge OAuth init.
//
// Lessons applied:
// - 2026-05-20 (R3/R4): hook MUST consume useActionMutation from
//   @zapaction/query — never raw @tanstack/react-query.
// - 2026-05-24 / 2026-05-27 (R12): invalidate via `invalidateWithTags`. Even
//   though initiateConnection itself doesn't change DB state (it only returns
//   a Bridge-hosted URL), we still invalidate `bankConnectionsTags.list()`
//   defensively — the UI may rebind on the next successful complete.

import { useActionMutation } from "@zapaction/query";
import { initiateBankConnection } from "../_actions/bank-aggregator-actions";
import { bankConnectionsTags } from "@/lib/zapaction/keys";

export function useInitiateBankConnection() {
  return useActionMutation(initiateBankConnection, {
    invalidateWithTags: [bankConnectionsTags.list()],
  });
}
