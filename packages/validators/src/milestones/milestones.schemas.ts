// Zod source of truth for the milestone domain. Consumed by @pekulo/contracts
// (oRPC procedure I/O) and apps/api milestones service / handler.
//
// Note on MilestoneStatus (Q2=B, story 1-2): the Postgres enum (declared in
// apps/api/prisma/schema/enums.prisma forward-compat) uses `on_track` (snake),
// while the API/UI surface uses `'on-track'` (kebab) per PRD/AC literal.
// No DB column references the enum at V1 — the asymmetry only matters when a
// future story persists a snapshot status (then a write-time mapping kicks in).

import { z } from "@pekulo/zod";

// Domain constants — exported as the SSOT for both validator bounds AND
// downstream consumers (apps/api service caps, apps/web form maxLength,
// @pekulo/types re-exports). Same centralization rule as the types
// (project invariant 2026-05-09). Anyone needing these imports from
// @pekulo/types, never inlines a literal.

// Upper bound on targetCapital: 1e9 EUR (1 billion). Tighter than compass
// MAX_OBJECTIF_EUR (1e12) because targetCapital flows through the JS Number
// write path (not coerced via Prisma.Decimal at ingress) — IEEE-754 starts
// losing integer precision around 9e15 but cents-precision (×100) needs the
// safe-integer range to round-trip fractional EUR safely. 1e9 EUR is well
// above Persona Alex's plausible cap (~1.5M) and keeps all values in the
// fully-safe range. Story 1-2 review hardening.
export const MAX_TARGET_CAPITAL_EUR = 1_000_000_000;
export const MAX_LABEL_LENGTH = 120;
// Per-user cap on milestone rows (FR-3). Centralized here so apps/web
// can gate the "+" button + apps/api service can throw consistently.
export const MILESTONES_PER_USER_CAP = 20;
// FR-6 ±5% band — `|delta| <= ratio × targetCapital` classifies a milestone
// as 'on-track'; outside the band, sign of delta picks 'ahead' (delta < 0)
// or 'behind' (delta > 0). Centralized so apps/web can show the same band
// in tooltips ("ahead by > 5%") without duplicating the magic number.
export const MILESTONE_STATUS_TOLERANCE_RATIO = 0.05;
const PREFIXED_ID_RE = /^mst_[0-9A-Za-z]{21}$/;

export const milestoneIdSchema = z
  .string()
  .regex(PREFIXED_ID_RE, "id must match /^mst_[0-9A-Za-z]{21}$/");

export const milestoneStatusSchema = z.enum(["ahead", "on-track", "behind"]);
export type MilestoneStatus = z.infer<typeof milestoneStatusSchema>;

export const addMilestoneInputSchema = z.object({
  targetCapital: z
    .number()
    .positive("targetCapital must be > 0")
    .max(MAX_TARGET_CAPITAL_EUR, `targetCapital must be <= ${MAX_TARGET_CAPITAL_EUR}`),
  targetYear: z.number().int().min(1, "targetYear must be a positive integer"),
  label: z
    .string()
    .trim()
    .min(1, "label cannot be empty whitespace")
    .max(MAX_LABEL_LENGTH, `label must be <= ${MAX_LABEL_LENGTH} chars`)
    .optional(),
});
export type AddMilestoneInput = z.infer<typeof addMilestoneInputSchema>;

export const updateMilestoneInputSchema = z
  .object({
    id: milestoneIdSchema,
    targetCapital: z
      .number()
      .positive("targetCapital must be > 0")
      .max(MAX_TARGET_CAPITAL_EUR)
      .optional(),
    targetYear: z.number().int().min(1).optional(),
    label: z.string().trim().min(1).max(MAX_LABEL_LENGTH).nullable().optional(),
  })
  .refine(
    (v) => v.targetCapital !== undefined || v.targetYear !== undefined || v.label !== undefined,
    { message: "at least one of targetCapital / targetYear / label must be provided" },
  );
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneInputSchema>;

export const deleteMilestoneInputSchema = z.object({ id: milestoneIdSchema });
export type DeleteMilestoneInput = z.infer<typeof deleteMilestoneInputSchema>;

export const milestoneSchema = z.object({
  id: milestoneIdSchema,
  userId: z.string().uuid(),
  targetCapital: z.number(),
  targetYear: z.number().int(),
  label: z.string().nullable(),
  position: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Milestone = z.infer<typeof milestoneSchema>;

export const milestoneStatusEntrySchema = z.object({
  id: milestoneIdSchema,
  status: milestoneStatusSchema,
  expectedAt: z.number(),
  delta: z.number(),
});
export type MilestoneStatusEntry = z.infer<typeof milestoneStatusEntrySchema>;

export const listMilestonesOutputSchema = z.array(milestoneSchema);

export const getStatusesInputSchema = z.object({
  currentWealth: z.number().min(0, "currentWealth must be >= 0"),
});
export type GetStatusesInput = z.infer<typeof getStatusesInputSchema>;

export const getStatusesOutputSchema = z.array(milestoneStatusEntrySchema);

export const deleteMilestoneOutputSchema = z.object({ id: milestoneIdSchema });
export type DeleteMilestoneOutput = z.infer<typeof deleteMilestoneOutputSchema>;
