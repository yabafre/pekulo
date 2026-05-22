"use client";

import { useActionMutation } from "@zapaction/query";
import { deleteProperty } from "../_actions/realestate-actions";

export function useDeleteProperty() {
  return useActionMutation(deleteProperty);
}
