"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionMutation } from "@zapaction/query";
import type { Account } from "@pekulo/validators";
import { accountsKeys, accountsTags } from "@/lib/zapaction/keys";
import { deleteAccount } from "../_actions/accounts-actions";

// Optimistic delete with envelope-handling. The action returns
// `{ ok: false, code }` as data (not an exception) for the FK-probe case;
// onSuccess restores the row when `!result.ok`. invalidateWithTags drives
// the post-success registry invalidation (per lessons.md 2026-05-24 —
// action.tags is server-only); onMutate/onError keep the optimistic UX
// honest under concurrent deletes.
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useActionMutation(deleteAccount, {
    invalidateWithTags: [accountsTags.list()],
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: accountsKeys.list() });
      const previous = queryClient.getQueryData<Account[]>(accountsKeys.list());
      queryClient.setQueryData<Account[]>(
        accountsKeys.list(),
        (old) => old?.filter((acc) => acc.id !== input.id) ?? [],
      );
      return { previous };
    },
    onSuccess: (result, input, ctx) => {
      // Envelope `{ ok: false }` is data, not a thrown error — restore the
      // row mirroring onError. Surgical restore so concurrent deletes do not
      // resurrect each other's removals.
      if (!result.ok) {
        const removed = ctx?.previous?.find((acc) => acc.id === input.id);
        if (!removed) return;
        queryClient.setQueryData<Account[]>(accountsKeys.list(), (cur) => {
          if (!cur) return [removed];
          if (cur.some((acc) => acc.id === removed.id)) return cur;
          return [...cur, removed];
        });
      }
    },
    onError: (_err, input, ctx) => {
      const removed = ctx?.previous?.find((acc) => acc.id === input.id);
      if (!removed) return;
      queryClient.setQueryData<Account[]>(accountsKeys.list(), (cur) => {
        if (!cur) return [removed];
        if (cur.some((acc) => acc.id === removed.id)) return cur;
        return [...cur, removed];
      });
    },
  });
}
