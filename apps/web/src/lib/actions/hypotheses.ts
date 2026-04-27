"use server"

import { defineAction } from "@zapaction/core"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { defaultHypotheses, type Hypotheses } from "@/lib/types"
import { hypothesesSchema } from "@/lib/schemas/hypotheses"
import { hypothesesTags } from "@/lib/zapaction/keys"
import type { ActionContext } from "@/lib/zapaction/context"
import "@/lib/zapaction/context"

const dbToCamel = (row: Record<string, unknown>): Hypotheses => ({
  salaireNet: Number(row.salaire_net ?? defaultHypotheses.salaireNet),
  ticketRestoJour: Number(row.ticket_resto_jour ?? defaultHypotheses.ticketRestoJour),
  partEmployeurTr: Number(row.part_employeur_tr ?? defaultHypotheses.partEmployeurTr),
  joursTravailles: Number(row.jours_travailles ?? defaultHypotheses.joursTravailles),
  navigoCout: Number(row.navigo_cout ?? defaultHypotheses.navigoCout),
  partEmployeurNavigo: Number(row.part_employeur_navigo ?? defaultHypotheses.partEmployeurNavigo),
  mutuelleEconomie: Number(row.mutuelle_economie ?? defaultHypotheses.mutuelleEconomie),
  loyer: Number(row.loyer ?? defaultHypotheses.loyer),
  courses: Number(row.courses ?? defaultHypotheses.courses),
  transport: Number(row.transport ?? defaultHypotheses.transport),
  autresCharges: Number(row.autres_charges ?? defaultHypotheses.autresCharges),
  sorties: Number(row.sorties ?? defaultHypotheses.sorties),
  divers: Number(row.divers ?? defaultHypotheses.divers),
  voyageMois: Number(row.voyage_mois ?? defaultHypotheses.voyageMois),
  creditMensuel: Number(row.credit_mensuel ?? defaultHypotheses.creditMensuel),
  dateDebutCredit: String(row.date_debut_credit ?? defaultHypotheses.dateDebutCredit),
  matelasCible: Number(row.matelas_cible ?? defaultHypotheses.matelasCible),
  perfEtfAnnuelle: Number(row.perf_etf_annuelle ?? defaultHypotheses.perfEtfAnnuelle),
  augmentationSalaire: Number(row.augmentation_salaire ?? defaultHypotheses.augmentationSalaire),
  partEtfMonde: Number(row.part_etf_monde ?? defaultHypotheses.partEtfMonde),
  partOpportunites: Number(row.part_opportunites ?? defaultHypotheses.partOpportunites),
  economieRemoteMois: Number(row.economie_remote_mois ?? defaultHypotheses.economieRemoteMois),
  moisRemoteAn: Number(row.mois_remote_an ?? defaultHypotheses.moisRemoteAn),
  revenuFreelanceMois: Number(row.revenu_freelance_mois ?? defaultHypotheses.revenuFreelanceMois),
})

const camelToDb = (h: Hypotheses, userId: string) => ({
  user_id: userId,
  salaire_net: h.salaireNet,
  ticket_resto_jour: h.ticketRestoJour,
  part_employeur_tr: h.partEmployeurTr,
  jours_travailles: h.joursTravailles,
  navigo_cout: h.navigoCout,
  part_employeur_navigo: h.partEmployeurNavigo,
  mutuelle_economie: h.mutuelleEconomie,
  loyer: h.loyer,
  courses: h.courses,
  transport: h.transport,
  autres_charges: h.autresCharges,
  sorties: h.sorties,
  divers: h.divers,
  voyage_mois: h.voyageMois,
  credit_mensuel: h.creditMensuel,
  date_debut_credit: h.dateDebutCredit,
  matelas_cible: h.matelasCible,
  perf_etf_annuelle: h.perfEtfAnnuelle,
  augmentation_salaire: h.augmentationSalaire,
  part_etf_monde: h.partEtfMonde,
  part_opportunites: h.partOpportunites,
  economie_remote_mois: h.economieRemoteMois,
  mois_remote_an: h.moisRemoteAn,
  revenu_freelance_mois: h.revenuFreelanceMois,
  updated_at: new Date().toISOString(),
})

export const getHypotheses = defineAction<void, Hypotheses, ActionContext>({
  name: "getHypotheses",
  input: z.void(),
  handler: async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("hypotheses")
      .select("*")
      .eq("user_id", ctx.userId)
      .maybeSingle()
    if (error && error.code !== "PGRST116") throw error
    if (!data) return defaultHypotheses
    return dbToCamel(data)
  },
})

export const saveHypotheses = defineAction<Hypotheses, Hypotheses, ActionContext>({
  name: "saveHypotheses",
  input: hypothesesSchema,
  output: hypothesesSchema,
  tags: [hypothesesTags.current()],
  handler: async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase
      .from("hypotheses")
      .upsert(camelToDb(input, ctx.userId), { onConflict: "user_id" })
      .select("*")
      .single()
    if (error) throw error
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/parametres")
    return dbToCamel(data)
  },
})
