// Pure helper for FR-6 — per-milestone status against a linear plan from
// today's wealth to the compass target. Q3=A formula:
//
//   expectedAt(year) = currentWealth + (compass.objectif - currentWealth)
//                       × (year - currentYear) / compass.horizonYears
//   delta            = milestone.targetCapital - expectedAt(milestone.targetYear)
//   tolerance        = 0.05 × milestone.targetCapital   // ±5% band
//
//   |delta| ≤ tolerance       → 'on-track'
//   delta < 0                 → 'ahead'   (target sits below the line — comfortable margin)
//   delta > 0                 → 'behind'  (target sits above the line — needs out-performance)
//
// Pure: no I/O. Defense-in-depth guards (NaN / negative / out-of-range) match
// the route boundary's Zod validation but are also asserted here because the
// helper is callable from any module (dashboard composition, service tests).

import { MilestoneError } from "../../modules/milestones/milestones.errors";
import type { MilestoneStatus, MilestoneStatusEntry } from "@pekulo/types";

export interface ComputeStatusesInput {
  currentWealth: number;
  currentYear: number;
  compass: { objectif: number; horizonYears: number };
  milestones: ReadonlyArray<{ id: string; targetCapital: number; targetYear: number }>;
}

const TOLERANCE_RATIO = 0.05;

export function computeStatuses(input: ComputeStatusesInput): MilestoneStatusEntry[] {
  if (!Number.isFinite(input.currentWealth) || input.currentWealth < 0) {
    throw new MilestoneError("INVALID_WEALTH", "currentWealth must be a finite number >= 0");
  }
  if (!Number.isFinite(input.currentYear) || !Number.isInteger(input.currentYear)) {
    throw new MilestoneError("INVALID_TARGET", "currentYear must be a finite integer");
  }
  if (!Number.isFinite(input.compass.objectif) || input.compass.objectif <= 0) {
    throw new MilestoneError("INVALID_TARGET", "compass.objectif must be a finite number > 0");
  }
  if (
    !Number.isFinite(input.compass.horizonYears) ||
    !Number.isInteger(input.compass.horizonYears) ||
    input.compass.horizonYears <= 0
  ) {
    throw new MilestoneError("INVALID_TARGET", "compass.horizonYears must be a positive integer");
  }

  const slope = (input.compass.objectif - input.currentWealth) / input.compass.horizonYears;

  return input.milestones.map((m) => {
    if (!Number.isFinite(m.targetCapital) || m.targetCapital <= 0) {
      throw new MilestoneError(
        "MILESTONE_INVALID_CAPITAL",
        `milestone ${m.id}: targetCapital must be > 0`,
      );
    }
    if (!Number.isInteger(m.targetYear) || m.targetYear <= input.currentYear) {
      throw new MilestoneError(
        "MILESTONE_YEAR_OUT_OF_RANGE",
        `milestone ${m.id}: targetYear must be a future integer year`,
      );
    }
    const yearOffset = m.targetYear - input.currentYear;
    const expectedAt = input.currentWealth + slope * yearOffset;
    const delta = m.targetCapital - expectedAt;
    const tolerance = TOLERANCE_RATIO * m.targetCapital;
    let status: MilestoneStatus;
    if (Math.abs(delta) <= tolerance) status = "on-track";
    else if (delta < 0) status = "ahead";
    else status = "behind";
    return { id: m.id, status, expectedAt, delta };
  });
}
