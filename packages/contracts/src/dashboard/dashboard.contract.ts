// packages/contracts/src/dashboard/dashboard.contract.ts
// Dashboard module oRPC contract.
//   - getOverview : cross-domain wealth aggregate + recentActivity (FR-43, 7-2 D3). No input.
//   - getLayout   : the caller's saved widget layout, or null (7-2 D6). No input.
//   - saveLayout  : upsert the caller's widget layout (7-2 D6).
// See ADR-0009 (mount under /rpc/v1/dashboard).

import { oc } from "@orpc/contract";
import {
  dashboardOverviewSchema,
  dashboardLayoutSchema,
  saveDashboardLayoutInputSchema,
  getProjectionInputSchema,
  hypothesisGapSchema,
} from "@pekulo/validators";

export const dashboardContractV1 = {
  getOverview: oc.output(dashboardOverviewSchema),
  getLayout: oc.output(dashboardLayoutSchema.nullable()),
  saveLayout: oc.input(saveDashboardLayoutInputSchema).output(dashboardLayoutSchema),
  // Story 7-4 (FR-59) — projection-vs-compass gap. Input { currentWealthEur }
  // (reused from getProjection); null output when the user has no compass.
  getHypothesisGap: oc.input(getProjectionInputSchema).output(hypothesisGapSchema.nullable()),
} as const;

export const dashboardContract = dashboardContractV1;
export const dashboardContractMeta = {
  moduleKey: "dashboard",
  mountPath: "/rpc/v1/dashboard",
  version: "v1",
} as const;
