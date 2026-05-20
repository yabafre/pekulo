"use client";

import { useActionMutation } from "@zapaction/query";
import { recordLot } from "../_actions/holdings-actions";

// Envelope `{ ok: false }` surfaced to the form. Tag registry handles
// invalidation of holdingsKeys.list() + portfolio aggregate.
export function useRecordLot() {
  return useActionMutation(recordLot);
}
