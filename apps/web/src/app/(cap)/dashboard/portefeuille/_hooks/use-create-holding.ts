"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateHoldingInput } from "@pekulo/validators";
import { holdingsKeys } from "@/lib/zapaction/keys";
import { createHolding, type CreateHoldingResult } from "../_actions/holdings-actions";

export function useCreateHolding() {
  const queryClient = useQueryClient();
  return useMutation<CreateHoldingResult, Error, CreateHoldingInput>({
    mutationFn: (input) => createHolding(input),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: holdingsKeys.list() });
      }
    },
  });
}
