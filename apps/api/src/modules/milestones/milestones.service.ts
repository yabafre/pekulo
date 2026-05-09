// Domain service for the milestones module. Owns:
//   - add: enforce ≤ 20 cap (FR-3), year ∈ [currentYear+1, currentYear+horizonYears-1] strict,
//          compass existence (FR-8 precondition).
//   - update: enforce existence (cross-user yields MILESTONE_NOT_FOUND), year-range guard
//             when targetYear is updated.
//   - delete: enforce existence (cross-user yields MILESTONE_NOT_FOUND).
//   - list: passthrough to repository.
//   - computeStatuses: thin wrapper around the pure helper, requires compass presence.

import type {
  CompassReader,
  Milestone,
  MilestonePresenceProbe,
  MilestoneStatusEntry,
} from "@pekulo/types";
import { MILESTONES_PER_USER_CAP } from "@pekulo/types";
import type { AddMilestoneInput, UpdateMilestoneInput } from "@pekulo/validators";
import { computeStatuses } from "../../common/derive/milestone-status";
import { MilestoneError } from "./milestones.errors";
import type { MilestoneRepository } from "./milestones.repository";

// Re-exported for backwards-compat; new callers should import from @pekulo/types.
export { MILESTONES_PER_USER_CAP };

export interface MilestoneService {
  add(userId: string, input: AddMilestoneInput): Promise<Milestone>;
  update(userId: string, input: UpdateMilestoneInput): Promise<Milestone>;
  delete(userId: string, id: string): Promise<{ id: string }>;
  list(userId: string): Promise<Milestone[]>;
  computeStatuses(userId: string, currentWealth: number): Promise<MilestoneStatusEntry[]>;
  presenceProbe(): MilestonePresenceProbe;
}

function assertYearInRange(targetYear: number, currentYear: number, horizonYears: number): void {
  // Strict: targetYear must be in [currentYear+1, currentYear+horizonYears-1].
  // currentYear excluded (AC-4); compass horizon (currentYear+horizonYears)
  // excluded (AC-3).
  const minYear = currentYear + 1;
  const maxYear = currentYear + horizonYears - 1;
  if (!Number.isInteger(targetYear) || targetYear < minYear || targetYear > maxYear) {
    throw new MilestoneError(
      "MILESTONE_YEAR_OUT_OF_RANGE",
      `targetYear must be in [${minYear}, ${maxYear}] (got ${targetYear})`,
    );
  }
}

export function createMilestoneService(deps: {
  repository: MilestoneRepository;
  compassReader: CompassReader;
  now?: () => Date;
}): MilestoneService {
  const now = deps.now ?? (() => new Date());
  // currentYear is derived from UTC, not the host clock, so the year boundary
  // flips at 00:00 UTC for every user. A user in UTC+2 making a request at
  // 23:59 local on Dec 31 sees the service compute year Y+1. Acceptable for
  // V1 (Persona Alex, France=UTC+1/+2, no NYE midnight workflows). Re-evaluate
  // when timezone-aware horizon arithmetic lands.
  const currentYear = () => now().getUTCFullYear();

  return {
    async add(userId, input) {
      const compass = await deps.compassReader.read(userId);
      if (!compass) {
        throw new MilestoneError(
          "COMPASS_REQUIRED",
          "compass must be set before adding milestones",
        );
      }
      assertYearInRange(input.targetYear, currentYear(), compass.horizonYears);
      // Cap + insert atomically in a $transaction (TOCTOU fix). A bare
      // count→add sequence can race past the cap when two requests arrive at
      // count = cap-1 (no DB constraint on user_id row count).
      const result = await deps.repository.addEnforcingCap(userId, input, MILESTONES_PER_USER_CAP);
      if ("capExceeded" in result) {
        throw new MilestoneError(
          "MILESTONE_LIMIT_EXCEEDED",
          `milestones cap is ${MILESTONES_PER_USER_CAP} per user`,
        );
      }
      return result;
    },

    async update(userId, input) {
      const { id, ...patch } = input;
      const existing = await deps.repository.findByIdForUser(userId, id);
      if (!existing) {
        throw new MilestoneError("MILESTONE_NOT_FOUND", `milestone ${id} not found`);
      }
      if (patch.targetYear !== undefined) {
        const compass = await deps.compassReader.read(userId);
        if (!compass) {
          throw new MilestoneError(
            "COMPASS_REQUIRED",
            "compass must be set before updating milestone year",
          );
        }
        assertYearInRange(patch.targetYear, currentYear(), compass.horizonYears);
      }
      const updated = await deps.repository.update(userId, id, patch);
      if (!updated) {
        // Race: row vanished between findByIdForUser and update — surface the
        // same not-found error rather than INTERNAL.
        throw new MilestoneError("MILESTONE_NOT_FOUND", `milestone ${id} not found`);
      }
      return updated;
    },

    async delete(userId, id) {
      // Asymmetry vs add/update/computeStatuses: no compass-presence check.
      // A milestone may legitimately outlive its compass (e.g. compass row
      // wiped but milestone rows orphaned by a partial delete elsewhere) —
      // pruning must remain possible. Cross-user isolation is still enforced
      // via the repository's { id, userId } filter.
      const ok = await deps.repository.delete(userId, id);
      if (!ok) {
        throw new MilestoneError("MILESTONE_NOT_FOUND", `milestone ${id} not found`);
      }
      return { id };
    },

    async list(userId) {
      return deps.repository.listByUser(userId);
    },

    async computeStatuses(userId, currentWealth) {
      const compass = await deps.compassReader.read(userId);
      if (!compass) {
        throw new MilestoneError(
          "COMPASS_REQUIRED",
          "compass must be set before computing milestone statuses",
        );
      }
      const milestones = await deps.repository.listByUser(userId);
      return computeStatuses({
        currentWealth,
        currentYear: currentYear(),
        compass,
        milestones: milestones.map((m) => ({
          id: m.id,
          targetCapital: m.targetCapital,
          targetYear: m.targetYear,
        })),
      });
    },

    presenceProbe() {
      return {
        async hasAny(userId) {
          return deps.repository.hasAny(userId);
        },
      };
    },
  };
}
