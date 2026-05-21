"use client";

import { useActionMutation } from "@zapaction/query";
import { updateMortgage } from "../_actions/realestate-actions";

export function useUpdateMortgage() {
  return useActionMutation(updateMortgage);
}
