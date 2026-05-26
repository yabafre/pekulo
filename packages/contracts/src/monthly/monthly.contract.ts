// packages/contracts/src/monthly/monthly.contract.ts
// Monthly module oRPC contract. 5-4 shipped 3 procedures
// (getMonthly / upsertMonthly / listMonthly). 5-5 adds:
//   - signOffMonthly  → atomic upsert + freeze (input mirrors upsertMonthly +
//                       service stamps signedOffAt = now() inside $transaction)
//   - reopenMonthly   → clears signedOffAt on an existing row
// Mount under /rpc/v1/monthly per ADR-0009 (sub-tree-versioned — additive).

import { oc } from "@orpc/contract";
import {
  getMonthlyInputSchema,
  getMonthlyOutputSchema,
  listMonthlyInputSchema,
  listMonthlyOutputSchema,
  monthlyRecordSchema,
  reopenMonthlyInputSchema,
  signOffMonthlyInputSchema,
  upsertMonthlyInputSchema,
} from "@pekulo/validators";

export const monthlyContractV1 = {
  getMonthly: oc.input(getMonthlyInputSchema).output(getMonthlyOutputSchema),
  upsertMonthly: oc.input(upsertMonthlyInputSchema).output(monthlyRecordSchema),
  listMonthly: oc.input(listMonthlyInputSchema).output(listMonthlyOutputSchema),
  signOffMonthly: oc.input(signOffMonthlyInputSchema).output(monthlyRecordSchema),
  reopenMonthly: oc.input(reopenMonthlyInputSchema).output(monthlyRecordSchema),
} as const;

export const monthlyContract = monthlyContractV1;
export const monthlyContractMeta = {
  moduleKey: "monthly",
  mountPath: "/rpc/v1/monthly",
  version: "v1",
} as const;
