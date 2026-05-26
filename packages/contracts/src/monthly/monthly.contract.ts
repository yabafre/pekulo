// packages/contracts/src/monthly/monthly.contract.ts
// Monthly module oRPC contract (story 5-4). 2 procedures:
//   - getMonthly  → derived defaults OR persisted row (discriminated `source`)
//   - upsertMonthly → idempotent override persistence
// Mount under /rpc/v1/monthly per ADR-0009.

import { oc } from "@orpc/contract";
import {
  getMonthlyInputSchema,
  getMonthlyOutputSchema,
  monthlyRecordSchema,
  upsertMonthlyInputSchema,
} from "@pekulo/validators";

export const monthlyContractV1 = {
  getMonthly: oc.input(getMonthlyInputSchema).output(getMonthlyOutputSchema),
  upsertMonthly: oc.input(upsertMonthlyInputSchema).output(monthlyRecordSchema),
} as const;

export const monthlyContract = monthlyContractV1;
export const monthlyContractMeta = {
  moduleKey: "monthly",
  mountPath: "/rpc/v1/monthly",
  version: "v1",
} as const;
