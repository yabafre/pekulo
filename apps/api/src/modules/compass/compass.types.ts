// Public type surface for the compass module. Wired via the module factory.

import type { Compass, CompassSetupState } from "@pekulo/validators";

export type { Compass, CompassSetupState };

// Probe used by getSetupState to decide whether at least one milestone exists
// for the given user. Story 1-1 ships a stub that always returns false (no
// milestone domain yet — FR-8). Story 1-2 swaps it for a real Prisma-backed
// probe wired via runtime-dependencies.ts.
export interface MilestonePresenceProbe {
  hasAny(userId: string): Promise<boolean>;
}

export interface CompassHistoryEntry {
  id: string;
  userId: string;
  objectif: number;
  horizonYears: number;
  valuedOn: Date;
  createdAt: Date;
}
