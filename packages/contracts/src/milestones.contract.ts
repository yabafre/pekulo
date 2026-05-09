// packages/contracts/src/milestones.contract.ts
// Milestones module oRPC contract. Five procedures:
//   - add: insert a milestone (≤ 20/user, year ∈ [currentYear+1, horizon-1]).
//   - update: patch capital/year/label of an existing milestone.
//   - delete: remove a milestone scoped by id+userId.
//   - list: read all milestones for the user, sorted by year asc.
//   - getStatuses: compute per-milestone {ahead, on-track, behind} against the
//     linear plan from currentWealth (input) to compass target.
// See ADR-0009 (mount under /rpc/v1/milestones).

import { oc } from "@orpc/contract";
import {
  addMilestoneInputSchema,
  deleteMilestoneInputSchema,
  deleteMilestoneOutputSchema,
  getStatusesInputSchema,
  getStatusesOutputSchema,
  listMilestonesOutputSchema,
  milestoneSchema,
  updateMilestoneInputSchema,
} from "@pekulo/validators";

export const milestonesContractV1 = {
  add: oc.input(addMilestoneInputSchema).output(milestoneSchema),
  update: oc.input(updateMilestoneInputSchema).output(milestoneSchema),
  delete: oc.input(deleteMilestoneInputSchema).output(deleteMilestoneOutputSchema),
  list: oc.output(listMilestonesOutputSchema),
  getStatuses: oc.input(getStatusesInputSchema).output(getStatusesOutputSchema),
} as const;

export const milestonesContract = milestonesContractV1;
export const milestonesContractMeta = {
  moduleKey: "milestones",
  mountPath: "/rpc/v1/milestones",
  version: "v1",
} as const;
