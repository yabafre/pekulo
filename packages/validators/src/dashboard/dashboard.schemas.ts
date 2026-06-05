// packages/validators/src/dashboard/dashboard.schemas.ts
// Dashboard overview aggregate (story 7-1 / FR-43). The dashboard owns no
// tables — this schema describes the cross-domain OVERVIEW the
// dashboard.service composes from accounts + holdings + realestate + compass.
// `fx.source` mirrors PortfolioSnapshotFx.fxSource (NFR-19 transparency).

import { z } from "@pekulo/zod";
import { fxSourceSchema } from "../holdings";
import { transactionCategorySchema } from "../transactions";

// Display direction mirrors @pekulo/types TxDirection ("in" | "out"). The raw
// transaction type ("inflow" | "outflow") is mapped to this at the server
// boundary; defined locally because validators has no shared direction schema.
const activityDirectionSchema = z.enum(["in", "out"]);

// One recent-activity row (story 7-2 / D3). The server resolves account LABEL
// + direction + EUR amount; `category` stays the raw enum so the web maps it
// to its French label + icon (TRANSACTION_CATEGORY_LABELS + CategoryIcon) —
// keeps API copy-free. logoUrl is the opaque Pekulo proxy URL (6-10) or null.
export const dashboardActivitySchema = z.object({
  label: z.string(),
  account: z.string(),
  category: transactionCategorySchema,
  direction: activityDirectionSchema,
  amountEur: z.number(),
  logoUrl: z.string().nullable().optional(),
});
export type DashboardActivity = z.infer<typeof dashboardActivitySchema>;

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
  recentActivity: z.array(dashboardActivitySchema),
});
export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;

// ─── Configurable widget layout (story 7-2 / D6) ─────────────────────────
// The canonical widget id set. Adding a widget later = add an id here + a
// registry entry on the web; the merge logic (use-dashboard-layout) backfills
// it into existing stored layouts at the default order.
export const DASHBOARD_WIDGET_IDS = [
  "hero",
  "compass",
  "nextMilestone",
  "trajectory",
  "milestones",
  "hypothesis",
  "composition",
  "recentActivity",
] as const;
export const dashboardWidgetIdSchema = z.enum(DASHBOARD_WIDGET_IDS);
export type DashboardWidgetId = z.infer<typeof dashboardWidgetIdSchema>;

export const dashboardWidgetSchema = z.object({
  id: dashboardWidgetIdSchema,
  visible: z.boolean(),
  order: z.number().int().min(0),
  // Story 7-2 extension — user-resized span on the desktop bento grid (drag
  // handles). Optional + bounded: absent → the registry default span. colSpan
  // is the 12-col width; rowSpan is the row-track height. Mobile (flat column)
  // ignores both.
  colSpan: z.number().int().min(1).max(12).optional(),
  rowSpan: z.number().int().min(1).max(4).optional(),
});
export type DashboardWidget = z.infer<typeof dashboardWidgetSchema>;

// Stored/transported layout. The array MAY be partial or stale — the web
// merge layer reconciles it against the registry defaults (AC-6). The server
// stores exactly what it is given after this validation passes.
export const dashboardLayoutSchema = z.object({
  widgets: z.array(dashboardWidgetSchema),
});
export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>;

export const saveDashboardLayoutInputSchema = dashboardLayoutSchema;
export type SaveDashboardLayoutInput = z.infer<typeof saveDashboardLayoutInputSchema>;
