// packages/contracts/src/monthly/monthly.contract.ts
// Monthly module oRPC contract. 5-4 shipped 3 procedures
// (getMonthly / upsertMonthly / listMonthly). 5-5 adds:
//   - signOffMonthly  → atomic upsert + freeze (input mirrors upsertMonthly +
//                       service stamps signedOffAt = now() inside $transaction)
//   - reopenMonthly   → clears signedOffAt on an existing row
// Mount under /rpc/v1/monthly per ADR-0009 (sub-tree-versioned — additive).
//
// Typed errors per 5-5: MONTHLY_OUT_OF_WINDOW (409) / MONTHLY_SIGNED_OFF (409)
// on the freeze path; MONTHLY_NOT_FOUND (404) on the reopen path; the
// upsertMonthly guard also surfaces MONTHLY_SIGNED_OFF defense-in-depth.

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

const monthlyOutOfWindowError = {
  status: 409 as const,
  message: "monthly out of window",
};
const monthlySignedOffError = {
  status: 409 as const,
  message: "monthly signed off",
};
const monthlyNotFoundError = {
  status: 404 as const,
  message: "monthly not found",
};

export const monthlyContractV1 = {
  getMonthly: oc.input(getMonthlyInputSchema).output(getMonthlyOutputSchema),
  upsertMonthly: oc
    .errors({ MONTHLY_SIGNED_OFF: monthlySignedOffError })
    .input(upsertMonthlyInputSchema)
    .output(monthlyRecordSchema),
  listMonthly: oc.input(listMonthlyInputSchema).output(listMonthlyOutputSchema),
  signOffMonthly: oc
    .errors({
      MONTHLY_OUT_OF_WINDOW: monthlyOutOfWindowError,
      MONTHLY_SIGNED_OFF: monthlySignedOffError,
    })
    .input(signOffMonthlyInputSchema)
    .output(monthlyRecordSchema),
  reopenMonthly: oc
    .errors({ MONTHLY_NOT_FOUND: monthlyNotFoundError })
    .input(reopenMonthlyInputSchema)
    .output(monthlyRecordSchema),
} as const;

export const monthlyContract = monthlyContractV1;
export const monthlyContractMeta = {
  moduleKey: "monthly",
  mountPath: "/rpc/v1/monthly",
  version: "v1",
} as const;
