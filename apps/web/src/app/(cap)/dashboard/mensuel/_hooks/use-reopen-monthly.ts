"use client";

// 5-5 AC-3 / AC-6. Same registry-SSOT shape as useSignOffMonthly.

import { useActionMutation } from "@zapaction/query";
import { reopenMonthly } from "../_actions/monthly-actions";
import { monthlyTags } from "@/lib/zapaction/keys";

export function useReopenMonthly() {
  return useActionMutation(reopenMonthly, {
    invalidateWithTags: [monthlyTags.all()],
  });
}
