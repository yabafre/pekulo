import { z } from "zod"

const ratio = z.number().min(0).max(1)
const positive = z.number().min(0)

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
})

export type HypothesesInput = z.infer<typeof hypothesesSchema>
