"use client";

import { useActionQuery } from "@zapaction/query";
import { realestateKeys } from "@/lib/zapaction/keys";
import { listValuations } from "../_actions/realestate-actions";

export function useListValuations(propertyId: string | null) {
  return useActionQuery(listValuations, {
    input: { propertyId: propertyId ?? "" },
    enabled: propertyId !== null,
    queryKey: realestateKeys.valuations(propertyId ?? ""),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
