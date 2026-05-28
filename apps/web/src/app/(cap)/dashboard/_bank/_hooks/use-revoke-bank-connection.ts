"use client";

// Story 5-7 — optimistic revoke (Alex override; see story § Decisions).
// Mirrors use-delete-account.ts: surgical remove on onMutate, surgical
// restore on onError + on `{ ok: false }` so concurrent revokes don't
// resurrect each other's removals.

import { useQueryClient } from "@tanstack/react-query";
import { useActionMutation } from "@zapaction/query";
import type { BankConnection } from "@pekulo/validators";
import { bankConnectionsKeys, bankConnectionsTags } from "@/lib/zapaction/keys";
import { revokeBankConnection } from "../_actions/bank-aggregator-actions";

export function useRevokeBankConnection() {
  const queryClient = useQueryClient();
  return useActionMutation(revokeBankConnection, {
    invalidateWithTags: [bankConnectionsTags.list()],
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: bankConnectionsKeys.list() });
      const previous = queryClient.getQueryData<BankConnection[]>(bankConnectionsKeys.list());
      queryClient.setQueryData<BankConnection[]>(
        bankConnectionsKeys.list(),
        (old) => old?.filter((c) => c.id !== input.connectionId) ?? [],
      );
      return { previous };
    },
    onSuccess: (result, input, ctx) => {
      if (!result.ok) {
        const removed = ctx?.previous?.find((c) => c.id === input.connectionId);
        if (!removed) return;
        queryClient.setQueryData<BankConnection[]>(bankConnectionsKeys.list(), (cur) => {
          if (!cur) return [removed];
          if (cur.some((c) => c.id === removed.id)) return cur;
          return [...cur, removed];
        });
      }
    },
    onError: (_err, input, ctx) => {
      const removed = ctx?.previous?.find((c) => c.id === input.connectionId);
      if (!removed) return;
      queryClient.setQueryData<BankConnection[]>(bankConnectionsKeys.list(), (cur) => {
        if (!cur) return [removed];
        if (cur.some((c) => c.id === removed.id)) return cur;
        return [...cur, removed];
      });
    },
  });
}
