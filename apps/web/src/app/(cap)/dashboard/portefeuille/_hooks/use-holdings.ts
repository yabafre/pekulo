"use client";

import { useQuery } from "@tanstack/react-query";
import type { Holding } from "@pekulo/validators";
import { holdingsKeys } from "@/lib/zapaction/keys";
import { listHoldings } from "../_actions/holdings-actions";

export function useHoldings() {
  return useQuery<Holding[]>({
    queryKey: holdingsKeys.list(),
    queryFn: () => listHoldings(),
    staleTime: 30_000,
  });
}
