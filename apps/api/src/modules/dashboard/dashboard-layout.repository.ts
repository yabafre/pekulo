// apps/api/src/modules/dashboard/dashboard-layout.repository.ts
// Prisma layer for per-user dashboard layout (story 7-2 / D6). Two methods:
//   - find(userId)            → stored layout or null
//   - upsert(userId, layout)  → write-through, returns the stored layout
// Every query carries an explicit where: { userId } (ADR-0013, defence in
// depth) — the lint rule pekulo/no-prisma-query-without-user-id enforces it.
// The column is opaque JSON on the wire; the SERVICE re-validates it through
// dashboardLayoutSchema before returning (never trust the column blind).

import type { ExtendedPrismaClient } from "../../database";
import type { DashboardLayout } from "@pekulo/validators";

export interface DashboardLayoutRepository {
  find(userId: string): Promise<DashboardLayout | null>;
  upsert(userId: string, layout: DashboardLayout): Promise<DashboardLayout>;
}

export function createDashboardLayoutRepository(deps: {
  client: ExtendedPrismaClient;
}): DashboardLayoutRepository {
  return {
    async find(userId) {
      const row = await deps.client.dashboardLayout.findUnique({
        where: { userId },
        select: { widgets: true },
      });
      if (!row) return null;
      // The service validates; here we only shape the column into the DTO.
      return { widgets: row.widgets as DashboardLayout["widgets"] };
    },

    async upsert(userId, layout) {
      const row = await deps.client.dashboardLayout.upsert({
        where: { userId },
        update: { widgets: layout.widgets, updatedAt: new Date() },
        create: { userId, widgets: layout.widgets } as unknown as Parameters<
          typeof deps.client.dashboardLayout.upsert
        >[0]["create"],
        select: { widgets: true },
      });
      return { widgets: row.widgets as DashboardLayout["widgets"] };
    },
  };
}
