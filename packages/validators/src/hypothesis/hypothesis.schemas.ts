// packages/validators/src/hypothesis.ts
// Zod source of truth for the hypothesis row + defaults. Consumed by
// @pekulo/contracts (oRPC procedure I/O), apps/api hypothesis service
// (validation + DB mapping), and apps/web hypothesis-form (TanStack Form
// resolver).

import { z } from "@pekulo/zod";

const ratio = z.number().min(0).max(1);
const positive = z.number().min(0);

export const hypothesesSchema = z.object({
  salaireNet: positive,
  ticketRestoJour: positive,
  partEmployeurTr: ratio,
  joursTravailles: z.number().min(0).max(31),
  navigoCout: positive,
  partEmployeurNavigo: ratio,
  mutuelleEconomie: positive,
  loyer: positive,
  courses: positive,
  transport: positive,
  autresCharges: positive,
  sorties: positive,
  divers: positive,
  voyageMois: positive,
  creditMensuel: positive,
  dateDebutCredit: z.string().regex(/^\d{2}\/\d{4}$/, "Format MM/YYYY attendu"),
  matelasCible: positive,
  perfEtfAnnuelle: ratio,
  augmentationSalaire: ratio,
  partEtfMonde: ratio,
  partOpportunites: ratio,
  economieRemoteMois: positive,
  moisRemoteAn: z.number().min(0).max(12),
  revenuFreelanceMois: positive,
  horizonYears: z.number().int().min(1).max(50),
  objectif: positive,
});

export type HypothesesInput = z.infer<typeof hypothesesSchema>;
// Legacy alias used by brownfield code.
export type Hypotheses = HypothesesInput;

export const defaultHypotheses: Hypotheses = {
  salaireNet: 3700,
  ticketRestoJour: 14,
  partEmployeurTr: 0.6,
  joursTravailles: 20,
  navigoCout: 90,
  partEmployeurNavigo: 0.5,
  mutuelleEconomie: 30,
  loyer: 1125,
  courses: 200,
  transport: 45,
  autresCharges: 150,
  sorties: 250,
  divers: 120,
  voyageMois: 600,
  creditMensuel: 250,
  dateDebutCredit: "01/2027",
  matelasCible: 10000,
  perfEtfAnnuelle: 0.07,
  augmentationSalaire: 0.03,
  partEtfMonde: 0.8,
  partOpportunites: 0.2,
  economieRemoteMois: 1000,
  moisRemoteAn: 6,
  revenuFreelanceMois: 300,
  horizonYears: 5,
  objectif: 100000,
};

// ── Story 7-3 (FR-57/FR-58) — projection hypothesis ──────────────────────
// Narrow projection-input write surface, separate from the 25-field brownfield
// budget `hypothesesSchema` above. The four fields map to columns on the same
// `hypotheses` row: objectif (capital cible), horizonYears (horizon),
// monthlyContribution (versement mensuel — new column, story 7-3 T1),
// perfEtfAnnuelle (taux annuel supposé).
export const recordProjectionSchema = z.object({
  objectif: positive,
  horizonYears: z.number().int().min(1).max(50),
  monthlyContribution: positive,
  perfEtfAnnuelle: ratio,
});
export type RecordProjectionInput = z.infer<typeof recordProjectionSchema>;

// Input to the getProjection read. currentWealthEur is supplied by the caller
// (the 7-1 dashboard overview total) — NOT clamped: net wealth can be negative
// (underwater real-estate, 7-1 lesson 2026-06-04), and the annuity formula is
// defined for negative P. Only finiteness is enforced (the derive guards it).
export const getProjectionInputSchema = z.object({
  currentWealthEur: z.number(),
});
export type GetProjectionInput = z.infer<typeof getProjectionInputSchema>;

// Iso with @pekulo/types#HypothesisProjection (kept in lock-step by hand).
export const hypothesisProjectionPointSchema = z.object({
  year: z.number().int().min(0),
  eur: z.number(),
});
export const hypothesisProjectionSchema = z.object({
  currentWealthEur: z.number(),
  monthlyContribution: positive,
  annualRate: ratio,
  horizonYears: z.number().int().min(1).max(50),
  points: z.array(hypothesisProjectionPointSchema),
  finalEur: z.number(),
});
export type HypothesisProjectionDto = z.infer<typeof hypothesisProjectionSchema>;

// ── Story 7-4 (FR-59) — projection-vs-compass gap ─────────────────────────
// Iso with @pekulo/types#HypothesisGap (kept in lock-step by hand). The read
// input is the SAME { currentWealthEur } shape as getProjection (the caller
// passes the 7-1 dashboard overview investable wealth) — reuse
// getProjectionInputSchema rather than declaring a second identical schema.
export const hypothesisGapSchema = z.object({
  gapEurPerMonth: positive,
  reachesCap: z.boolean(),
  projectedFinalEur: z.number(),
  requiredFinalEur: z.number(),
  deltaAtCapEur: z.number(),
  horizonYears: z.number().int().min(1).max(50),
  requiredPoints: z.array(hypothesisProjectionPointSchema),
});
export type HypothesisGapDto = z.infer<typeof hypothesisGapSchema>;
