"use client";

import { useActionQuery } from "@zapaction/query";
import { realestateKeys } from "@/lib/zapaction/keys";
import { listPropertyDerives } from "../_actions/realestate-actions";

// Hero source — 4-2 derive surface. Composed client-side with `useProperties`
// inside `realestate-section.tsx` to derive `Equity nette · valuation · debt`.
// Tag invalidation flows through `realestateTags.list()`.
export function useListPropertyDerives() {
  return useActionQuery(listPropertyDerives, {
    input: undefined,
    queryKey: [...realestateKeys.list(), "derives"] as const,
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
