// Pure compass-progress computation. FR-5: returns the ratio currentWealth /
// capitalTarget as a percentage rounded to 1 decimal, plus the absolute gap
// (capitalTarget - currentWealth). Throws CompassError on invalid inputs.

import { CompassError } from "../../modules/compass/compass.errors";

export interface ComputeProgressInput {
  currentWealth: number;
  capitalTarget: number;
}

export interface ComputeProgressOutput {
  percent: number;
  gap: number;
}

export function computeProgress(input: ComputeProgressInput): ComputeProgressOutput {
  if (input.capitalTarget <= 0) {
    throw new CompassError("INVALID_TARGET", "capitalTarget must be > 0");
  }
  if (input.currentWealth < 0) {
    throw new CompassError("INVALID_WEALTH", "currentWealth must be >= 0");
  }
  const rawPercent = (input.currentWealth / input.capitalTarget) * 100;
  // FR-5 / PRD line 225 — rounded to 1 decimal.
  const percent = Math.round(rawPercent * 10) / 10;
  const gap = input.capitalTarget - input.currentWealth;
  return { percent, gap };
}
