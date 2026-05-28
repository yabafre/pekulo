"use client";

import { useActionQuery } from "@zapaction/query";
import { compassKeys } from "@/lib/zapaction/keys";
import { listHistory } from "../_actions/compass-actions";

export function useCompassHistory(opts?: { limit?: number }) {
  return useActionQuery(listHistory, {
    input: opts ? { limit: opts.limit } : undefined,
    queryKey: compassKeys.history(opts?.limit),
    readPolicy: "read-only",
    staleTime: 60_000,
  });
}
