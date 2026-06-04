// apps/api/src/modules/dashboard/dashboard-layout.service.ts
// Per-user layout read/write (story 7-2 / D6). The service is the trust
// boundary: it re-parses the stored JSON through dashboardLayoutSchema on
// read (a hand-edited / pre-migration row that fails parse degrades to null,
// and the WEB falls back to defaults — AC-6) and validates the input on
// write. No business logic beyond persistence + validation.

import { dashboardLayoutSchema, type DashboardLayout } from "@pekulo/validators";
import type { DashboardLayoutRepository } from "./dashboard-layout.repository";

export interface DashboardLayoutService {
  getLayout(userId: string): Promise<DashboardLayout | null>;
  saveLayout(userId: string, layout: DashboardLayout): Promise<DashboardLayout>;
}

export function createDashboardLayoutService(deps: {
  repository: DashboardLayoutRepository;
}): DashboardLayoutService {
  return {
    async getLayout(userId) {
      const stored = await deps.repository.find(userId);
      if (!stored) return null;
      const parsed = dashboardLayoutSchema.safeParse(stored);
      // Corrupt/legacy row → behave as "no saved layout"; the web renders the
      // default registry layout (AC-6). Never throw on a bad column.
      return parsed.success ? parsed.data : null;
    },
    async saveLayout(userId, layout) {
      const valid = dashboardLayoutSchema.parse(layout);
      return deps.repository.upsert(userId, valid);
    },
  };
}
