"use client";

// Story 5-2 — read-only side-effect: parse CSV server-side, return row
// breakdown. NO invalidation (the action does not mutate). The form caller
// reads .data / .mutate / .isPending off the returned object.

import { useActionMutation } from "@zapaction/query";
import { previewImportCsv } from "../_actions/transactions-actions";

export function usePreviewImportCsv() {
  return useActionMutation(previewImportCsv);
}
