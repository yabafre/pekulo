"use client";

import { useActionMutation } from "@zapaction/query";
import { realestateTags } from "@/lib/zapaction/keys";
import { deleteProperty } from "../_actions/realestate-actions";

export function useDeleteProperty() {
  return useActionMutation(deleteProperty, {
    invalidateWithTags: [realestateTags.list()],
  });
}
