"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionMutation } from "@zapaction/query";
import { REALESTATE_KEY } from "@/lib/zapaction/keys";
import { updateRental } from "../_actions/realestate-actions";

export function useUpdateRental() {
  const queryClient = useQueryClient();
  return useActionMutation(updateRental, {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [REALESTATE_KEY] });
    },
  });
}
