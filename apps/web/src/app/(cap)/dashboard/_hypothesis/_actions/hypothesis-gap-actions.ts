"use server";

import { defineAction } from "@zapaction/core";
import type { z } from "@pekulo/zod";
import { getProjectionInputSchema, type HypothesisGapDto } from "@pekulo/validators";
import { dashboardClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// Story 7-4 (FR-59) — thin read-only delegator (mirror getDashboardOverview).
// The gap is computed server-side in dashboard.service.getHypothesisGap; the
// output is null when the user has no compass. Read path → no { ok } envelope.
export const getHypothesisGap = defineAction<
  z.infer<typeof getProjectionInputSchema>,
  HypothesisGapDto | null,
  ActionContext
>({
  name: "getHypothesisGap",
  input: getProjectionInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    return dashboardClient.getHypothesisGap(input);
  },
});
