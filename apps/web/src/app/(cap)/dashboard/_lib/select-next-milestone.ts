// apps/web/src/app/(cap)/dashboard/_lib/select-next-milestone.ts
// FR-41 third element: "next upcoming milestone with delta". Given the
// milestone statuses (getMilestoneStatuses → MilestoneStatusEntry[], where
// delta > 0 means BEHIND = amount still to reach, delta <= 0 means
// ahead/on-track), pick the next NOT-yet-reached milestone — the smallest
// positive delta (nearest target still ahead of the user). Returns null when
// every milestone is reached or the list is empty (UI hides the line).
import type { MilestoneStatusEntry } from "@pekulo/validators";

export interface NextMilestone {
  id: string;
  deltaEur: number; // positive € still needed to reach this milestone
}

export function selectNextMilestone(
  statuses: MilestoneStatusEntry[] | undefined,
): NextMilestone | null {
  if (!statuses || statuses.length === 0) return null;
  const upcoming = statuses.filter((s) => s.delta > 0).sort((a, b) => a.delta - b.delta);
  const next = upcoming[0];
  return next ? { id: next.id, deltaEur: next.delta } : null;
}
