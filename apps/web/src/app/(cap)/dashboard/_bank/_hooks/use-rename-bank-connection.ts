"use client";

// Story 5-7 — optimistic rename (Alex override of lesson 2026-05-25; see
// docs/stories/5-7-bridge-ui.md § Decisions). Snapshot → patch → SURGICAL
// rollback on onError + on `{ ok: false }`: only the renamed row's displayName
// is restored (mirrors use-revoke-bank-connection.ts / use-delete-account.ts),
// so a concurrent revoke on another row isn't undone by a whole-list snapshot
// replacement. invalidateWithTags drives the post-success registry
// invalidation; useQueryClient is used ONLY for snapshot/rollback.

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useActionMutation } from "@zapaction/query";
import type { BankConnection } from "@pekulo/validators";
import { bankConnectionsKeys, bankConnectionsTags } from "@/lib/zapaction/keys";
import { renameBankConnection } from "../_actions/bank-aggregator-actions";

function restoreDisplayName(
  queryClient: QueryClient,
  connectionId: string,
  previousName: string | null,
) {
  queryClient.setQueryData<BankConnection[]>(bankConnectionsKeys.list(), (cur) =>
    cur?.map((c) => (c.id === connectionId ? { ...c, displayName: previousName } : c)),
  );
}

export function useRenameBankConnection() {
  const queryClient = useQueryClient();
  return useActionMutation(renameBankConnection, {
    invalidateWithTags: [bankConnectionsTags.list()],
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: bankConnectionsKeys.list() });
      const previous = queryClient.getQueryData<BankConnection[]>(bankConnectionsKeys.list());
      const previousName = previous?.find((c) => c.id === input.connectionId)?.displayName ?? null;
      queryClient.setQueryData<BankConnection[]>(
        bankConnectionsKeys.list(),
        (old) =>
          old?.map((c) =>
            c.id === input.connectionId ? { ...c, displayName: input.displayName } : c,
          ) ?? [],
      );
      return { previousName };
    },
    onSuccess: (result, input, ctx) => {
      if (!result.ok)
        restoreDisplayName(queryClient, input.connectionId, ctx?.previousName ?? null);
    },
    onError: (_err, input, ctx) => {
      restoreDisplayName(queryClient, input.connectionId, ctx?.previousName ?? null);
    },
  });
}
