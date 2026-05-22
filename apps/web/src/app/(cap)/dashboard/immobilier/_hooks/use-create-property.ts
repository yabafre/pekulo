"use client";

import { useActionMutation } from "@zapaction/query";
import { createProperty } from "../_actions/realestate-actions";

export function useCreateProperty() {
  return useActionMutation(createProperty);
}
