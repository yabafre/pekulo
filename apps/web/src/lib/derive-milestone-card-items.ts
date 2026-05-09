import type { Milestone, MilestoneStatusEntry } from "@pekulo/validators";
import type { MilestoneCardItem } from "@pekulo/types";

// Pure derive: join (DB rows, computed statuses, currentWealth) into the
// UI-ready `MilestoneCardItem` shape consumed by `<PekuloMilestoneRow>`.
// No I/O, no Date, no Math.random — fully unit-testable. Sorted ascending
// by targetYear (matches the API's list ordering).
export function deriveMilestoneCardItems(args: {
  milestones: Milestone[];
  statuses: MilestoneStatusEntry[];
  currentWealth: number;
}): MilestoneCardItem[] {
  const statusById = new Map(args.statuses.map((s) => [s.id, s]));
  return [...args.milestones]
    .sort((a, b) => a.targetYear - b.targetYear)
    .map((mil) => {
      const status = statusById.get(mil.id);
      const progressPct =
        mil.targetCapital > 0 ? Math.min(1, args.currentWealth / mil.targetCapital) : 0;
      return {
        label: mil.label ?? `Palier ${mil.targetYear}`,
        targetEur: mil.targetCapital,
        targetYear: mil.targetYear,
        progressPct,
        deltaEur: status?.delta ?? 0,
        status: status?.status ?? "on-track",
      };
    });
}
