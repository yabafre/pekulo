"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateAccountInput } from "@pekulo/validators";
import { accountsKeys } from "@/lib/zapaction/keys";
import { updateAccount, type UpdateAccountResult } from "@/lib/actions/accounts-actions";

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation<UpdateAccountResult, Error, UpdateAccountInput>({
    mutationFn: (input) => updateAccount(input),
    onSuccess: (result) => {
      // Envelope `{ ok: false }` is data, not a thrown error — only
      // invalidate when the mutation succeeded server-side (matches the
      // delete-account precedent). Surfacing the ACCOUNT_NOT_FOUND case to
      // the form is the caller's job (renders `result.message` in role=alert).
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: accountsKeys.list() });
      }
    },
  });
}
