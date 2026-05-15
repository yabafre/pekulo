import type { Milestone, MilestoneStatusEntry } from "@pekulo/validators";
import type { MilestoneCardItem } from "@pekulo/types";

// Pure derive: join (DB rows, computed statuses, currentWealth, compass) into
// the UI-ready `MilestoneCardItem` shape consumed by `<PekuloMilestoneRow>`.
// No I/O, no Math.random — fully unit-testable. Sorted ascending by
// targetYear (matches the API's list ordering).
//
// `progressPct` follows the ux-preview MilestoneRow spec (App.tsx:1005-1007):
// it visualises **linear plan progress** — "if you keep saving at the
// planned annual rate, what fraction of the milestone target will you have
// at targetYear?" — NOT the snapshot ratio `currentWealth/targetCapital`.
// The former is meaningful for a far-future palier (small snapshot ratio
// but high plan ratio if the milestone sits inside the horizon); the
// latter would render a near-empty donut for every distant milestone.
//
// `annualPlan = compassObjectif / compassHorizonYears` is the plan's linear
// rate (matches `WEALTH.required12mEur` in the mock). When compass info is
// missing (degraded state during the first paint), `annualPlan` is 0 and
// `progressPct` collapses to the snapshot ratio as a safe fallback.
export function deriveMilestoneCardItems(args: {
  milestones: Milestone[];
  statuses: MilestoneStatusEntry[];
  currentWealth: number;
  /** Compass objectif (EUR) — feeds the linear-plan denominator. Optional so
   *  the helper stays callable before the compass query lands. */
  compassObjectif?: number;
  /** Compass horizon in years — used to derive the annual plan rate. */
  compassHorizonYears?: number;
  /** Current absolute year (UTC). Caller supplies it so the helper stays
   *  pure / time-mockable in tests. Defaults to `new Date().getUTCFullYear()`. */
  currentYear?: number;
}): MilestoneCardItem[] {
  const statusById = new Map(args.statuses.map((s) => [s.id, s]));
  const currentYear = args.currentYear ?? new Date().getUTCFullYear();
  const annualPlan =
    args.compassObjectif != null && args.compassHorizonYears != null && args.compassHorizonYears > 0
      ? args.compassObjectif / args.compassHorizonYears
      : 0;
  return [...args.milestones]
    .sort((a, b) => a.targetYear - b.targetYear)
    .map((mil) => {
      const status = statusById.get(mil.id);
      let progressPct = 0;
      if (mil.targetCapital > 0) {
        if (annualPlan > 0) {
          const yearsFromNow = Math.max(0, mil.targetYear - currentYear);
          const linearPlanForYear = args.currentWealth + yearsFromNow * annualPlan;
          progressPct = Math.min(1, linearPlanForYear / mil.targetCapital);
        } else {
          // Fallback: snapshot ratio (the pre-1-4 behaviour) keeps the donut
          // alive during the brief window before compass query resolves.
          progressPct = Math.min(1, args.currentWealth / mil.targetCapital);
        }
      }
      return {
        id: mil.id,
        label: mil.label ?? `Palier ${mil.targetYear}`,
        targetEur: mil.targetCapital,
        targetYear: mil.targetYear,
        progressPct,
        deltaEur: status?.delta ?? 0,
        status: status?.status ?? "on-track",
      };
    });
}
