// Public type surface for the milestones module. Wired via the module factory.
//
// CompassReader is the small read-only contract the milestones service needs
// from the compass aggregate (Q4=A, story 1-2). The adapter is injected at
// module construction by runtime-dependencies.ts as a closure over Prisma —
// NOT over the compass service — to avoid a circular dependency at module
// instantiation (compass module needs MilestonePresenceProbe; if milestones
// also depended on compass.service, both modules would block on each other).
//
// MilestonePresenceProbe is re-exported from the compass module to keep the
// shape single-source. The milestones module produces an instance of it
// (presenceProbe member of the module factory output).

import type { Milestone, MilestoneStatus, MilestoneStatusEntry } from "@pekulo/validators";
import type { MilestonePresenceProbe } from "../compass/compass.types";

export type { Milestone, MilestoneStatus, MilestoneStatusEntry, MilestonePresenceProbe };

export interface CompassReader {
  /** Read the user's compass shape (objectif + horizonYears) or null. */
  read(userId: string): Promise<{ objectif: number; horizonYears: number } | null>;
}
