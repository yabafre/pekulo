"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionMutation } from "@zapaction/query";
import { REALESTATE_KEY } from "@/lib/zapaction/keys";
import { deleteProperty } from "../_actions/realestate-actions";

export function useDeleteProperty() {
  const queryClient = useQueryClient();
  return useActionMutation(deleteProperty, {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [REALESTATE_KEY] });
    },
  });
}
