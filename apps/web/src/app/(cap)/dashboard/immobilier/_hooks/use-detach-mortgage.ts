"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionMutation } from "@zapaction/query";
import { REALESTATE_KEY } from "@/lib/zapaction/keys";
import { detachMortgage } from "../_actions/realestate-actions";

export function useDetachMortgage() {
  const queryClient = useQueryClient();
  return useActionMutation(detachMortgage, {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [REALESTATE_KEY] });
    },
  });
}
