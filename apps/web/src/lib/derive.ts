import type {
  BudgetItem,
  Hypotheses,
  KpiData,
  RevenueItem,
} from "./types"

export function deriveAvantages(h: Hypotheses): number {
  const ticketResto = h.ticketRestoJour * h.partEmployeurTr * h.joursTravailles
  const navigo = h.navigoCout * h.partEmployeurNavigo
  return round(ticketResto + navigo + h.mutuelleEconomie)
}

export function deriveDepensesTotales(h: Hypotheses): number {
  const chargesFixes = h.loyer + h.courses + h.transport + h.autresCharges
  const lifestyle = h.sorties + h.divers
  return round(chargesFixes + lifestyle + h.voyageMois)
}

export function deriveKpis(
  h: Hypotheses,
  capitalProjete = 145738,
  objectif = 100000
): KpiData {
  const avantages = deriveAvantages(h)
  const pouvoirAchat = h.salaireNet + avantages
  const depenses = deriveDepensesTotales(h)
  const epargneMois = h.salaireNet - depenses
  return {
    netReel: round(h.salaireNet),
    pouvoirAchat: round(pouvoirAchat),
    epargneMois: round(epargneMois),
    capitalProjete,
    objectif,
    progression: round((capitalProjete / objectif) * 100, 1),
  }
}

export function deriveBudget(h: Hypotheses): BudgetItem[] {
  const chargesFixes = h.loyer + h.courses + h.transport + h.autresCharges
  const lifestyle = h.sorties + h.divers
  const epargneMois = h.salaireNet - deriveDepensesTotales(h)
  return [
    {
      categorie: "Charges fixes",
      montant: round(chargesFixes),
      sousItems: [
        { label: "Loyer", montant: round(h.loyer) },
        { label: "Courses", montant: round(h.courses) },
        { label: "Transport", montant: round(h.transport) },
        { label: "Autres charges", montant: round(h.autresCharges) },
      ],
    },
    {
      categorie: "Lifestyle",
      montant: round(lifestyle),
      sousItems: [
        { label: "Sorties", montant: round(h.sorties) },
        { label: "Divers", montant: round(h.divers) },
      ],
    },
    { categorie: "Voyage", montant: round(h.voyageMois) },
    { categorie: "Épargne (Phase 1)", montant: round(epargneMois) },
  ]
}

export function deriveRevenue(h: Hypotheses): RevenueItem[] {
  return [
    { label: "Salaire net", montant: round(h.salaireNet) },
    {
      label: "Tickets resto",
      montant: round(h.ticketRestoJour * h.partEmployeurTr * h.joursTravailles),
    },
    {
      label: "Pass Navigo",
      montant: round(h.navigoCout * h.partEmployeurNavigo),
    },
    { label: "Mutuelle", montant: round(h.mutuelleEconomie) },
  ]
}

function round(n: number, digits = 0): number {
  const f = Math.pow(10, digits)
  return Math.round(n * f) / f
}
