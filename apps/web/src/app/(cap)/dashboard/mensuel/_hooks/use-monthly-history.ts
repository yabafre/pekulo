"use client";

import { useActionQuery } from "@zapaction/query";
import { listMonthly } from "../_actions/monthly-actions";
import { monthlyKeys } from "@/lib/zapaction/keys";

// History window — current month + N past months (matches ux-preview
// MonthlyScreen where MONTHLY[0] is current and slice(1) is past).
const DEFAULT_HISTORY_LIMIT = 6;

export function useMonthlyHistory(limit: number = DEFAULT_HISTORY_LIMIT) {
  return useActionQuery(listMonthly, {
    input: { limit },
    // Reuse the existing monthly prefix so the transactionsTags.list →
    // [MONTHLY_KEY] edge invalidates the history alongside the singular
    // getMonthly cache entries (AC-5).
    queryKey: monthlyKeys.list(limit),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
