"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Account, DeleteAccountInput } from "@pekulo/validators";
import { accountsKeys } from "@/lib/zapaction/keys";
import { deleteAccount, type DeleteAccountResult } from "../_actions/accounts-actions";

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation<
    DeleteAccountResult,
    Error,
    DeleteAccountInput,
    { previous: Account[] | undefined }
  >({
    mutationFn: (input) => deleteAccount(input),
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: accountsKeys.list() });
    },
  });
}
