"use client";

import { useActionMutation } from "@zapaction/query";
import { realestateTags } from "@/lib/zapaction/keys";
import { updateRental } from "../_actions/realestate-actions";

export function useUpdateRental() {
  return useActionMutation(updateRental, {
    invalidateWithTags: [realestateTags.list()],
  });
}
