// packages/validators/src/dashboard/dashboard.schemas.ts
// Dashboard overview aggregate (story 7-1 / FR-43). The dashboard owns no
// tables — this schema describes the cross-domain OVERVIEW the
// dashboard.service composes from accounts + holdings + realestate + compass.
// `fx.source` mirrors PortfolioSnapshotFx.fxSource (NFR-19 transparency).

import { z } from "@pekulo/zod";
import { fxSourceSchema } from "../holdings";

export const dashboardCompositionSchema = z.object({
  liquideEur: z.number(),
  placementsEur: z.number(),
  immobilierEur: z.number(),
});
export type DashboardComposition = z.infer<typeof dashboardCompositionSchema>;

// Non-null only when the user has a compass row. percent/gap come from the
// pure computeProgress() over the LIVE total wealth; objectif echoes the
// compass target so the page renders without a second compass read.
export const dashboardCompassSchema = z.object({
  percent: z.number(),
  objectif: z.number(),
  gap: z.number(),
});
export type DashboardCompass = z.infer<typeof dashboardCompassSchema>;

export const dashboardOverviewSchema = z.object({
  totalWealthEur: z.number(),
  composition: dashboardCompositionSchema,
  compass: dashboardCompassSchema.nullable(),
  fx: z.object({
    source: fxSourceSchema,
    asOf: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "asOf must be YYYY-MM-DD")
      .nullable(),
  }),
});
export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;
