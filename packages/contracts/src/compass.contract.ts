// Compass module oRPC contract. Three procedures:
//   - updateCompass: upsert objectif + horizonYears, archive prior in
//     CompassHistory (atomic). Input: UpdateCompassInput. Output: Compass.
//   - getCompass: read the user's current compass. Output: Compass | null.
//   - getSetupState: 'incomplete' | 'complete' (FR-8). No input.
// See ADR-0009 (mount under /rpc/v1/compass).

import { oc } from "@orpc/contract";
import {
  compassSchema,
  compassSetupStateOutputSchema,
  updateCompassInputSchema,
} from "@pekulo/validators";

export const compassContractV1 = {
  updateCompass: oc.input(updateCompassInputSchema).output(compassSchema),
  getCompass: oc.output(compassSchema.nullable()),
  getSetupState: oc.output(compassSetupStateOutputSchema),
} as const;

export const compassContract = compassContractV1;
export const compassContractMeta = {
  moduleKey: "compass",
  mountPath: "/rpc/v1/compass",
  version: "v1",
} as const;
