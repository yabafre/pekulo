"use client";

import { useActionMutation } from "@zapaction/query";
import { realestateTags } from "@/lib/zapaction/keys";
import { createProperty } from "../_actions/realestate-actions";

export function useCreateProperty() {
  return useActionMutation(createProperty, {
    invalidateWithTags: [realestateTags.list()],
  });
}
