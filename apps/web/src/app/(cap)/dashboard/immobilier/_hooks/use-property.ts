"use client";

import { useActionQuery } from "@zapaction/query";
import { realestateKeys } from "@/lib/zapaction/keys";
import { getProperty } from "../_actions/realestate-actions";

export function useProperty(propertyId: string | null) {
  return useActionQuery(getProperty, {
    input: { id: propertyId ?? "" },
    enabled: propertyId !== null,
    queryKey: realestateKeys.byId(propertyId ?? ""),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
