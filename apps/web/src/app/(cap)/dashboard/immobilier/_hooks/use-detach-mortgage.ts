"use client";

import { useActionMutation } from "@zapaction/query";
import { detachMortgage } from "../_actions/realestate-actions";

export function useDetachMortgage() {
  return useActionMutation(detachMortgage);
}
