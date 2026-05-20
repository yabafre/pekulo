// packages/contracts/src/hypothesis.contract.ts
// Hypothesis module oRPC contract — shipped with story 0-6 (zapaction-orpc-bridge).
// Procedures: get (no input, returns the row or defaults) + save (full row in,
// persisted row out). See ADR-0009 (mount under /rpc/v1/hypothesis).

import { oc } from "@orpc/contract";
import { hypothesesSchema } from "@pekulo/validators";

export const hypothesisContractV1 = {
  get: oc.output(hypothesesSchema),
  save: oc.input(hypothesesSchema).output(hypothesesSchema),
} as const;

export const hypothesisContract = hypothesisContractV1;
export const hypothesisContractMeta = {
  moduleKey: "hypothesis",
  mountPath: "/rpc/v1/hypothesis",
  version: "v1",
} as const;
