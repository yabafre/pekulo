"use client";

import { useActionMutation } from "@zapaction/query";
import { realestateTags } from "@/lib/zapaction/keys";
import { attachMortgage } from "../_actions/realestate-actions";

export function useAttachMortgage() {
  return useActionMutation(attachMortgage, {
    invalidateWithTags: [realestateTags.list()],
  });
}
