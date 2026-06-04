"use server";

import { defineAction } from "@zapaction/core";
import { z } from "@pekulo/zod";
import type { DashboardOverview } from "@pekulo/validators";
import { dashboardClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// Story 7-1 — thin oRPC delegator (read-only). Zero business logic on the web
// tier (ADR-0010); the aggregation lives in apps/api dashboard.service.
// ensureRequestContext() seeds the AsyncLocalStorage store defensively before
// the oRPC call (lesson L25 — enterWith propagation on Next 16.x).
export const getDashboardOverview = defineAction<void, DashboardOverview, ActionContext>({
  name: "getDashboardOverview",
  input: z.void(),
  handler: async () => {
    await ensureRequestContext();
    return dashboardClient.getOverview();
  },
});
