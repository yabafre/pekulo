"use client";

import { useActionQuery } from "@zapaction/query";
import { getMonthly } from "../_actions/monthly-actions";
import { monthlyKeys } from "@/lib/zapaction/keys";

export function useMonthly(year: number, monthNum: number) {
  return useActionQuery(getMonthly, {
    input: { year, monthNum },
    queryKey: monthlyKeys.get(year, monthNum),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
