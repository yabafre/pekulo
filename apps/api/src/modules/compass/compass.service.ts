// Domain service for the compass module. Owns:
//   - updateCompass(userId, input): delegates to repository (atomic write)
//   - getCompass(userId): returns the user's compass or null
//   - getSetupState(userId): 'incomplete' if no compass row OR no milestone
//   - computeProgress(input): pure wrapper around derive/compass-progress.ts
//   - getCompassCurve(userId): orchestrates compass + start-date + wealth
//     snapshots into the FR-7 plan/actual time-series via the pure helper.

import type {
  Compass,
  CompassCurve,
  CompassSetupState,
  MilestonePresenceProbe,
  WealthHistoryProvider,
} from "@pekulo/types";
import type { UpdateCompassInput } from "@pekulo/validators";
import {
  computeProgress,
  type ComputeProgressInput,
  type ComputeProgressOutput,
} from "../../common/derive/compass-progress";
import { computeCompassCurve } from "../../common/derive/compass-curve";
import { CompassError } from "./compass.errors";
import type { CompassRepository } from "./compass.repository";

export interface CompassService {
  updateCompass(userId: string, input: UpdateCompassInput): Promise<Compass>;
  getCompass(userId: string): Promise<Compass | null>;
  getSetupState(userId: string): Promise<CompassSetupState>;
  computeProgress(input: ComputeProgressInput): ComputeProgressOutput;
  getCompassCurve(userId: string): Promise<CompassCurve>;
}

export function createCompassService(deps: {
  repository: CompassRepository;
  milestonePresenceProbe: MilestonePresenceProbe;
  wealthHistoryProvider: WealthHistoryProvider;
  // Injected so tests can pin determinism without monkey-patching Date
  // (story 1-3 §"Testing approach" decision). Default = real wall clock.
  clock?: () => Date;
}): CompassService {
  const clock = deps.clock ?? (() => new Date());

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

    async getCompassCurve(userId) {
      const compass = await deps.repository.findCompass(userId);
      if (!compass) {
        throw new CompassError("COMPASS_NOT_FOUND", "compass not set");
      }
      const startDate = await deps.repository.findCompassStartDate(userId);
      if (!startDate) {
        // Story 1-1's atomic upsert always co-writes the audit row, so this
        // branch is unreachable on a healthy DB. Defensive guard kept so a
        // policy/index drift can't surface a NaN-strewn curve to the UI.
        throw new CompassError(
          "TRANSACTION_FAILED",
          "compass history missing — invariant violation",
        );
      }
      const snapshots = await deps.wealthHistoryProvider.read(userId);
      return computeCompassCurve({
        compass,
        startDate,
        today: clock(),
        snapshots,
      });
    },
  };
}
