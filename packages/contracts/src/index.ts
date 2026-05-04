// packages/contracts/src/index.ts
// Aggregate barrel for @pekulo/contracts.
// Per-module exports stay sovereign so consumers can `import { authContract } from "@pekulo/contracts"`
// without dragging the full pekuloContract object.
// The top-level `pekuloContract` is for the apps/api oRPC mount and the apps/web
// typed client factory — both want the keyed router shape.

export { authContract, authContractV1, authContractMeta } from "./auth.contract";
export { compassContract, compassContractV1, compassContractMeta } from "./compass.contract";
export { milestonesContract, milestonesContractV1, milestonesContractMeta } from "./milestones.contract";
export { accountsContract, accountsContractV1, accountsContractMeta } from "./accounts.contract";
export { holdingsContract, holdingsContractV1, holdingsContractMeta } from "./holdings.contract";
export { realestateContract, realestateContractV1, realestateContractMeta } from "./realestate.contract";
export { transactionsContract, transactionsContractV1, transactionsContractMeta } from "./transactions.contract";
export { monthlyContract, monthlyContractV1, monthlyContractMeta } from "./monthly.contract";
export { dashboardContract, dashboardContractV1, dashboardContractMeta } from "./dashboard.contract";
export { settingsContract, settingsContractV1, settingsContractMeta } from "./settings.contract";
export { hypothesisContract, hypothesisContractV1, hypothesisContractMeta } from "./hypothesis.contract";
export { llmContract, llmContractV1, llmContractMeta } from "./llm.contract";

import { authContract } from "./auth.contract";
import { compassContract } from "./compass.contract";
import { milestonesContract } from "./milestones.contract";
import { accountsContract } from "./accounts.contract";
import { holdingsContract } from "./holdings.contract";
import { realestateContract } from "./realestate.contract";
import { transactionsContract } from "./transactions.contract";
import { monthlyContract } from "./monthly.contract";
import { dashboardContract } from "./dashboard.contract";
import { settingsContract } from "./settings.contract";
import { hypothesisContract } from "./hypothesis.contract";
import { llmContract } from "./llm.contract";

/**
 * Top-level Pekulo oRPC contract aggregator.
 *
 * Keyed by module name. Used by:
 * - `apps/api/src/platform/http/orpc-mount.ts` to build the RPCHandler router.
 * - `apps/web/src/lib/orpc/modules.ts` to spawn per-module typed clients.
 *
 * Adding a module: add its file under `packages/contracts/src/<module>.contract.ts`,
 * re-export here, and append it to this object literal.
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
