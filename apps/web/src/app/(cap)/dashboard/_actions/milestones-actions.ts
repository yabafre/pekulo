"use server";

import { defineAction } from "@zapaction/core";
import { z } from "@pekulo/zod";
import {
  addMilestoneInputSchema,
  deleteMilestoneInputSchema,
  deleteMilestoneOutputSchema,
  getStatusesInputSchema,
  listMilestonesOutputSchema,
  milestoneSchema,
  updateMilestoneInputSchema,
  type AddMilestoneInput,
  type DeleteMilestoneInput,
  type DeleteMilestoneOutput,
  type GetStatusesInput,
  type Milestone,
  type MilestoneStatusEntry,
  type UpdateMilestoneInput,
} from "@pekulo/validators";
import { milestonesClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { milestonesTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// Story 1-4 — thin oRPC delegators. MUST NOT import compass-actions.ts
// (pekulo/no-cross-feature-action-import). Cross-feature work happens at
// the hook layer (e.g. useMilestoneStatuses passes currentWealth from
// useDashboardCompass into milestones.getStatuses).
//
// Each handler ensures request context defensively before the oRPC call —
// see lesson L25 + the comment at the top of compass-actions.ts.

export const listMilestones = defineAction<void, Milestone[], ActionContext>({
  name: "listMilestones",
  input: z.void(),
  output: listMilestonesOutputSchema,
  handler: async () => {
    await ensureRequestContext();
    return milestonesClient.list();
  },
});

export const getMilestoneStatuses = defineAction<
  GetStatusesInput,
  MilestoneStatusEntry[],
  ActionContext
>({
  name: "getMilestoneStatuses",
  input: getStatusesInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    return milestonesClient.getStatuses(input);
  },
});

export const addMilestone = defineAction<AddMilestoneInput, Milestone, ActionContext>({
  name: "addMilestone",
  input: addMilestoneInputSchema,
  output: milestoneSchema,
  tags: [milestonesTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    return milestonesClient.add(input);
  },
});

export const updateMilestone = defineAction<UpdateMilestoneInput, Milestone, ActionContext>({
  name: "updateMilestone",
  input: updateMilestoneInputSchema,
  output: milestoneSchema,
  tags: [milestonesTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    return milestonesClient.update(input);
  },
});

export const deleteMilestone = defineAction<
  DeleteMilestoneInput,
  DeleteMilestoneOutput,
  ActionContext
>({
  name: "deleteMilestone",
  input: deleteMilestoneInputSchema,
  output: deleteMilestoneOutputSchema,
  tags: [milestonesTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    return milestonesClient.delete(input);
  },
});
