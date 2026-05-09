// Compass module oRPC contract. Six procedures (story 1-1: 3 ; story 1-3: +1 ; story 1-4: +2):
//   - updateCompass: upsert objectif + horizonYears, archive prior in
//     CompassHistory (atomic). Input: UpdateCompassInput. Output: Compass.
//   - getCompass: read the user's current compass. Output: Compass | null.
//   - getSetupState: 'incomplete' | 'complete' (FR-8). No input.
//   - getCompassCurve: projected vs actual wealth curve (FR-7, story 1-3).
//   - getCurrentProgress: server-side donut payload (FR-5, story 1-4).
//   - listHistory: append-only audit history (FR-2, story 1-4 — surfaces
//     the existing repository method via the contract).
// See ADR-0009 (mount under /rpc/v1/compass).

import { oc } from "@orpc/contract";
import {
  compassCurveSchema,
  compassProgressSchema,
  compassSchema,
  compassSetupStateOutputSchema,
  listHistoryInputSchema,
  listHistoryOutputSchema,
  updateCompassInputSchema,
} from "@pekulo/validators";

export const compassContractV1 = {
  updateCompass: oc.input(updateCompassInputSchema).output(compassSchema),
  getCompass: oc.output(compassSchema.nullable()),
  getSetupState: oc.output(compassSetupStateOutputSchema),
  getCompassCurve: oc.output(compassCurveSchema),
  getCurrentProgress: oc.output(compassProgressSchema),
  listHistory: oc.input(listHistoryInputSchema).output(listHistoryOutputSchema),
} as const;

export const compassContract = compassContractV1;
export const compassContractMeta = {
  moduleKey: "compass",
  mountPath: "/rpc/v1/compass",
  version: "v1",
} as const;
