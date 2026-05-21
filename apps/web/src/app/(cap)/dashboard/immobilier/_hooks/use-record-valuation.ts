"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionMutation } from "@zapaction/query";
import { REALESTATE_KEY } from "@/lib/zapaction/keys";
import { recordValuation } from "../_actions/realestate-actions";

export function useRecordValuation() {
  const queryClient = useQueryClient();
  return useActionMutation(recordValuation, {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [REALESTATE_KEY] });
    },
  });
}
