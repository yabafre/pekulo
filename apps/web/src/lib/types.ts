export interface KpiData {
  netReel: number;
  pouvoirAchat: number;
  epargneMois: number;
  capitalProjete: number;
  objectif: number;
  progression: number;
}

export interface MonthlyRecord {
  month: string;
  year: number;
  monthNum: number;
  net: number;
  avantages: number;
  depenses: number;
  credit: number;
  remote: number;
  freelance: number;
  epargneMois: number;
  perfMarche: number;
  epargneCumul: number;
  capitalTotal: number;
}

export interface AnnualSummary {
  periode: string;
  epargneAnnuelle: number;
  perfMarche: number;
  capitalFin: number;
}

export interface ScenarioItem {
  name: string;
  capitalFin: number;
  epargne: number;
  perf: number;
  taux: number;
  moisEpargne1: number;
  moisEpargne2: number;
}

export interface BudgetItem {
  categorie: string;
  montant: number;
  sousItems?: { label: string; montant: number }[];
}

export interface RevenueItem {
  label: string;
  montant: number;
}

// Hypotheses + defaultHypotheses moved to @pekulo/validators in story 0-6.
// Re-exported here so brownfield import paths keep working.
export { defaultHypotheses, type Hypotheses } from "@pekulo/validators";

export interface MonthlyEntry {
  monthNum: number;
  year: number;
  monthLabel: string;
  net: number;
  avantages: number;
  depenses: number;
  credit: number;
  remote: number;
  freelance: number;
  epargneMois: number;
}

export type MonthlyMerged = MonthlyEntry & {
  source: "actual" | "projected";
  projected: MonthlyEntry;
  ecart: number;
};

export type TransactionType = "inflow" | "outflow";
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
  | "autre";

export interface Transaction {
  id: string;
  occurredOn: string; // YYYY-MM-DD
  label: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  isImprevu: boolean;
  notes: string | null;
  createdAt: string;
}

export type Currency = "EUR" | "USD" | "GBP" | "CHF";
export type AccountType = "livret" | "pea" | "cto" | "av" | "autre";

export interface Account {
  id: string;
  label: string;
  type: AccountType;
  currency: Currency;
  cashBalance: number;
  notes: string | null;
  createdAt: string;
}
