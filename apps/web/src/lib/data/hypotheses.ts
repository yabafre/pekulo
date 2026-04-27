import "server-only"
import { createClient } from "@/lib/supabase/server"
import { defaultHypotheses, type Hypotheses } from "@/lib/types"

export async function readHypotheses(): Promise<{
  hypotheses: Hypotheses
  source: "db" | "default" | "error"
  error?: string
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { hypotheses: defaultHypotheses, source: "default" }

    const { data, error } = await supabase
      .from("hypotheses")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      return {
        hypotheses: defaultHypotheses,
        source: "error",
        error: `${error.code ?? ""} ${error.message}`.trim(),
      }
    }
    if (!data) return { hypotheses: defaultHypotheses, source: "default" }

    return {
      hypotheses: {
        salaireNet: Number(data.salaire_net),
        ticketRestoJour: Number(data.ticket_resto_jour),
        partEmployeurTr: Number(data.part_employeur_tr),
        joursTravailles: Number(data.jours_travailles),
        navigoCout: Number(data.navigo_cout),
        partEmployeurNavigo: Number(data.part_employeur_navigo),
        mutuelleEconomie: Number(data.mutuelle_economie),
        loyer: Number(data.loyer),
        courses: Number(data.courses),
        transport: Number(data.transport),
        autresCharges: Number(data.autres_charges),
        sorties: Number(data.sorties),
        divers: Number(data.divers),
        voyageMois: Number(data.voyage_mois),
        creditMensuel: Number(data.credit_mensuel),
        dateDebutCredit: String(data.date_debut_credit ?? defaultHypotheses.dateDebutCredit),
        matelasCible: Number(data.matelas_cible),
        perfEtfAnnuelle: Number(data.perf_etf_annuelle),
        augmentationSalaire: Number(data.augmentation_salaire),
        partEtfMonde: Number(data.part_etf_monde),
        partOpportunites: Number(data.part_opportunites),
        economieRemoteMois: Number(data.economie_remote_mois),
        moisRemoteAn: Number(data.mois_remote_an),
        revenuFreelanceMois: Number(data.revenu_freelance_mois),
      },
      source: "db",
    }
  } catch (err) {
    return {
      hypotheses: defaultHypotheses,
      source: "error",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
