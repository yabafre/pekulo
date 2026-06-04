"use server";

// apps/web/src/app/(cap)/dashboard/_actions/dashboard-layout-actions.ts
// Story 7-2 (D6) — thin oRPC delegators for the per-user widget layout. Zero
// business logic on the web tier (ADR-0010); the layout service in apps/api is
// the trust boundary. getLayout returns null when the user has no saved layout.
import { defineAction } from "@zapaction/core";
import { z } from "@pekulo/zod";
import {
  saveDashboardLayoutInputSchema,
  type DashboardLayout,
  type SaveDashboardLayoutInput,
} from "@pekulo/validators";
import { dashboardClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";
import { dashboardLayoutTags } from "@/lib/zapaction/keys";

export const getDashboardLayout = defineAction<void, DashboardLayout | null, ActionContext>({
  name: "getDashboardLayout",
  input: z.void(),
  handler: async () => {
    await ensureRequestContext();
    return dashboardClient.getLayout();
  },
});

export const saveDashboardLayout = defineAction<
  SaveDashboardLayoutInput,
  DashboardLayout,
  ActionContext
>({
  name: "saveDashboardLayout",
  input: saveDashboardLayoutInputSchema,
  tags: [dashboardLayoutTags.current()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    return dashboardClient.saveLayout(input);
  },
});
