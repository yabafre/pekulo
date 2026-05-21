"use client";

import { useActionMutation } from "@zapaction/query";
import { recordValuation } from "../_actions/realestate-actions";

export function useRecordValuation() {
  return useActionMutation(recordValuation);
}
