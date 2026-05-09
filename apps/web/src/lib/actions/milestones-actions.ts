"use server";

import { defineAction } from "@zapaction/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
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
import { milestonesTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// Story 1-4 — thin oRPC delegators. MUST NOT import compass-actions.ts
// (pekulo/no-cross-feature-action-import). Cross-feature work happens at
// the hook layer (e.g. useMilestoneStatuses passes currentWealth from
// useDashboardCompass into milestones.getStatuses).

export const listMilestones = defineAction<void, Milestone[], ActionContext>({
  name: "listMilestones",
  input: z.void(),
  output: listMilestonesOutputSchema,
  handler: async () => milestonesClient.list(),
});

export const getMilestoneStatuses = defineAction<
  GetStatusesInput,
  MilestoneStatusEntry[],
  ActionContext
>({
  name: "getMilestoneStatuses",
  input: getStatusesInputSchema,
  handler: async ({ input }) => milestonesClient.getStatuses(input),
});

export const addMilestone = defineAction<AddMilestoneInput, Milestone, ActionContext>({
  name: "addMilestone",
  input: addMilestoneInputSchema,
  output: milestoneSchema,
  tags: [milestonesTags.list()],
  handler: async ({ input }) => {
    const created = await milestonesClient.add(input);
    revalidatePath("/dashboard");
    return created;
  },
});

export const updateMilestone = defineAction<UpdateMilestoneInput, Milestone, ActionContext>({
  name: "updateMilestone",
  input: updateMilestoneInputSchema,
  output: milestoneSchema,
  tags: [milestonesTags.list()],
  handler: async ({ input }) => {
    const updated = await milestonesClient.update(input);
    revalidatePath("/dashboard");
    return updated;
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
    const deleted = await milestonesClient.delete(input);
    revalidatePath("/dashboard");
    return deleted;
  },
});
