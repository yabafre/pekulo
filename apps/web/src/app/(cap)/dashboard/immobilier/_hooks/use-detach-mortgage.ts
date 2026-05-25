"use client";

import { useActionMutation } from "@zapaction/query";
import { realestateTags } from "@/lib/zapaction/keys";
import { detachMortgage } from "../_actions/realestate-actions";

export function useDetachMortgage() {
  return useActionMutation(detachMortgage, {
    invalidateWithTags: [realestateTags.list()],
  });
}
