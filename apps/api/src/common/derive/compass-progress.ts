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
  // Defense in depth: route boundary already validates via updateCompassInputSchema,
  // but this helper is callable from any module so NaN / Infinity must be rejected
  // here too — a NaN target would slip past `<= 0` and surface NaN downstream.
  if (!Number.isFinite(input.capitalTarget) || input.capitalTarget <= 0) {
    throw new CompassError("INVALID_TARGET", "capitalTarget must be a finite number > 0");
  }
  if (!Number.isFinite(input.currentWealth) || input.currentWealth < 0) {
    throw new CompassError("INVALID_WEALTH", "currentWealth must be a finite number >= 0");
  }
  const rawPercent = (input.currentWealth / input.capitalTarget) * 100;
  // FR-5 / PRD line 225 — rounded to 1 decimal. Math.round in V8 rounds half
  // toward +Infinity, not banker's rounding. Acceptable for percent display;
  // callers wanting exact decimal arithmetic should bypass this helper.
  const percent = Math.round(rawPercent * 10) / 10;
  const gap = input.capitalTarget - input.currentWealth;
  return { percent, gap };
}
