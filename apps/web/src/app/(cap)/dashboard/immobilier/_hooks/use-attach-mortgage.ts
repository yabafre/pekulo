"use client";

import { useActionMutation } from "@zapaction/query";
import { attachMortgage } from "../_actions/realestate-actions";

export function useAttachMortgage() {
  return useActionMutation(attachMortgage);
}
