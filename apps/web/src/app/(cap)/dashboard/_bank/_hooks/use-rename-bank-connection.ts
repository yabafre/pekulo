"use client";

// Story 5-7 — optimistic rename (Alex override of lesson 2026-05-25; see
// docs/stories/5-7-bridge-ui.md § Decisions). Snapshot → patch → rollback on
// onError + on `{ ok: false }`. invalidateWithTags drives the post-success
// registry invalidation; useQueryClient is used ONLY for snapshot/rollback.

import { useQueryClient } from "@tanstack/react-query";
import { useActionMutation } from "@zapaction/query";
import type { BankConnection } from "@pekulo/validators";
import { bankConnectionsKeys, bankConnectionsTags } from "@/lib/zapaction/keys";
import { renameBankConnection } from "../_actions/bank-aggregator-actions";

export function useRenameBankConnection() {
  const queryClient = useQueryClient();
  return useActionMutation(renameBankConnection, {
    invalidateWithTags: [bankConnectionsTags.list()],
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: bankConnectionsKeys.list() });
      const previous = queryClient.getQueryData<BankConnection[]>(bankConnectionsKeys.list());
      queryClient.setQueryData<BankConnection[]>(
        bankConnectionsKeys.list(),
        (old) =>
          old?.map((c) =>
            c.id === input.connectionId ? { ...c, displayName: input.displayName } : c,
          ) ?? [],
      );
      return { previous };
    },
    onSuccess: (result, _input, ctx) => {
      if (!result.ok && ctx?.previous) {
        queryClient.setQueryData<BankConnection[]>(bankConnectionsKeys.list(), ctx.previous);
      }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData<BankConnection[]>(bankConnectionsKeys.list(), ctx.previous);
      }
    },
  });
}
