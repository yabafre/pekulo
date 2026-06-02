"use client";

import { useActionQuery } from "@zapaction/query";
import { transactionsKeys } from "@/lib/zapaction/keys";
import { listPendingSuggestions } from "../_actions/transactions-actions";

// LLM categorisation runs fire-and-forget AFTER createTransaction returns
// (NFR-1: never block the create on the model), so the suggestion lands in the
// DB ~1–3 s later. A one-shot invalidation on create fires too early — the row
// isn't written yet — which is why the suggestion only appeared after a manual
// refresh. Fix: a BOUNDED poll. useCreateTransaction arms a short window on a
// successful "autre" create; usePendingSuggestions polls every 2 s while the
// window is open, then stops. Idle cost is zero (refetchInterval returns false
// when disarmed). Module-level, not Zustand (not a dep here) — a single shared
// timestamp is enough.
const POLL_WINDOW_MS = 12_000;
const POLL_INTERVAL_MS = 2_000;
let pollUntil = 0;

/** Open the bounded refetch window (called from useCreateTransaction). */
export function armSuggestionPoll(): void {
  pollUntil = Date.now() + POLL_WINDOW_MS;
}

// `page` is 1-based; `pageSize` defaults to 10 (the contract default). Story 6-9
// ext — `month` ("YYYY-MM") scopes the pending list + the "À confirmer" count to
// the active month; each (page, month) caches independently under
// transactionsKeys.pending(page, month). Absent = the unscoped backlog.
export function usePendingSuggestions(page = 1, pageSize = 10, month?: string) {
  return useActionQuery(listPendingSuggestions, {
    input: month ? { page, pageSize, month } : { page, pageSize },
    queryKey: transactionsKeys.pending(page, month),
    readPolicy: "read-only",
    staleTime: 30_000,
    // RQ re-evaluates this after every fetch → the poll self-terminates once the
    // window elapses (returns false). No re-render needed to stop it.
    refetchInterval: () => (Date.now() < pollUntil ? POLL_INTERVAL_MS : false),
  });
}
