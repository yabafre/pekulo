// Zod source of truth for the compass aggregate. Consumed by @pekulo/contracts
// (oRPC procedure I/O) and apps/api compass service/handler.

import { z } from "zod";

const currentYear = new Date().getUTCFullYear();

// Upper bound on objectif: 1e12 EUR (1 trillion). Persona Alex caps at ~1.5M;
// anything past 1e12 indicates input error and risks float-precision loss when
// roundtripped through Decimal (decimal.js is exact, but JS Number isn't).
const MAX_OBJECTIF_EUR = 1_000_000_000_000;

export const updateCompassInputSchema = z.object({
  objectif: z
    .number()
    .positive("objectif must be > 0")
    .max(MAX_OBJECTIF_EUR, `objectif must be <= ${MAX_OBJECTIF_EUR}`),
  horizonYears: z
    .number()
    .int()
    .min(1, "horizonYears must be >= 1")
    .max(60, "horizonYears must be <= 60"),
});

export type UpdateCompassInput = z.infer<typeof updateCompassInputSchema>;

export const compassSchema = z.object({
  objectif: z.number(),
  horizonYears: z.number().int(),
});

export type Compass = z.infer<typeof compassSchema>;

export const compassSetupStateSchema = z.enum(["incomplete", "complete"]);
export type CompassSetupState = z.infer<typeof compassSetupStateSchema>;

// Wrapped output for the getSetupState oRPC procedure — kept here (not in
// @pekulo/contracts) because @pekulo/contracts intentionally does not depend
// on zod directly; all schema construction lives in @pekulo/validators.
export const compassSetupStateOutputSchema = z.object({ state: compassSetupStateSchema });

// Cross-FR sanity: capital target must allow at least one valid milestone year
// in [currentYear+1, currentYear+horizon-1] (story 1-2 enforces year < compass
// horizon at the per-milestone level).
export const compassHorizonAbsoluteYearSchema = z
  .number()
  .int()
  .min(currentYear + 1)
  .max(currentYear + 60);
