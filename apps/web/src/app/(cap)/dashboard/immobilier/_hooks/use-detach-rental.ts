"use client";

import { useActionMutation } from "@zapaction/query";
import { realestateTags } from "@/lib/zapaction/keys";
import { detachRental } from "../_actions/realestate-actions";

export function useDetachRental() {
  return useActionMutation(detachRental, {
    invalidateWithTags: [realestateTags.list()],
  });
}
