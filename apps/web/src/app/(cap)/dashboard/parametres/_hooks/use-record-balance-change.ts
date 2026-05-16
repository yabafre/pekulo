"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Account, RecordBalanceChangeInput } from "@pekulo/validators";
import { accountsKeys } from "@/lib/zapaction/keys";
import { recordBalanceChange } from "@/lib/actions/accounts-actions";

export function useRecordBalanceChange() {
  const queryClient = useQueryClient();
  return useMutation<Account, Error, RecordBalanceChangeInput>({
    mutationFn: (input) => recordBalanceChange(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsKeys.list() });
    },
  });
}
