"use client";

import { useActionMutation } from "@zapaction/query";
import { realestateTags } from "@/lib/zapaction/keys";
import { attachRental } from "../_actions/realestate-actions";

export function useAttachRental() {
  return useActionMutation(attachRental, {
    invalidateWithTags: [realestateTags.list()],
  });
}
