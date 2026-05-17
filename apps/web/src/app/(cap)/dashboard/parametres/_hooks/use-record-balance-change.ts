"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RecordBalanceChangeInput } from "@pekulo/validators";
import { accountsKeys } from "@/lib/zapaction/keys";
import {
  recordBalanceChange,
  type RecordBalanceChangeResult,
} from "@/lib/actions/accounts-actions";

export function useRecordBalanceChange() {
  const queryClient = useQueryClient();
  return useMutation<RecordBalanceChangeResult, Error, RecordBalanceChangeInput>({
    mutationFn: (input) => recordBalanceChange(input),
    onSuccess: (result) => {
      // Envelope `{ ok: false }` is data, not a thrown error — only invalidate
      // when the mutation succeeded server-side. ACCOUNT_NOT_FOUND surfaces
      // through `result.code` for the form to render.
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: accountsKeys.list() });
      }
    },
  });
}
