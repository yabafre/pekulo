// packages/contracts/src/dashboard/dashboard.contract.ts
// Dashboard module oRPC contract. One read procedure:
//   - getOverview: cross-domain wealth aggregate (FR-43). No input.
// See ADR-0009 (mount under /rpc/v1/dashboard).

import { oc } from "@orpc/contract";
import { dashboardOverviewSchema } from "@pekulo/validators";

export const dashboardContractV1 = {
  getOverview: oc.output(dashboardOverviewSchema),
} as const;

export const dashboardContract = dashboardContractV1;
export const dashboardContractMeta = {
  moduleKey: "dashboard",
  mountPath: "/rpc/v1/dashboard",
  version: "v1",
} as const;
