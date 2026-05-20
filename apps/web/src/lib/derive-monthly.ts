// apps/web/src/lib/derive-monthly.ts
// Single-month projection helper — `projectMonth(h, year, monthNum)` returns
// one MonthlyEntry from the hypotheses. Used by the dashboard's "projected vs
// actual" merge once Epic 5 ports monthly tracking to oRPC and the merge
// step needs to fill gaps between actual-row entries and the projection
// curve.
//
// Removed in PR #86 audit then restored — forward-pointer logic that depends
// on schemas / types relocated during the same pass:
//   - `Hypotheses` now lives in @pekulo/validators (story 0-6)
//   - `MonthlyEntry` now lives in @pekulo/types (re-relocated in PR #86)
//   - `formatMonthLabel` now lives in @pekulo/validators (re-relocated in
//     PR #86 — was apps/web/src/lib/schemas/monthly.ts before)

import type { Hypotheses } from "@pekulo/validators";
import { formatMonthLabel } from "@pekulo/validators";
import type { MonthlyEntry } from "@pekulo/types";
import { deriveAvantages, deriveDepensesTotales } from "./derive";

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
