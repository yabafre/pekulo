"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionMutation } from "@zapaction/query";
import { REALESTATE_KEY } from "@/lib/zapaction/keys";
import { updateMortgage } from "../_actions/realestate-actions";

export function useUpdateMortgage() {
  const queryClient = useQueryClient();
  return useActionMutation(updateMortgage, {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [REALESTATE_KEY] });
    },
  });
}
