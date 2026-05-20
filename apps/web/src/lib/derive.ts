import type { Hypotheses } from "@pekulo/validators";
import type {
  AnnualSummary,
  BudgetItem,
  KpiData,
  MonthlyRecord,
  RevenueItem,
  ScenarioItem,
} from "./types";

export interface ProjectionOpts {
  startDate?: Date;
  endDate?: Date;
  horizonYears?: number;
}

const MONTH_NAMES_FR = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
] as const;

function formatMonthFr(year: number, monthNum: number): string {
  return `${MONTH_NAMES_FR[monthNum - 1]} ${year}`;
}

function parseCreditStart(s: string): { month: number; year: number } | null {
  const m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return { month: parseInt(m[1], 10), year: parseInt(m[2], 10) };
}

function resolveRange(h: Hypotheses, opts: ProjectionOpts) {
  const horizon = opts.horizonYears ?? h.horizonYears;
  const today = new Date();
  const start = opts.startDate ?? new Date(today.getFullYear(), today.getMonth(), 1);
  const end = opts.endDate ?? new Date(start.getFullYear() + horizon, start.getMonth(), 1);
  return {
    startYear: start.getFullYear(),
    startMonth: start.getMonth() + 1,
    endYear: end.getFullYear(),
    endMonth: end.getMonth() + 1,
  };
}

// Re-exported (was made file-local in PR #86 D3 part 2 — restored here
// because `apps/web/src/lib/derive-monthly.ts` was restored in the same PR
// after the audit's premature deletion, and projectMonth() consumes both
// helpers).
export function deriveAvantages(h: Hypotheses): number {
  const ticketResto = h.ticketRestoJour * h.partEmployeurTr * h.joursTravailles;
  const navigo = h.navigoCout * h.partEmployeurNavigo;
  return round(ticketResto + navigo + h.mutuelleEconomie);
}

export function deriveDepensesTotales(h: Hypotheses): number {
  const chargesFixes = h.loyer + h.courses + h.transport + h.autresCharges;
  const lifestyle = h.sorties + h.divers;
  return round(chargesFixes + lifestyle + h.voyageMois);
}

export function deriveMonthly(h: Hypotheses, opts: ProjectionOpts = {}): MonthlyRecord[] {
  const range = resolveRange(h, opts);
  const credit = parseCreditStart(h.dateDebutCredit);
  const avantages = deriveAvantages(h);
  const depensesBase = deriveDepensesTotales(h);
  const monthlyRate = h.perfEtfAnnuelle / 12;

  const rows: MonthlyRecord[] = [];
  let capitalTotal = 0;
  let epargneCumul = 0;
  let y = range.startYear;
  let m = range.startMonth;

  while (y < range.endYear || (y === range.endYear && m < range.endMonth)) {
    const yearsSinceStart = y - range.startYear;
    const net = h.salaireNet * Math.pow(1 + h.augmentationSalaire, yearsSinceStart);
    const remote = m <= h.moisRemoteAn ? h.economieRemoteMois : 0;
    const freelance = h.revenuFreelanceMois;
    const creditPaid =
      credit && (y > credit.year || (y === credit.year && m >= credit.month)) ? h.creditMensuel : 0;
    const epargneMois = net - depensesBase + remote + freelance - creditPaid;
    const perfMarche = capitalTotal * monthlyRate;
    capitalTotal += epargneMois + perfMarche;
    epargneCumul += epargneMois;

    rows.push({
      month: formatMonthFr(y, m),
      year: y,
      monthNum: m,
      net: round(net),
      avantages,
      depenses: round(depensesBase),
      credit: round(creditPaid),
      remote: round(remote),
      freelance: round(freelance),
      epargneMois: round(epargneMois),
      perfMarche: round(perfMarche, 1),
      epargneCumul: round(epargneCumul),
      capitalTotal: round(capitalTotal),
    });

    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return rows;
}

export function deriveAnnualSummaries(h: Hypotheses, opts: ProjectionOpts = {}): AnnualSummary[] {
  const monthly = deriveMonthly(h, opts);
  const summaries: AnnualSummary[] = [];
  for (let i = 0; i < monthly.length; i += 12) {
    const window = monthly.slice(i, i + 12);
    if (window.length === 0) break;
    const first = window[0];
    const last = window[window.length - 1];
    const epargneAnnuelle = window.reduce((s, x) => s + x.epargneMois, 0);
    const perfMarche = window.reduce((s, x) => s + x.perfMarche, 0);
    summaries.push({
      periode: `${first.month} → ${last.month}`,
      epargneAnnuelle: round(epargneAnnuelle),
      perfMarche: round(perfMarche),
      capitalFin: round(last.capitalTotal),
    });
  }
  return summaries;
}

interface ScenarioVariant {
  name: string;
  perfEtfAnnuelle: number;
  moisEpargne1: number;
  moisEpargne2: number;
}

export function deriveScenarios(h: Hypotheses, opts: ProjectionOpts = {}): ScenarioItem[] {
  const horizonYears = opts.horizonYears ?? h.horizonYears;
  const totalMonths = horizonYears * 12;
  const phase1Months = Math.min(12, totalMonths);
  const phase2Months = Math.max(0, totalMonths - phase1Months);

  const variants: ScenarioVariant[] = [
    { name: "Conservateur", perfEtfAnnuelle: 0.05, moisEpargne1: 700, moisEpargne2: 600 },
    { name: "Réaliste", perfEtfAnnuelle: h.perfEtfAnnuelle, moisEpargne1: 1000, moisEpargne2: 800 },
    {
      name: "Agressif (Remote)",
      perfEtfAnnuelle: h.perfEtfAnnuelle,
      moisEpargne1: 1500,
      moisEpargne2: 1200,
    },
  ];

  return variants.map((v) => {
    const monthlyRate = v.perfEtfAnnuelle / 12;
    let capital = 0;
    let epargneCum = 0;
    for (let i = 0; i < phase1Months; i++) {
      capital += v.moisEpargne1 + capital * monthlyRate;
      epargneCum += v.moisEpargne1;
    }
    for (let i = 0; i < phase2Months; i++) {
      capital += v.moisEpargne2 + capital * monthlyRate;
      epargneCum += v.moisEpargne2;
    }
    return {
      name: v.name,
      capitalFin: round(capital),
      epargne: round(epargneCum),
      perf: round(capital - epargneCum),
      taux: round(v.perfEtfAnnuelle * 100, 1),
      moisEpargne1: v.moisEpargne1,
      moisEpargne2: v.moisEpargne2,
    };
  });
}

export function deriveKpis(h: Hypotheses, opts: ProjectionOpts = {}): KpiData {
  const objectif = h.objectif;
  const monthly = deriveMonthly(h, opts);
  const capitalProjete = monthly.length > 0 ? monthly[monthly.length - 1].capitalTotal : 0;
  const avantages = deriveAvantages(h);
  const pouvoirAchat = h.salaireNet + avantages;
  const depenses = deriveDepensesTotales(h);
  const epargneMois = h.salaireNet - depenses;
  return {
    netReel: round(h.salaireNet),
    pouvoirAchat: round(pouvoirAchat),
    epargneMois: round(epargneMois),
    capitalProjete: round(capitalProjete),
    objectif,
    progression: round((capitalProjete / objectif) * 100, 1),
  };
}

export function deriveBudget(h: Hypotheses): BudgetItem[] {
  const chargesFixes = h.loyer + h.courses + h.transport + h.autresCharges;
  const lifestyle = h.sorties + h.divers;
  const epargneMois = h.salaireNet - deriveDepensesTotales(h);
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
  ];
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
  ];
}

function round(n: number, digits = 0): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}
