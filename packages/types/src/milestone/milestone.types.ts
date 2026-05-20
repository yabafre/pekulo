// packages/types/src/milestone/milestone.types.ts
// Milestone types — legacy UI mockup `MilestoneCardItem` + DB-row entity +
// computed status (story 1-2) + injection probe consumed by the compass
// module (story 1-2 Q4=A — keeps compass↔milestones instantiation acyclic).

export const MILESTONE_STATUSES = ["ahead", "on-track", "behind"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export interface MilestoneCardItem {
  /**
   * Domain id of the underlying Milestone row when the item is wired to
   * live data. Optional so legacy DS mockups (which carry only the visual
   * payload) keep typechecking; consumers wired to the milestones domain
   * (story 1-4) populate it via the derive helper so PekuloMilestoneRow
   * can offer per-row affordances (delete / edit).
   */
  id?: string;
  label: string;
  targetEur: number;
  targetYear: number;
  progressPct: number;
  deltaEur: number;
  status: MilestoneStatus;
}

// Re-exported from @pekulo/validators — validators is the runtime SSOT,
// types is the typed import surface.
export type { Milestone, MilestoneStatusEntry } from "@pekulo/validators";

// Milestones domain bounds — SSOT in @pekulo/validators. `MILESTONES_PER_USER_CAP`
// gates the FR-3 cap (≤ 20 rows / user); `MAX_TARGET_CAPITAL_EUR` /
// `MAX_LABEL_LENGTH` bound the row payload. `MILESTONE_STATUS_TOLERANCE_RATIO`
// is the FR-6 ±5% band used by both the API helper (status classification)
// and apps/web (tooltip copy).
export {
  MAX_TARGET_CAPITAL_EUR,
  MAX_LABEL_LENGTH,
  MILESTONES_PER_USER_CAP,
  MILESTONE_STATUS_TOLERANCE_RATIO,
} from "@pekulo/validators";

// Probe consumed by the compass module's getSetupState handler — story 1-2
// wires the Prisma-backed implementation; the compass module receives it
// at construction time so it does not import from milestones directly.
export interface MilestonePresenceProbe {
  hasAny(userId: string): Promise<boolean>;
}
