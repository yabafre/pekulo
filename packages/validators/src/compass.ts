// Zod source of truth for the compass aggregate. Consumed by @pekulo/contracts
// (oRPC procedure I/O) and apps/api compass service/handler.

import { z } from "@pekulo/zod";

const currentYear = new Date().getUTCFullYear();

// Domain constants — exported as the SSOT for validator bounds AND
// downstream consumers (apps/api service, apps/web forms, @pekulo/types
// re-exports). Same centralization rule as the types (2026-05-09 invariant).

// Upper bound on objectif: 1e12 EUR (1 trillion). Persona Alex caps at ~1.5M;
// anything past 1e12 indicates input error and risks float-precision loss when
// roundtripped through Decimal (decimal.js is exact, but JS Number isn't).
export const MAX_OBJECTIF_EUR = 1_000_000_000_000;
// Compass horizon bounds (story 1-2 review hardening: min bumped 1→2 so the
// milestones service's [currentYear+1, currentYear+horizon-1] range cannot
// be empty by construction).
export const MIN_HORIZON_YEARS = 2;
export const MAX_HORIZON_YEARS = 60;

export const updateCompassInputSchema = z.object({
  objectif: z
    .number()
    .positive("objectif must be > 0")
    .max(MAX_OBJECTIF_EUR, `objectif must be <= ${MAX_OBJECTIF_EUR}`),
  horizonYears: z
    .number()
    .int()
    // Min 2 (not 1): with horizonYears=1 the milestones service would derive
    // an empty allowed range [currentYear+1, currentYear] and reject every
    // input — the compass becomes structurally inert. min(2) guarantees at
    // least one valid milestone year exists (story 1-2 cross-FR sanity).
    .min(MIN_HORIZON_YEARS, `horizonYears must be >= ${MIN_HORIZON_YEARS}`)
    .max(MAX_HORIZON_YEARS, `horizonYears must be <= ${MAX_HORIZON_YEARS}`),
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
  .max(currentYear + MAX_HORIZON_YEARS);

// Compass-progress curve (FR-7, story 1-3). Time-series envelope returned by
// compass.getCompassCurve — paired plan (linear projection from compass start
// to today, anchored at compass.objectif on horizon end) and actual (wealth
// snapshots from MonthlyTracking). Both arrays are sorted ascending by at.
export const compassCurvePointSchema = z.object({
  at: z.date(),
  eur: z.number(),
});
export type CompassCurvePoint = z.infer<typeof compassCurvePointSchema>;

export const compassCurveSchema = z.object({
  startedAt: z.date(),
  actual: z.array(compassCurvePointSchema),
  plan: z.array(compassCurvePointSchema),
});
export type CompassCurve = z.infer<typeof compassCurveSchema>;

// Compass progress (FR-5, story 1-4) — server-side computation surfaces the
// donut-ready payload so the web tier does not aggregate wealth itself.
export const compassProgressSchema = z.object({
  currentWealth: z.number(),
  objectif: z.number(),
  horizonYears: z.number().int(),
  percent: z.number(),
  gap: z.number(),
});
export type CompassProgress = z.infer<typeof compassProgressSchema>;

// Compass history entry (story 1-4 — exposes the existing repository.listHistory
// method through the contract). Mirrors the @pekulo/types CompassHistoryEntry
// interface 1:1 — kept here as the runtime SSOT so the contract egress validates.
export const compassHistoryEntrySchema = z.object({
  id: z.string().regex(/^cph_[0-9A-Za-z]{21}$/),
  userId: z.string().uuid(),
  objectif: z.number(),
  horizonYears: z.number().int(),
  valuedOn: z.date(),
  createdAt: z.date(),
});
export type CompassHistoryEntryRuntime = z.infer<typeof compassHistoryEntrySchema>;

export const listHistoryInputSchema = z
  .object({
    limit: z.number().int().min(1).max(200).optional(),
  })
  .optional();
export type ListHistoryInput = z.infer<typeof listHistoryInputSchema>;

export const listHistoryOutputSchema = z.array(compassHistoryEntrySchema);
