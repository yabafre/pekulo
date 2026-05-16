"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Account, UpdateAccountInput } from "@pekulo/validators";
import { accountsKeys } from "@/lib/zapaction/keys";
import { updateAccount } from "@/lib/actions/accounts-actions";

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation<Account, Error, UpdateAccountInput>({
    mutationFn: (input) => updateAccount(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsKeys.list() });
    },
  });
}
