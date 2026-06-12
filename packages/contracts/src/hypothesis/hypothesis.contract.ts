// packages/contracts/src/hypothesis.contract.ts
// Hypothesis module oRPC contract — shipped with story 0-6 (zapaction-orpc-bridge).
// Procedures: get (no input, returns the row or defaults) + save (full row in,
// persisted row out). See ADR-0009 (mount under /rpc/v1/hypothesis).

import { oc } from "@orpc/contract";
import {
  hypothesesSchema,
  recordProjectionSchema,
  getProjectionInputSchema,
  hypothesisProjectionSchema,
} from "@pekulo/validators";

export const hypothesisContractV1 = {
  get: oc.output(hypothesesSchema),
  save: oc.input(hypothesesSchema).output(hypothesesSchema),
  // Story 7-3 (FR-57) — record the projection inputs (4 fields).
  recordProjection: oc.input(recordProjectionSchema).output(recordProjectionSchema),
  // Story 7-3 (FR-58) — project the wealth curve. currentWealthEur is supplied
  // by the caller (the 7-1 dashboard overview total).
  getProjection: oc.input(getProjectionInputSchema).output(hypothesisProjectionSchema),
} as const;

export const hypothesisContract = hypothesisContractV1;
export const hypothesisContractMeta = {
  moduleKey: "hypothesis",
  mountPath: "/rpc/v1/hypothesis",
  version: "v1",
} as const;
