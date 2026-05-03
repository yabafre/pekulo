import type { Hypotheses, MonthlyEntry } from "./types";
import { deriveAvantages, deriveDepensesTotales } from "./derive";
import { formatMonthLabel } from "./schemas/monthly";

const BASE_YEAR = 2026;

export function projectMonth(h: Hypotheses, year: number, monthNum: number): MonthlyEntry {
  const yearsSince = Math.max(0, year - BASE_YEAR);
  const net = round(h.salaireNet * (1 + h.augmentationSalaire) ** yearsSince);
  const avantages = deriveAvantages(h);
  const depenses = deriveDepensesTotales(h);
  const remote = monthNum <= h.moisRemoteAn ? h.economieRemoteMois : 0;
  const freelance = h.revenuFreelanceMois;
  const credit = isCreditOn(h.dateDebutCredit, year, monthNum) ? h.creditMensuel : 0;
  const epargneMois = round(net + remote + freelance - depenses - credit);
  return {
    year,
    monthNum,
    monthLabel: formatMonthLabel(year, monthNum),
    net,
    avantages: round(avantages),
    depenses: round(depenses),
    credit: round(credit),
    remote: round(remote),
    freelance: round(freelance),
    epargneMois,
  };
}

function isCreditOn(dateDebutCredit: string, year: number, monthNum: number): boolean {
  const match = /^(\d{1,2})\/(\d{4})$/.exec(dateDebutCredit);
  if (!match) return false;
  const startMonth = Number(match[1]);
  const startYear = Number(match[2]);
  if (year > startYear) return true;
  if (year < startYear) return false;
  return monthNum >= startMonth;
}

function round(n: number): number {
  return Math.round(n);
}
