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
