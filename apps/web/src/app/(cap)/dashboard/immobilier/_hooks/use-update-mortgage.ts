"use client";

import { useActionMutation } from "@zapaction/query";
import { realestateTags } from "@/lib/zapaction/keys";
import { updateMortgage } from "../_actions/realestate-actions";

export function useUpdateMortgage() {
  return useActionMutation(updateMortgage, {
    invalidateWithTags: [realestateTags.list()],
  });
}
