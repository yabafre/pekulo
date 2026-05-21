"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionMutation } from "@zapaction/query";
import { REALESTATE_KEY } from "@/lib/zapaction/keys";
import { attachMortgage } from "../_actions/realestate-actions";

export function useAttachMortgage() {
  const queryClient = useQueryClient();
  return useActionMutation(attachMortgage, {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [REALESTATE_KEY] });
    },
  });
}
