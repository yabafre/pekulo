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
