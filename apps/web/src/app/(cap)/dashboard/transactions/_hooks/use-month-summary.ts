"use client";

import { useActionQuery } from "@zapaction/query";
import { transactionsKeys } from "@/lib/zapaction/keys";
import { monthSummary } from "../_actions/transactions-actions";

// Story 6-9 (FR-64) — stat-card aggregate for the active month. `month`
// undefined → the server resolves the latest activity month (AC-1) and echoes
// it back in `data.month`; the provider reads that to seed the navigator.
export function useMonthSummary(month?: string) {
  return useActionQuery(monthSummary, {
    input: month ? { month } : {},
    queryKey: transactionsKeys.monthSummary(month),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
