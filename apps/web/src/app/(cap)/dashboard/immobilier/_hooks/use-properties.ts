"use client";

import { useActionQuery } from "@zapaction/query";
import { realestateKeys } from "@/lib/zapaction/keys";
import { listProperties } from "../_actions/realestate-actions";

export function useProperties() {
  return useActionQuery(listProperties, {
    input: undefined,
    queryKey: realestateKeys.list(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
