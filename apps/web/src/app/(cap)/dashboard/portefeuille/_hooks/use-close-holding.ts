"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CloseHoldingInput } from "@pekulo/validators";
import { holdingsKeys } from "@/lib/zapaction/keys";
import { closeHolding, type CloseHoldingResult } from "../_actions/holdings-actions";

export function useCloseHolding() {
  const queryClient = useQueryClient();
  return useMutation<CloseHoldingResult, Error, CloseHoldingInput>({
    mutationFn: (input) => closeHolding(input),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: holdingsKeys.list() });
      }
    },
  });
}
