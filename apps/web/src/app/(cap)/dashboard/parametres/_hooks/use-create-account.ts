"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Account, CreateAccountInput } from "@pekulo/validators";
import { accountsKeys } from "@/lib/zapaction/keys";
import { createAccount } from "../_actions/accounts-actions";

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation<Account, Error, CreateAccountInput>({
    mutationFn: (input) => createAccount(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsKeys.list() });
    },
  });
}
