"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionMutation } from "@zapaction/query";
import { REALESTATE_KEY } from "@/lib/zapaction/keys";
import { detachRental } from "../_actions/realestate-actions";

export function useDetachRental() {
  const queryClient = useQueryClient();
  return useActionMutation(detachRental, {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [REALESTATE_KEY] });
    },
  });
}
