"use client";

import { useActionMutation } from "@zapaction/query";
import { realestateTags } from "@/lib/zapaction/keys";
import { recordValuation } from "../_actions/realestate-actions";

export function useRecordValuation() {
  return useActionMutation(recordValuation, {
    invalidateWithTags: [realestateTags.list()],
  });
}
