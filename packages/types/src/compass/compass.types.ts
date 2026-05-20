// packages/types/src/compass/compass.types.ts
// Compass (story 1-1) types — runtime SSOT lives in @pekulo/validators
// (Zod inference). This module re-exports the canonical shapes + bounds
// and adds the injection contracts the compass module needs at
// construction time (CompassReader, WealthHistoryProvider) to keep the
// module instantiation acyclic against milestones / monthly-tracking.

export type { Compass, CompassSetupState } from "@pekulo/validators";

// Compass domain bounds — SSOT in @pekulo/validators. min(2) on horizon is
// load-bearing for milestones (story 1-2): horizonYears=1 would derive the
// empty year range [currentYear+1, currentYear].
export { MAX_OBJECTIF_EUR, MIN_HORIZON_YEARS, MAX_HORIZON_YEARS } from "@pekulo/validators";

// Append-only audit row written when the compass is updated (ADR-0001).
export interface CompassHistoryEntry {
  id: string;
  userId: string;
  objectif: number;
  horizonYears: number;
  valuedOn: Date;
  createdAt: Date;
}

// Read-only contract the milestones service needs from the compass aggregate
// (story 1-2 Q4=A). Implemented in runtime-dependencies.ts as a closure over
// Prisma (NOT compassService) to keep module instantiation acyclic.
export interface CompassReader {
  read(userId: string): Promise<{ objectif: number; horizonYears: number } | null>;
}

// Compass-progress curve types (story 1-3, FR-7). Re-exported from
// @pekulo/validators (Zod-inferred runtime SSOT) — kept in lockstep with the
// Compass / MilestoneStatus pattern above.
export type { CompassCurve, CompassCurvePoint, CompassProgress } from "@pekulo/validators";

// Wealth-history feed consumed by compass.getCompassCurve. V1 source is the
// brownfield `monthly_tracking` table via the runtime-dependencies adapter
// (closure over prismaService.client.monthlyTracking.findMany). Mirrors the
// CompassReader injection pattern (story 1-2): the compass module declares
// the interface, the runtime wires the Prisma-backed adapter — the module
// stays decoupled from MonthlyTracking and Epic 5's eventual port.
export interface WealthSnapshot {
  at: Date;
  totalEur: number;
}

export interface WealthHistoryProvider {
  read(userId: string): Promise<WealthSnapshot[]>;
}
