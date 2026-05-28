"use client";

import { useActionQuery } from "@zapaction/query";
import { compassKeys } from "@/lib/zapaction/keys";
import { getCompassCurve } from "../_actions/compass-actions";

export function useCompassCurve(opts?: { enabled?: boolean }) {
  return useActionQuery(getCompassCurve, {
    input: undefined,
    queryKey: compassKeys.curve(),
    readPolicy: "read-only",
    staleTime: 60_000,
    enabled: opts?.enabled ?? true,
  });
}
