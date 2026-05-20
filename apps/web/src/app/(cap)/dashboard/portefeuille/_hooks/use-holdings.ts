"use client";

import { useActionQuery } from "@zapaction/query";
import { holdingsKeys } from "@/lib/zapaction/keys";
import { listHoldings } from "../_actions/holdings-actions";

export function useHoldings() {
  return useActionQuery(listHoldings, {
    input: undefined,
    queryKey: holdingsKeys.list(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
