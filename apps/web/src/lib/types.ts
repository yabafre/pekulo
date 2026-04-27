export interface KpiData {
  netReel: number
  pouvoirAchat: number
  epargneMois: number
  capitalProjete: number
  objectif: number
  progression: number
}

export interface MonthlyRecord {
  month: string
  year: number
  monthNum: number
  net: number
  avantages: number
  depenses: number
  credit: number
  remote: number
  freelance: number
  epargneMois: number
  perfMarche: number
  epargneCumul: number
  capitalTotal: number
}

export interface AnnualSummary {
  periode: string
  epargneAnnuelle: number
  perfMarche: number
  capitalFin: number
}

export interface ScenarioItem {
  name: string
  capitalFin: number
  epargne: number
  perf: number
  taux: number
  moisEpargne1: number
  moisEpargne2: number
}

export interface BudgetItem {
  categorie: string
  montant: number
  sousItems?: { label: string; montant: number }[]
}

export interface RevenueItem {
  label: string
  montant: number
}

export interface Hypotheses {
  salaireNet: number
  ticketRestoJour: number
  partEmployeurTr: number
  joursTravailles: number
  navigoCout: number
  partEmployeurNavigo: number
  mutuelleEconomie: number
  loyer: number
  courses: number
  transport: number
  autresCharges: number
  sorties: number
  divers: number
  voyageMois: number
  creditMensuel: number
  dateDebutCredit: string
  matelasCible: number
  perfEtfAnnuelle: number
  augmentationSalaire: number
  partEtfMonde: number
  partOpportunites: number
  economieRemoteMois: number
  moisRemoteAn: number
  revenuFreelanceMois: number
  horizonYears: number
  objectif: number
}

export interface MonthlyEntry {
  monthNum: number
  year: number
  monthLabel: string
  net: number
  avantages: number
  depenses: number
  credit: number
  remote: number
  freelance: number
  epargneMois: number
}

export type MonthlyMerged = MonthlyEntry & {
  source: "actual" | "projected"
  projected: MonthlyEntry
  ecart: number
}

export type TransactionType = "inflow" | "outflow"
export type TransactionCategory =
  | "salaire"
  | "freelance"
  | "remote"
  | "bonus"
  | "loyer"
  | "courses"
  | "transport"
  | "sorties"
  | "voyage"
  | "sante"
  | "imprevu"
  | "autre"

export interface Transaction {
  id: string
  occurredOn: string // YYYY-MM-DD
  label: string
  amount: number
  type: TransactionType
  category: TransactionCategory
  isImprevu: boolean
  notes: string | null
  createdAt: string
}

export type Currency = "EUR" | "USD" | "GBP" | "CHF"
export type AccountType = "livret" | "pea" | "cto" | "av" | "autre"
export type HoldingKind = "etf" | "action" | "autre"

export interface Account {
  id: string
  label: string
  type: AccountType
  currency: Currency
  cashBalance: number
  notes: string | null
  createdAt: string
}

export interface Holding {
  id: string
  accountId: string
  kind: HoldingKind
  ticker: string | null
  isin: string | null
  label: string
  currency: Currency
  quantity: number
  avgCost: number
  lastPrice: number
  lastPriceAt: string | null
  notes: string | null
  createdAt: string
}

export interface PortfolioSnapshot {
  accounts: Account[]
  holdings: Holding[]
  kpi: {
    capitalTotal: number
    cash: number
    invested: number
    marketValue: number
    pnl: number
  }
  byAccount: Array<{ accountId: string; label: string; total: number }>
}

export interface RefreshFailure {
  id: string
  label: string
  reason: string
}

export interface RefreshSummary {
  updated: number
  failed: RefreshFailure[]
}

export type LotType = "buy" | "sell"

export interface HoldingLot {
  id: string
  holdingId: string
  type: LotType
  occurredOn: string // YYYY-MM-DD
  quantity: number
  priceUnit: number
  fees: number
  notes: string | null
  createdAt: string
}

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
}
