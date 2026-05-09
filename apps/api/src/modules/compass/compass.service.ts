// Domain service for the compass module. Owns:
//   - updateCompass(userId, input): delegates to repository (atomic write)
//   - getCompass(userId): returns the user's compass or null
//   - getSetupState(userId): 'incomplete' if no compass row OR no milestone
//   - computeProgress(input): pure wrapper around derive/compass-progress.ts

import type { Compass, CompassSetupState, MilestonePresenceProbe } from "@pekulo/types";
import type { UpdateCompassInput } from "@pekulo/validators";
import {
  computeProgress,
  type ComputeProgressInput,
  type ComputeProgressOutput,
} from "../../common/derive/compass-progress";
import type { CompassRepository } from "./compass.repository";

export interface CompassService {
  updateCompass(userId: string, input: UpdateCompassInput): Promise<Compass>;
  getCompass(userId: string): Promise<Compass | null>;
  getSetupState(userId: string): Promise<CompassSetupState>;
  computeProgress(input: ComputeProgressInput): ComputeProgressOutput;
}

export function createCompassService(deps: {
  repository: CompassRepository;
  milestonePresenceProbe: MilestonePresenceProbe;
}): CompassService {
  return {
    async updateCompass(userId, input) {
      return deps.repository.upsertCompassWithHistory(userId, input);
    },

    async getCompass(userId) {
      return deps.repository.findCompass(userId);
    },

    async getSetupState(userId) {
      const compass = await deps.repository.findCompass(userId);
      if (!compass) return "incomplete";
      const hasMilestone = await deps.milestonePresenceProbe.hasAny(userId);
      return hasMilestone ? "complete" : "incomplete";
    },

    computeProgress(input) {
      return computeProgress(input);
    },
  };
}
