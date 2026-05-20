// packages/contracts/src/index.ts
// Aggregate barrel for @pekulo/contracts.
// Per-module exports stay sovereign so consumers can `import { authContract } from "@pekulo/contracts"`
// without dragging the full pekuloContract object.
// The top-level `pekuloContract` is for the apps/api oRPC mount and the apps/web
// typed client factory — both want the keyed router shape.
//
// Folder-by-domain layout: each contract lives under `<domain>/<domain>.contract.ts`
// with a sibling `<domain>/index.ts` barrel — this file aggregates from those barrels.

export { authContract, authContractV1, authContractMeta } from "./auth";
export { compassContract, compassContractV1, compassContractMeta } from "./compass";
export { milestonesContract, milestonesContractV1, milestonesContractMeta } from "./milestones";
export { accountsContract, accountsContractV1, accountsContractMeta } from "./accounts";
export { holdingsContract, holdingsContractV1, holdingsContractMeta } from "./holdings";
export { realestateContract, realestateContractV1, realestateContractMeta } from "./realestate";
export {
  transactionsContract,
  transactionsContractV1,
  transactionsContractMeta,
} from "./transactions";
export { monthlyContract, monthlyContractV1, monthlyContractMeta } from "./monthly";
export { dashboardContract, dashboardContractV1, dashboardContractMeta } from "./dashboard";
export { settingsContract, settingsContractV1, settingsContractMeta } from "./settings";
export { hypothesisContract, hypothesisContractV1, hypothesisContractMeta } from "./hypothesis";
export { llmContract, llmContractV1, llmContractMeta } from "./llm";

import { authContract } from "./auth";
import { compassContract } from "./compass";
import { milestonesContract } from "./milestones";
import { accountsContract } from "./accounts";
import { holdingsContract } from "./holdings";
import { realestateContract } from "./realestate";
import { transactionsContract } from "./transactions";
import { monthlyContract } from "./monthly";
import { dashboardContract } from "./dashboard";
import { settingsContract } from "./settings";
import { hypothesisContract } from "./hypothesis";
import { llmContract } from "./llm";

/**
 * Top-level Pekulo oRPC contract aggregator.
 *
 * Keyed by module name. Used by:
 * - `apps/api/src/platform/http/orpc-mount.ts` to build the RPCHandler router.
 * - `apps/web/src/lib/orpc/modules.ts` to spawn per-module typed clients.
 *
 * Adding a module: add its file under `packages/contracts/src/<module>/<module>.contract.ts`,
 * add a sibling `<module>/index.ts` barrel, re-export here, and append it to this object literal.
 */
export const pekuloContract = {
  auth: authContract,
  compass: compassContract,
  milestones: milestonesContract,
  accounts: accountsContract,
  holdings: holdingsContract,
  realestate: realestateContract,
  transactions: transactionsContract,
  monthly: monthlyContract,
  dashboard: dashboardContract,
  settings: settingsContract,
  hypothesis: hypothesisContract,
  llm: llmContract,
} as const;

/**
 * Top-level wire version. Increments only when an oRPC-runtime breaking change
 * forces a global bump. Per-module sub-tree bumps stay encoded in each module's
 * `<module>ContractMeta.version` and its `mountPath`.
 */
export const PEKULO_CONTRACT_VERSION = "v1" as const;
