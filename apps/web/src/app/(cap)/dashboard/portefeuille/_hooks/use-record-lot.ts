"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RecordLotInput } from "@pekulo/validators";
import { holdingsKeys } from "@/lib/zapaction/keys";
import { recordLot, type RecordLotResult } from "../_actions/holdings-actions";

export function useRecordLot() {
  const queryClient = useQueryClient();
  return useMutation<RecordLotResult, Error, RecordLotInput>({
    mutationFn: (input) => recordLot(input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: holdingsKeys.list() });
    },
  });
}
