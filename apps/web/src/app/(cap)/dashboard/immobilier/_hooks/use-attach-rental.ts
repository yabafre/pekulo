"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionMutation } from "@zapaction/query";
import { REALESTATE_KEY } from "@/lib/zapaction/keys";
import { attachRental } from "../_actions/realestate-actions";

export function useAttachRental() {
  const queryClient = useQueryClient();
  return useActionMutation(attachRental, {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [REALESTATE_KEY] });
    },
  });
}
