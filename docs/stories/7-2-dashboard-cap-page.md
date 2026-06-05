# Story: 7-2-dashboard-cap-page — Cap page layout + configurable dashboard widgets (XL)

**Epic:** Epic 7 — Dashboard & projection
**Status:** review
**Ticket:** [#39](https://github.com/yabafre/pekulo/issues/39)
**Branch:** feature/39-7-2-dashboard-cap-page
**Complexity:** XL (deliberately expanded from the L epic scope — see Scope Expansion banner)
**Covered FRs:** FR-41, FR-42 · **Binds:** NFR-3 (Lighthouse ≥90), NFR-4 (TTFMP <2.5 s), NFR-16 (linear reads)

---

> ⚠️ **Scope Expansion banner (READ FIRST — lesson 2026-05-31)**

The original epic-7 scope for 7-2 was a **fixed-order** Cap page (HeroBlock / nav / composition / recent activity). During `aped-story` the user (Alex) **explicitly expanded the scope** to a **configurable dashboard widget system** — widgets the user can **drag-reorder** and **enable/disable**, with **server-side per-user persistence** — and chose to keep it all in this single story (decision recorded below). This story therefore **supersedes** the epics.md 7-2 summary; the doc-sync to make every artefact agree is **task T28 of this story, not an afterthought**.

**Locked decisions (from the aped-story design gate):**

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Widgets are **fully configurable** — every widget (incl. the FR-41 trio) can be moved/hidden. **AC-1 is guaranteed on the DEFAULT layout only.** | User override. The default layout honours FR-41; customisation is opt-in. U1 (the 5-second guarantee) is weakened for custom layouts — documented tradeoff, captured in **ADR-0017**. |
| D2 | Composition + Recent-activity sections are **shared**, wired into BOTH the Cap view and the Patrimoine view. | Same components; FR-43 composition appears in both per `ux/screen-inventory.md`. |
| D3 | `recentActivity` is added to the **7-1 dashboard overview DTO** (server-side), NOT a separate web read. | User choice. Re-touches the done 7-1 aggregator + schema; doc-sync to 7-1/architecture in T28. |
| D4 | Extract a shared `txToActivity` helper and **refactor the 2 existing inline copies** (`transactions-recent-section.tsx`, `transactions-suggestions-section.tsx`). | DRY; the inline mapping is duplicated 2× today. Touches 5-x code → doc-debt noted. |
| D5 | Drag lib = **`@dnd-kit/core` + `@dnd-kit/sortable`, lazy-loaded (dynamic import) only in edit mode**. Web-only; RN reorder deferred to 10-2. | Protects AC-3 (0 bundle impact on the default render path). Keyboard-accessible. |
| D6 | Layout persistence = **server-side** (new `dashboard_layout` table + oRPC procedures on the dashboard module). | User choice over localStorage. Cross-device sync; new Prisma migration + repository. |

---

## User Story

**As a** Pekulo user, **I want** the Cap view's first viewport to show — in order, on the default layout — total wealth in EUR, compass progress %, and the next upcoming milestone with delta, plus one-tap navigation to every detail page **and** the ability to rearrange and show/hide my dashboard widgets, **so that** I answer "am I on track?" in under five seconds (PRD U1) while still tailoring the dashboard to what I care about.

## Acceptance Criteria

- **AC-1** *(default layout)* — **Given** a user who has NOT customised their layout, **When** the Cap view's first viewport renders, **Then** total wealth + compass % + next-milestone delta appear in that order.
- **AC-2** — **Given** the navigation, **When** I tap any of {transactions, mensuel, portefeuille, immobilier, parametres}, **Then** the target screen mounts in one tap; **and** each Recent-activity row navigates to `/dashboard/transactions` on tap.
- **AC-3** — **Given** the Lighthouse scan on `/dashboard` (mid-tier mobile + 4G), **When** CI runs, **Then** Performance ≥ 90; the dnd-kit edit layer MUST NOT load on the default (non-edit) render path.
- **AC-4** *(reorder)* — **Given** I enter "Personnaliser", **When** I drag a widget to a new position and tap "Terminé", **Then** the new order persists server-side and survives a full reload.
- **AC-5** *(visibility + reset)* — **Given** "Personnaliser" mode, **When** I toggle a widget off, **Then** it disappears from the grid and stays hidden after reload; **and** a "Réinitialiser" control restores the default layout.
- **AC-6** *(graceful fallback)* — **Given** a stored layout that is absent, malformed, or references unknown widget ids, **When** the Cap view loads, **Then** it renders the default layout (registry-merged, Zod-validated) and never throws.
- **AC-7** *(data states)* — **Given** the Hero / Composition / Recent-activity widgets, **When** their data is loading or empty, **Then** each renders a skeleton / empty state and never throws on a single empty source.
- **AC-8** *(total wealth source)* — **Given** the Hero widget, **When** it renders the headline figure, **Then** the amount equals the 7-1 total-wealth aggregate (cash + FX-adjusted holdings + net real-estate equity), not the compass current-wealth figure.
- **AC-9** *(composition)* — **Given** the Composition widget, **When** it renders, **Then** it shows three rows (Liquide / Placements / Immobilier) whose amounts come from the dashboard overview composition, each with its share-of-total percentage, the three summing to 100% (± rounding).

---

## Tasks

> Run commands from the repo root. `bun --filter=@pekulo/<pkg>` targets the **package name**, never the folder (lesson 2026-05-19). `tsc` is NOT in the commit gate — run `bun --filter=@pekulo/<pkg> run typecheck` + the relevant `bun test` before each commit (lesson 2026-06-01). After any Prisma schema change, `prisma:generate && typecheck` is one inseparable step.

**Phase A — Backend: per-user layout persistence (D6)**

- [x] **T1 — Prisma model `dashboard_layout` + migration** [AC: AC-4, AC-5]
  Create `apps/api/prisma/schema/dashboard.prisma`:
  ```prisma
  // apps/api/prisma/schema/dashboard.prisma
  // Per-user dashboard widget layout (story 7-2 / D6). One row per user
  // (userId is the PK — a user has exactly one layout). `widgets` is a JSONB
  // array of { id, visible, order }; validated by dashboardLayoutSchema at the
  // service boundary (defence in depth — never trust the column blind). RLS
  // (SELECT/INSERT/UPDATE where user_id = auth.uid()) is appended to the
  // migration SQL manually — Prisma does not introspect policies (ADR-0013).
  model DashboardLayout {
    userId    String   @id @map("user_id") @db.Uuid
    widgets   Json     @map("widgets") @db.JsonB
    updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
    createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

    @@map("dashboard_layout")
  }
  ```
  Generate the migration (no auto-apply — review the SQL first):
  ```bash
  bun --filter=@pekulo/api run prisma:migrate -- --name dashboard_layout --create-only
  ```
  Then append the RLS block to the generated `migration.sql` (mirror an existing per-user table migration, e.g. `compass_history`):
  ```sql
  ALTER TABLE "dashboard_layout" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "dashboard_layout_select_own" ON "dashboard_layout"
    FOR SELECT USING (user_id = auth.uid());
  CREATE POLICY "dashboard_layout_insert_own" ON "dashboard_layout"
    FOR INSERT WITH CHECK (user_id = auth.uid());
  CREATE POLICY "dashboard_layout_update_own" ON "dashboard_layout"
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  ```
  Apply + regenerate the client (one inseparable step):
  ```bash
  bun --filter=@pekulo/api run prisma:migrate && bun --filter=@pekulo/api run prisma:generate && bun --filter=@pekulo/api run typecheck
  ```
  Expected: migration applied, `DashboardLayout` available on the generated client, `typecheck` exit 0.
  Commit: `git add apps/api/prisma/schema/dashboard.prisma apps/api/prisma/migrations && git commit -m "feat(#39): dashboard_layout table + RLS (D6)"`

- [x] **T2 — Layout validators** [AC: AC-4, AC-5, AC-6]
  Append to `packages/validators/src/dashboard/dashboard.schemas.ts` (after the existing `dashboardOverviewSchema` block — full additions below):
  ```ts
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
  ```
  Verify the barrel re-exports the dashboard schemas (it already does via `packages/validators/src/dashboard/index.ts` → check it exports `*` from `./dashboard.schemas`; if not, add `export * from "./dashboard.schemas";`).
  Run: `bun --filter=@pekulo/validators run typecheck`
  Expected: exit 0.
  Commit: `git add packages/validators/src/dashboard && git commit -m "feat(#39): dashboard layout validators (D6)"`

- [x] **T3 — Extend the dashboard oRPC contract with layout procedures** [AC: AC-4, AC-5]
  Replace the body of `packages/contracts/src/dashboard/dashboard.contract.ts` (current code quoted in Dev Notes § Step-0) with:
  ```ts
  // packages/contracts/src/dashboard/dashboard.contract.ts
  // Dashboard module oRPC contract.
  //   - getOverview : cross-domain wealth aggregate + recentActivity (FR-43, 7-2 D3). No input.
  //   - getLayout   : the caller's saved widget layout, or null (7-2 D6). No input.
  //   - saveLayout  : upsert the caller's widget layout (7-2 D6).
  // See ADR-0009 (mount under /rpc/v1/dashboard).

  import { oc } from "@orpc/contract";
  import {
    dashboardOverviewSchema,
    dashboardLayoutSchema,
    saveDashboardLayoutInputSchema,
  } from "@pekulo/validators";

  export const dashboardContractV1 = {
    getOverview: oc.output(dashboardOverviewSchema),
    getLayout: oc.output(dashboardLayoutSchema.nullable()),
    saveLayout: oc.input(saveDashboardLayoutInputSchema).output(dashboardLayoutSchema),
  } as const;

  export const dashboardContract = dashboardContractV1;
  export const dashboardContractMeta = {
    moduleKey: "dashboard",
    mountPath: "/rpc/v1/dashboard",
    version: "v1",
  } as const;
  ```
  Run: `bun --filter=@pekulo/contracts run typecheck`
  Expected: exit 0.
  Commit: `git add packages/contracts/src/dashboard && git commit -m "feat(#39): dashboard contract getLayout/saveLayout (D6)"`

- [x] **T4 — Layout repository** [AC: AC-4, AC-5]
  Create `apps/api/src/modules/dashboard/dashboard-layout.repository.ts`:
  ```ts
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
  ```
  Run: `bun --filter=@pekulo/api run typecheck`
  Expected: exit 0.
  Commit: `git add apps/api/src/modules/dashboard/dashboard-layout.repository.ts && git commit -m "feat(#39): dashboard layout repository (D6)"`

- [x] **T5 — Layout service + errors** [AC: AC-4, AC-5, AC-6]
  Create `apps/api/src/modules/dashboard/dashboard-layout.service.ts`:
  ```ts
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
  ```
  Run: `bun --filter=@pekulo/api run typecheck`
  Expected: exit 0.
  Commit: `git add apps/api/src/modules/dashboard/dashboard-layout.service.ts && git commit -m "feat(#39): dashboard layout service (D6)"`

- [x] **T6 — Mount layout procedures on the dashboard router** [AC: AC-4, AC-5]
  Replace `apps/api/src/modules/dashboard/dashboard.routes.ts` (current code in Dev Notes § Step-0) with:
  ```ts
  // apps/api/src/modules/dashboard/dashboard.routes.ts
  // oRPC handlers for the dashboard module. getOverview (read, story 7-1 + 7-2
  // recentActivity) + getLayout/saveLayout (story 7-2 / D6). Mirrors
  // compass.routes.ts: router built from the shared @pekulo/contracts contract
  // via implement(contract).$context<T>().router(...). Router type inferred via
  // ReturnType<typeof createDashboardRouter>; never annotated as Elysia.

  import { implement } from "@orpc/server";
  import { dashboardContract } from "@pekulo/contracts";
  import { PekuloError } from "../../common/errors";
  import type { DashboardService } from "./dashboard.service";
  import type { DashboardLayoutService } from "./dashboard-layout.service";

  const impl = implement(dashboardContract).$context<{
    userId: string;
    email: string | null;
  }>();

  function requireUserId(userId: string | undefined): string {
    if (!userId?.trim()) {
      throw new PekuloError("UNAUTHORIZED", "user context missing");
    }
    return userId;
  }

  export function createDashboardRouter(deps: {
    service: DashboardService;
    layoutService: DashboardLayoutService;
  }) {
    return impl.router({
      getOverview: impl.getOverview.handler(async ({ context }) => {
        return deps.service.getOverview(requireUserId(context.userId));
      }),
      getLayout: impl.getLayout.handler(async ({ context }) => {
        return deps.layoutService.getLayout(requireUserId(context.userId));
      }),
      saveLayout: impl.saveLayout.handler(async ({ context, input }) => {
        return deps.layoutService.saveLayout(requireUserId(context.userId), input);
      }),
    });
  }
  ```
  Run: `bun --filter=@pekulo/api run typecheck`
  Expected: exit 0.
  Commit: `git add apps/api/src/modules/dashboard/dashboard.routes.ts && git commit -m "feat(#39): mount dashboard getLayout/saveLayout (D6)"`

- [x] **T7 — Wire the layout repo/service into the dashboard module** [AC: AC-4, AC-5]
  Replace `apps/api/src/modules/dashboard/dashboard.module.ts` to also build the layout repository + service and pass them to the router. The module now needs `prismaService` (the overview ports stay). Full file:
  ```ts
  // apps/api/src/modules/dashboard/dashboard.module.ts
  // Module factory for the dashboard domain. The OVERVIEW half is pure
  // composition (no Prisma) — DashboardPorts over the four wealth modules +
  // compass + recent-activity (story 7-1 + 7-2 D3). The LAYOUT half (story 7-2
  // D6) owns ONE table (dashboard_layout) via its own repository/service. Both
  // halves mount on the single dashboard router. Router type inferred via
  // ReturnType<typeof createDashboardRouter>; never annotated as Elysia.

  import type { PrismaService } from "../../database";
  import { createDashboardService, type DashboardPorts } from "./dashboard.service";
  import { createDashboardRouter } from "./dashboard.routes";
  import { createDashboardLayoutRepository } from "./dashboard-layout.repository";
  import { createDashboardLayoutService } from "./dashboard-layout.service";

  export interface DashboardModule {
    router: ReturnType<typeof createDashboardRouter>;
  }

  export function createDashboardModule(
    deps: DashboardPorts & { prismaService: PrismaService },
  ): DashboardModule {
    const { prismaService, ...ports } = deps;
    const service = createDashboardService(ports);
    const layoutRepository = createDashboardLayoutRepository({ client: prismaService.client });
    const layoutService = createDashboardLayoutService({ repository: layoutRepository });
    const router = createDashboardRouter({ service, layoutService });
    return { router };
  }
  ```
  Then update the `createDashboardModule({...})` call in `apps/api/src/bootstrap/runtime-dependencies.ts` (current call quoted in Dev Notes § Step-0) — add `prismaService` to the object:
  ```ts
    const dashboardModule = createDashboardModule({
      prismaService,
      listAccounts: (userId) => accountsModule.service.list(userId),
      listHoldings: (userId) => holdingsModule.service.list(userId, { includeClosed: false }),
      resolveQuote: (input) => holdingsModule.service.resolveQuote(input),
      getRates: (base) => holdingsModule.frankfurterClient.getRates(base),
      getTotalEquity: (userId) => realestateModule.service.getTotalEquity(userId),
      getCompass: (userId) => compassModule.service.getCompass(userId),
      computeProgress: (input) => compassModule.service.computeProgress(input),
      // story 7-2 D3 — recent activity port (transactions + account labels)
      listRecentActivity: (userId, limit) =>
        transactionsModule.service.listRecentActivity(userId, limit),
    });
  ```
  > NB: `dashboardModule` no longer exposes `.service` (only `.router`) — confirm no other consumer reads `dashboardModule.service` (none today). The `orpcRouter.dashboard = dashboardModule.router` line is unchanged.
  Run: `bun --filter=@pekulo/api run typecheck`
  Expected: exit 0.
  Commit: `git add apps/api/src/modules/dashboard/dashboard.module.ts apps/api/src/bootstrap/runtime-dependencies.ts && git commit -m "feat(#39): wire dashboard layout into module + runtime deps (D6)"`

**Phase B — Backend: recentActivity in the overview DTO (D3)**

- [x] **T8 — Add `recentActivity` to the overview schema** [AC: AC-2, AC-7]
  Insert into `packages/validators/src/dashboard/dashboard.schemas.ts`, BEFORE `dashboardOverviewSchema`:
  ```ts
  import { txDirectionSchema } from "../transactions"; // "in" | "out" display direction
  import { transactionCategorySchema } from "../transactions";

  // One recent-activity row (story 7-2 / D3). The server resolves account LABEL
  // + direction + EUR amount; `category` stays the raw enum so the web maps it
  // to its French label + icon (TRANSACTION_CATEGORY_LABELS + CategoryIcon) —
  // keeps API copy-free. logoUrl is the opaque Pekulo proxy URL (6-10) or null.
  export const dashboardActivitySchema = z.object({
    label: z.string(),
    account: z.string(),
    category: transactionCategorySchema,
    direction: txDirectionSchema,
    amountEur: z.number(),
    logoUrl: z.string().nullable().optional(),
  });
  export type DashboardActivity = z.infer<typeof dashboardActivitySchema>;
  ```
  > **Verify the import paths**: confirm `txDirectionSchema` and `transactionCategorySchema` are exported from `packages/validators/src/transactions` (the transactions barrel). If `txDirectionSchema` lives only in `@pekulo/types` (`TX_DIRECTIONS`), define a local `z.enum(["in","out"])` here instead and add a `// mirrors @pekulo/types TxDirection` comment.
  Then add the field to `dashboardOverviewSchema` (current schema in Dev Notes § Step-0) — append after `fx`:
  ```ts
    recentActivity: z.array(dashboardActivitySchema),
  ```
  Run: `bun --filter=@pekulo/validators run typecheck && bun --filter=@pekulo/validators test`
  Expected: exit 0; existing dashboard schema tests pass.
  Commit: `git add packages/validators/src/dashboard && git commit -m "feat(#39): dashboard overview recentActivity field (D3)"`

- [x] **T9 — Compose `recentActivity` in `getOverview` + add the port** [AC: AC-2, AC-7]
  In `apps/api/src/modules/dashboard/dashboard.service.ts` add to the `DashboardPorts` interface (current interface in Dev Notes § Step-0):
  ```ts
    // story 7-2 D3 — last N confirmed activity rows, already shaped to the
    // dashboard activity DTO (account label resolved, direction/amount mapped).
    listRecentActivity: (
      userId: string,
      limit: number,
    ) => Promise<import("@pekulo/validators").DashboardActivity[]>;
  ```
  In `getOverview`, add `listRecentActivity` to the `Promise.all` (best-effort — an empty/failed activity read MUST NOT 500 the wealth aggregate, AC-7) and return it:
  ```ts
        const [accounts, holdings, rates, equity, compassRow, recentActivity] = await Promise.all([
          deps.listAccounts(userId),
          deps.listHoldings(userId),
          deps.getRates("EUR").catch(() => null),
          deps.getTotalEquity(userId),
          deps.getCompass(userId).catch(() => null),
          // recent activity is presentational — degrade to [] on any failure.
          deps.listRecentActivity(userId, 5).catch(() => []),
        ]);
  ```
  …and add `recentActivity` to the returned object (after `fx`):
  ```ts
          fx: { source: snapshot.fxSource, asOf: snapshot.fxAsOf },
          recentActivity,
  ```
  Implement the port in the transactions service (`apps/api/src/modules/transactions/transactions.service.ts`) — add a `listRecentActivity(userId, limit)` method that lists the most-recent confirmed transactions and maps each to `DashboardActivity` (resolve account label via the accounts read the module already has, or via a narrow port; `direction = type === "inflow" ? "in" : "out"`, `amountEur = amount`, `category` raw, `logoUrl` passthrough). Mirror the existing list read path; reuse the account-label resolution the recent-section uses on the web (here it must be server-side — the transactions service already resolves logos via the logos port, follow that wiring).
  Run: `bun --filter=@pekulo/api run typecheck && bun --filter=@pekulo/api test src/modules/dashboard`
  Expected: dashboard service + integration tests pass (T10 adds the new assertions).
  Commit: `git add apps/api/src/modules/dashboard/dashboard.service.ts apps/api/src/modules/transactions/transactions.service.ts && git commit -m "feat(#39): compose recentActivity in dashboard overview (D3)"`

- [x] **T10 — Service tests for recentActivity + layout** [AC: AC-2, AC-4, AC-5, AC-6]
  Extend `apps/api/src/modules/dashboard/dashboard.service.test.ts`: given a ports stub returning 3 recent activities → `getOverview().recentActivity` has length 3 in order; given `listRecentActivity` rejecting → `recentActivity` is `[]` and the wealth fields still resolve (AC-7).
  Add `apps/api/src/modules/dashboard/dashboard-layout.service.test.ts`: `getLayout` returns null when repo empty; returns parsed layout on a valid row; returns null on a malformed row (AC-6); `saveLayout` rejects an invalid widget id (Zod throw) and upserts a valid one.
  Run: `bun --filter=@pekulo/api test src/modules/dashboard`
  Expected: `Tests: <n> passed`, exit 0.
  Commit: `git add apps/api/src/modules/dashboard/*.test.ts && git commit -m "test(#39): dashboard recentActivity + layout service (D3,D6)"`

**Phase C — Web: real-data widgets (D2, D3, D4)**

- [x] **T11 — Extract `txToActivity` + refactor the 2 inline callsites (D4)** [AC: AC-2]
  Create `apps/web/src/app/(cap)/dashboard/_lib/to-activity.ts`:
  ```ts
  // apps/web/src/app/(cap)/dashboard/_lib/to-activity.ts
  // Single source of the Transaction → Activity (PekuloActivityRow `tx` prop)
  // mapping. Extracted from the two inline copies in transactions-recent-section
  // and transactions-suggestions-section (story 7-2 / D4). `accountLabel` is
  // resolved by the caller (it owns the accountId→label map). Category stays the
  // raw enum here and is turned into a label + icon at the row layer.
  import type { Transaction } from "@pekulo/validators";
  import { TRANSACTION_CATEGORY_LABELS } from "@pekulo/types";
  import type { Activity } from "@pekulo/types";

  export function txToActivity(tx: Transaction, accountLabel: string): Activity {
    return {
      label: tx.label,
      account: accountLabel,
      category: TRANSACTION_CATEGORY_LABELS[tx.category],
      direction: tx.type === "inflow" ? "in" : "out",
      amountEur: tx.amount,
      logoUrl: tx.logoUrl ?? null,
    };
  }
  ```
  Add `apps/web/src/app/(cap)/dashboard/_lib/to-activity.test.ts` asserting inflow→`in`, outflow→`out`, category-label mapping, logoUrl passthrough.
  Refactor `transactions-recent-section.tsx` (lines ~229-235, current code in Dev Notes § Step-0) and `transactions-suggestions-section.tsx` (lines ~160-165) to build the activity via `txToActivity(tx, accountLabelById.get(tx.accountId) ?? "—")` instead of the inline object literal. (The suggestions section maps the suggestion variant — keep its `dateLabel`/`suggestedCategory` fields, only the shared `label/account/category/direction/amountEur` come from a small adapter; if the shapes diverge too far, keep `txToActivity` for the recent-section only and leave suggestions — record that in the commit body.)
  Run: `bun --filter=@pekulo/web test src/app/\(cap\)/dashboard/_lib && bun --filter=@pekulo/web run typecheck`
  Expected: `Tests: <n> passed`, exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_lib/to-activity.ts" "apps/web/src/app/(cap)/dashboard/_lib/to-activity.test.ts" "apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx" "apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.tsx" && git commit -m "refactor(#39): extract shared txToActivity (D4)"`

- [x] **T12 — `selectNextMilestone` pure helper** [AC: AC-1]
  Create `apps/web/src/app/(cap)/dashboard/_lib/select-next-milestone.ts`:
  ```ts
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
    const upcoming = statuses
      .filter((s) => s.delta > 0)
      .sort((a, b) => a.delta - b.delta);
    const next = upcoming[0];
    return next ? { id: next.id, deltaEur: next.delta } : null;
  }
  ```
  Add `select-next-milestone.test.ts`: picks the smallest positive delta; returns null when all `delta <= 0`; returns null on `[]`/`undefined`.
  Run: `bun --filter=@pekulo/web test src/app/\(cap\)/dashboard/_lib/select-next-milestone.test.ts`
  Expected: `Tests: <n> passed`, exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_lib/select-next-milestone.ts" "apps/web/src/app/(cap)/dashboard/_lib/select-next-milestone.test.ts" && git commit -m "feat(#39): selectNextMilestone helper (FR-41)"`

- [x] **T13 — `CompositionSection` (shared)** [AC: AC-9, AC-7]
  Create `apps/web/src/app/(cap)/dashboard/_components/composition-section.tsx`. Consume `useDashboardOverview()`, derive the three rows from `composition`, compute each `pct = amount / totalWealthEur` (guard `total <= 0 → 0`), render `PekuloCompositionRow`. Loading skeleton while `isLoading`; empty state when total is 0. Heading "Composition" (h2). Use `Section` for the card variant (desktop) and a flat `<View render="section">` for mobile, controlled by a `variant?: "flat" | "card"` prop (default `flat`).
  ```tsx
  "use client";
  import { PekuloCompositionRow, PekuloSkeleton, Section } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";
  import { useDashboardOverview } from "../_hooks/use-dashboard-overview";

  const ROWS = [
    { key: "liquideEur", label: "Liquide" },
    { key: "placementsEur", label: "Placements" },
    { key: "immobilierEur", label: "Immobilier" },
  ] as const;

  export function CompositionSection({ variant = "flat" }: { variant?: "flat" | "card" }) {
    const { data, isLoading } = useDashboardOverview();
    const body =
      isLoading || !data ? (
        <PekuloSkeleton lines={3} height={40} />
      ) : data.totalWealthEur <= 0 ? (
        <Text color="$colorTertiary" fontSize="$caption">
          Aucune donnée de patrimoine pour l'instant.
        </Text>
      ) : (
        <View flexDirection="column">
          {ROWS.map(({ key, label }) => {
            const amount = data.composition[key];
            const pct = data.totalWealthEur > 0 ? amount / data.totalWealthEur : 0;
            return <PekuloCompositionRow key={key} label={label} amount={amount} pct={pct} />;
          })}
        </View>
      );
    if (variant === "card") {
      return (
        <Section title="Composition" ariaLabel="Composition du patrimoine">
          {body}
        </Section>
      );
    }
    return (
      <View render="section" aria-labelledby="comp-h" flexDirection="column">
        <Text id="comp-h" render="h2" color="$color" fontSize="$h3" fontWeight="600" marginBottom="$3" $lg={{ fontSize: "$h2" }}>
          Composition
        </Text>
        {body}
      </View>
    );
  }
  ```
  Add `composition-section.test.tsx` (renders 3 rows with correct pct; loading; empty when total 0) using the project's `renderWithTamagui` test util (see existing `milestones-section.a11y.test.tsx` for the harness).
  Run: `bun --filter=@pekulo/web test src/app/\(cap\)/dashboard/_components/composition-section.test.tsx`
  Expected: `Tests: <n> passed`, exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_components/composition-section.tsx" "apps/web/src/app/(cap)/dashboard/_components/composition-section.test.tsx" && git commit -m "feat(#39): CompositionSection wired to overview (FR-43)"`

- [x] **T14 — `RecentActivitySection` (shared, consumes overview.recentActivity)** [AC: AC-2, AC-7]
  Create `apps/web/src/app/(cap)/dashboard/_components/recent-activity-section.tsx`. Consume `useDashboardOverview().data.recentActivity`. Render `PekuloActivityRow` per item (map `category` enum → `TRANSACTION_CATEGORY_LABELS` + `CategoryIcon` prefix, reuse `TransactionLogo` for `logoUrl` — mirror `transactions-recent-section.tsx` rows). Each row wraps a button navigating to `/dashboard/transactions` (`useRouter().push`) — AC-2. Loading skeleton; empty state ("Aucune activité récente."). `variant?: "flat" | "card"` like CompositionSection. Heading "Activité récente" + a "Voir tout" header action (card variant) routing to `/dashboard/transactions`.
  ```tsx
  "use client";
  import { useRouter } from "next/navigation";
  import { PekuloActivityRow, PekuloSkeleton, Section } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";
  import type { Activity } from "@pekulo/types";
  import { TRANSACTION_CATEGORY_LABELS } from "@pekulo/types";
  import { useDashboardOverview } from "../_hooks/use-dashboard-overview";
  import { CategoryIcon } from "../transactions/_components/category-icon"; // verify path in Step-0 grep
  import { TransactionLogo } from "../transactions/_components/transaction-logo"; // verify path

  export function RecentActivitySection({ variant = "flat" }: { variant?: "flat" | "card" }) {
    const router = useRouter();
    const { data, isLoading } = useDashboardOverview();
    const items = data?.recentActivity ?? [];
    const body =
      isLoading || !data ? (
        <PekuloSkeleton lines={5} height={48} />
      ) : items.length === 0 ? (
        <Text color="$colorTertiary" fontSize="$caption">
          Aucune activité récente.
        </Text>
      ) : (
        <View flexDirection="column" role="list" aria-label="Activité récente">
          {items.map((item, i) => {
            const activity: Activity = {
              label: item.label,
              account: item.account,
              category: TRANSACTION_CATEGORY_LABELS[item.category],
              direction: item.direction,
              amountEur: item.amountEur,
              logoUrl: item.logoUrl,
            };
            return (
              <View
                key={`${item.label}-${item.amountEur}-${i}`}
                role="listitem"
                render="button"
                onPress={() => router.push("/dashboard/transactions")}
                cursor="pointer"
                backgroundColor="transparent"
                borderWidth={0}
                aria-label={`${item.label}, voir dans les transactions`}
              >
                <PekuloActivityRow
                  tx={activity}
                  categoryPrefix={<CategoryIcon category={item.category} size={14} color="var(--colorTertiary)" style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />}
                  logo={<TransactionLogo src={item.logoUrl} category={item.category} />}
                />
              </View>
            );
          })}
        </View>
      );
    if (variant === "card") {
      return (
        <Section title="Activité récente" ariaLabel="Activité récente">
          {body}
        </Section>
      );
    }
    return (
      <View render="section" aria-labelledby="act-h" flexDirection="column">
        <Text id="act-h" render="h2" color="$color" fontSize="$h3" fontWeight="600" marginBottom="$3" $lg={{ fontSize: "$h2" }}>
          Activité récente
        </Text>
        {body}
      </View>
    );
  }
  ```
  > **Step-0 verify** the exact import paths of `CategoryIcon` / `TransactionLogo` (grep under `transactions/_components`). If they are not exported for cross-folder import, lift the minimal icon mapping into `_lib/` rather than reaching into another route folder.
  Add `recent-activity-section.test.tsx`: 5 items render; row press calls `router.push("/dashboard/transactions")`; empty state.
  Run: `bun --filter=@pekulo/web test src/app/\(cap\)/dashboard/_components/recent-activity-section.test.tsx`
  Expected: `Tests: <n> passed`, exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_components/recent-activity-section.tsx" "apps/web/src/app/(cap)/dashboard/_components/recent-activity-section.test.tsx" && git commit -m "feat(#39): RecentActivitySection from overview.recentActivity (FR-42)"`

- [x] **T15 — `HeroAnchor` (total wealth + next-milestone line)** [AC: AC-1, AC-8]
  Create `apps/web/src/app/(cap)/dashboard/_components/hero-anchor.tsx`. Reads `useDashboardOverview()` for `totalWealthEur` (AC-8 — NOT compass currentWealth) → render `PekuloCountUpEUR`. Reads `useCapDashboardState()` + `useMilestoneStatuses(currentWealth)` → `selectNextMilestone` → render a compact "Prochain palier · +{deltaEur} € à atteindre" line. `variant: "mobile" | "card"` (card adds the Cap objectif + Plan/an `dl`, mirroring the ux-preview HeroBlock card). Loading skeletons per the existing mobile hero in `cap-view.tsx` (Step-0). This is the FR-41 anchor: wealth headline + (the compass donut % lives in the adjacent `compass` widget) + next-milestone line.
  Provide the full component (mirror the structure of the current `MobileFlatCapView` hero block + MiniKpis card `dl` from Step-0; reuse the `eur0` / `eurCompact` formatters). Heading `aria-label="Patrimoine total"`.
  Add `hero-anchor.test.tsx`: renders `totalWealthEur` from a mocked `useDashboardOverview`; shows the next-milestone line when `selectNextMilestone` returns a value, hides it when null.
  Run: `bun --filter=@pekulo/web test src/app/\(cap\)/dashboard/_components/hero-anchor.test.tsx`
  Expected: `Tests: <n> passed`, exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_components/hero-anchor.tsx" "apps/web/src/app/(cap)/dashboard/_components/hero-anchor.test.tsx" && git commit -m "feat(#39): HeroAnchor total wealth + next milestone (FR-41, AC-8)"`

- [x] **T16 — Web layout actions + hook + registry edge** [AC: AC-4, AC-5, AC-6]
  Create `apps/web/src/app/(cap)/dashboard/_actions/dashboard-layout-actions.ts` (thin oRPC delegators, mirror `dashboard-actions.ts` Step-0): `getDashboardLayout` (read, `z.void()` → `DashboardLayout | null`) and `saveDashboardLayout` (input `saveDashboardLayoutInputSchema`, `tags: [dashboardLayoutTags.current()]`).
  Add to `apps/web/src/lib/zapaction/keys.ts` (in the dashboard block, Step-0 lines 146-156):
  ```ts
  export const dashboardLayoutKeys = createFeatureKeys(DASHBOARD_KEY, {
    layout: () => ["layout"] as const,
  });
  export const dashboardLayoutTags = createFeatureTags(DASHBOARD_KEY, {
    current: () => ["layout"] as const,
  });
  ```
  …and a registry edge so saving the layout refetches it (add inside `setTagRegistry({...})`):
  ```ts
    [dashboardLayoutTags.current()]: [dashboardLayoutKeys.layout()],
  ```
  Create `apps/web/src/app/(cap)/dashboard/_hooks/use-dashboard-layout.ts`: a read query (`getDashboardLayout`, `dashboardLayoutKeys.layout()`, `read-only`) + a save mutation (`saveDashboardLayout`, `invalidateWithTags: [dashboardLayoutTags.current()]` — declared via the registry, NOT a manual `invalidateQueries`, R4). It exposes `{ widgets, save, reset, isEditing, setEditing }` where `widgets` is the **merged** layout (registry defaults overlaid by the saved layout — see T18) so AC-6 holds. `reset` saves the default layout.
  Run: `bun --filter=@pekulo/web run typecheck && bun --filter=@pekulo/web test src/lib/zapaction`
  Expected: exit 0; the keys registry test (Step-0: keys.ts has a registry test) still passes (add an assertion that `dashboardLayoutTags.current()` maps to `dashboardLayoutKeys.layout()`).
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_actions/dashboard-layout-actions.ts" "apps/web/src/app/(cap)/dashboard/_hooks/use-dashboard-layout.ts" apps/web/src/lib/zapaction/keys.ts && git commit -m "feat(#39): dashboard layout web action + hook + registry edge (D6)"`

**Phase D — Web: configurable widget system (D1, D5)**

- [x] **T17 — Install dnd-kit (lazy use only)** [AC: AC-3, AC-4]
  ```bash
  bun add --filter=@pekulo/web @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/utilities@3.2.2
  ```
  > Before pinning, run `npm view @dnd-kit/sortable peerDependencies` and confirm `@dnd-kit/core@^6` is the correct pair (lesson: verify versions via npm directly, dist-tags lag). dnd-kit is imported ONLY through a `dynamic(() => import(...), { ssr: false })` boundary in T20 — it MUST NOT appear in the default route bundle (AC-3).
  Run: `bun --filter=@pekulo/web run typecheck`
  Expected: exit 0; lockfile updated.
  Commit: `git add apps/web/package.json bun.lock && git commit -m "chore(#39): add @dnd-kit (lazy edit-mode only, D5)"`

- [x] **T18 — Widget registry + layout schema/merge** [AC: AC-1, AC-6]
  Create `apps/web/src/app/(cap)/dashboard/_widgets/widget-registry.tsx` — the SSOT for the widget set. Each entry: `{ id: DashboardWidgetId; label: string; defaultOrder: number; defaultVisible: boolean; colSpan: number; render: () => ReactNode }`. `defaultOrder` encodes the FR-41-compliant default (AC-1): `hero`(0), `compass`(1), `nextMilestone`(2), then `trajectory`, `milestones`, `hypothesis`, `composition`, `recentActivity`. `render` returns the real component (`<HeroAnchor variant="card"/>`, `<CompassSection/>`, `<CompositionSection variant="card"/>`, `<RecentActivitySection variant="card"/>`, `<MilestonesSection .../>`, and the remaining `PlaceholderCard` variants for `trajectory`/`hypothesis`). `colSpan` mirrors the current bento (hero 7, compass 5, trajectory 7, milestones 5, composition 5, recentActivity 7, hypothesis 12, nextMilestone 12-or-fold-into-hero).
  Create `apps/web/src/app/(cap)/dashboard/_widgets/layout.ts` — pure `resolveLayout(saved: DashboardLayout | null): ResolvedWidget[]`: start from registry defaults; overlay the saved `{id→{visible,order}}`; **drop** unknown ids; **append** registry ids missing from `saved` at the end (so a newly-added widget appears for existing users); sort by `order`. This is the AC-6 reconciliation. Plus `defaultLayout(): DashboardLayout` (used by `reset`).
  Add `layout.test.ts`: default render order honours FR-41 (hero, compass, nextMilestone first); unknown id dropped; missing id appended; malformed saved → defaults.
  Run: `bun --filter=@pekulo/web test src/app/\(cap\)/dashboard/_widgets/layout.test.ts`
  Expected: `Tests: <n> passed`, exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_widgets/widget-registry.tsx" "apps/web/src/app/(cap)/dashboard/_widgets/layout.ts" "apps/web/src/app/(cap)/dashboard/_widgets/layout.test.ts" && git commit -m "feat(#39): widget registry + layout merge (D1, AC-6)"`

- [x] **T19 — `WidgetGrid` (read view, no dnd)** [AC: AC-1, AC-3, AC-7]
  Create `apps/web/src/app/(cap)/dashboard/_widgets/widget-grid.tsx`. Props: `widgets: ResolvedWidget[]`, `editing: boolean`. In the NON-editing path it renders the visible widgets in order — desktop: a CSS-grid (reuse `bento.module.css`, applying each widget's `colSpan` via an inline `gridColumn: span N`); mobile: a flat `gap-10` column. It renders the real components from the registry. **No dnd import on this path** (AC-3). When `editing` is true it renders the lazy `<WidgetEditLayer/>` (T20) instead.
  ```tsx
  "use client";
  import dynamic from "next/dynamic";
  import { View } from "@pekulo/ui/client";
  import type { ResolvedWidget } from "./layout";
  import styles from "../_components/bento.module.css";

  const WidgetEditLayer = dynamic(() => import("./edit/widget-edit-layer").then((m) => m.WidgetEditLayer), {
    ssr: false,
    loading: () => null,
  });

  export function WidgetGrid({ widgets, editing }: { widgets: ResolvedWidget[]; editing: boolean }) {
    const visible = widgets.filter((w) => w.visible);
    if (editing) return <WidgetEditLayer widgets={widgets} />;
    return (
      <>
        <View $lg={{ display: "none" }}>
          <View flexDirection="column" gap="$10">
            {visible.map((w) => (
              <View key={w.id}>{w.render()}</View>
            ))}
          </View>
        </View>
        <View display="none" $lg={{ display: "block" }}>
          <div className={styles.bento}>
            {visible.map((w) => (
              <div key={w.id} style={{ gridColumn: `span ${w.colSpan} / span ${w.colSpan}` }}>
                {w.render()}
              </div>
            ))}
          </div>
        </View>
      </>
    );
  }
  ```
  Add `widget-grid.test.tsx`: renders visible widgets in order; hidden widget absent; `editing=false` does NOT import the edit layer (assert no dnd module in the rendered tree).
  Run: `bun --filter=@pekulo/web test src/app/\(cap\)/dashboard/_widgets/widget-grid.test.tsx`
  Expected: `Tests: <n> passed`, exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_widgets/widget-grid.tsx" "apps/web/src/app/(cap)/dashboard/_widgets/widget-grid.test.tsx" && git commit -m "feat(#39): WidgetGrid read view (AC-1, AC-3)"`

- [x] **T20 — `WidgetEditLayer` (dnd-kit sortable + visibility toggles)** [AC: AC-4, AC-5]
  Create `apps/web/src/app/(cap)/dashboard/_widgets/edit/widget-edit-layer.tsx` — the ONLY module that imports `@dnd-kit/*`. A `DndContext` + `SortableContext` over the widgets; each widget is a `useSortable` row with a drag handle (`aria-roledescription="sortable"`, keyboard sensor enabled) and a visibility checkbox (`PekuloSwitch` or a checkbox — style the active state via `activeStyle`, lesson tamagui-active-style). On drop / toggle, it calls `useDashboardLayout().save(nextLayout)`; a "Réinitialiser" button calls `reset()`; a "Terminé" button calls `setEditing(false)`. Reorder is keyboard-accessible (dnd-kit `KeyboardSensor` + `sortableKeyboardCoordinates`).
  > This is the highest-risk task. **Before writing, verify the dnd-kit v6/v10 API via Context7** (`resolve-library-id` → `query-docs` for `@dnd-kit/sortable`): `DndContext`, `closestCenter`, `SortableContext`, `verticalListSortingStrategy`, `useSortable`, `arrayMove`, sensors. Do not invent the API from memory.
  Add `widget-edit-layer.test.tsx` (jsdom): toggling a visibility checkbox calls `save` with that widget `visible:false`; a simulated keyboard reorder calls `save` with the new order; "Réinitialiser" calls `reset`.
  Run: `bun --filter=@pekulo/web test src/app/\(cap\)/dashboard/_widgets/edit/widget-edit-layer.test.tsx`
  Expected: `Tests: <n> passed`, exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_widgets/edit/" && git commit -m "feat(#39): widget edit layer — dnd-kit reorder + toggle (D5, AC-4, AC-5)"`

- [x] **T21 — "Personnaliser" entry + edit context in `CapShell`** [AC: AC-4, AC-5]
  In `apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx` (current code in Dev Notes § Step-0): add a "Personnaliser" / "Terminé" toggle button in `.headerRight` (root + cap tab only — `isDashboardRoot && activeTab === "cap"`). Lift the `isEditing` boolean: since `WidgetGrid` lives under `CapView` (the shell's `children`), expose editing via a small React context provider mounted in the shell (`DashboardEditProvider`) consumed by both the shell button and `CapView`. Keep the existing "Nouvelle transaction" pill + UserDot untouched.
  Create `apps/web/src/app/(cap)/dashboard/_components/dashboard-edit-context.tsx` (`createContext<{ editing; setEditing }>` + `useDashboardEdit()` hook + provider). Wrap `CapShell`'s return in the provider; the button calls `setEditing(v => !v)`.
  Run: `bun --filter=@pekulo/web run typecheck && bun --filter=@pekulo/web test src/app/\(cap\)/dashboard/_components/cap-shell.test.tsx` (create if absent: button toggles editing).
  Expected: exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx" "apps/web/src/app/(cap)/dashboard/_components/dashboard-edit-context.tsx" && git commit -m "feat(#39): Personnaliser toggle + edit context (D1)"`

- [x] **T22 — Rewire `CapView` onto `WidgetGrid`** [AC: AC-1, AC-3, AC-8]
  Replace the body of `apps/web/src/app/(cap)/dashboard/_components/cap-view.tsx` (current code in Dev Notes § Step-0): drop the hand-built mobile stack + desktop bento and render `<WidgetGrid widgets={resolved} editing={editing} />`, where `resolved = resolveLayout(useDashboardLayout().widgets)` and `editing = useDashboardEdit().editing`. Keep the `AddMilestoneDialogProvider` wrapper. The hero/compass/composition/recentActivity widgets now come from the registry (real data); `trajectory`/`hypothesis` keep their `PlaceholderCard`. Verify the FR-41 default order renders correctly (AC-1) and that `useDashboardOverview` is the wealth source (AC-8).
  Update `apps/web/src/app/(cap)/dashboard/page.test.tsx` if it asserts the old placeholder markers ("Bientôt · 5-x" etc.) — replace with assertions on the real sections / default order.
  Run: `bun --filter=@pekulo/web test src/app/\(cap\)/dashboard/page.test.tsx && bun --filter=@pekulo/web run typecheck`
  Expected: `Tests: <n> passed`, exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_components/cap-view.tsx" "apps/web/src/app/(cap)/dashboard/page.test.tsx" && git commit -m "feat(#39): CapView renders WidgetGrid (FR-41 default, AC-1/3/8)"`

- [x] **T23 — Wire shared sections into `PatrimoineView` (D2)** [AC: AC-2, AC-9]
  In `apps/web/src/app/(cap)/dashboard/_components/patrimoine-view.tsx` (Step-0): replace the two `FlatListPlaceholder` blocks (Composition / Activité récente) with `<CompositionSection variant="flat" />` and `<RecentActivitySection variant="flat" />`. Keep the hero + `AccountsSection` + `BankConnectionsSection`. (Patrimoine view stays NON-configurable — it is not the widget grid; it reuses the data sections only.)
  Run: `bun --filter=@pekulo/web run typecheck && bun --filter=@pekulo/web test src/app/\(cap\)/dashboard/_components` 
  Expected: exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_components/patrimoine-view.tsx" && git commit -m "feat(#39): Patrimoine view uses real Composition + Activity (D2)"`

- [x] **T24 — Remove dead placeholder variants** [AC: AC-7]
  In `apps/web/src/app/(cap)/dashboard/_components/placeholder-card.tsx` (Step-0): remove the `hero`, `composition`, and `activity` variants + their helper functions (`HeroPlaceholder`, `ListPlaceholder` if now unused) — keep `trajectory` and `hypothesis` (still owned by deferred stories). Update the `PlaceholderVariant` union + `VARIANT_TITLES`. Remove the now-unused `FlatListPlaceholder` from `cap-view.tsx`/`patrimoine-view.tsx` (handled in T22/T23). Run a repo grep to confirm no remaining import of the deleted variants.
  Run: `bun --filter=@pekulo/web run typecheck && bun --filter=@pekulo/web run lint`
  Expected: exit 0, no unused-export / no-undef errors.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_components/placeholder-card.tsx" && git commit -m "refactor(#39): drop shipped placeholder variants"`

**Phase E — Verify + doc-sync**

- [x] **T25 — a11y (axe) on the new surfaces** [AC: AC-7, AC-5]
  Add `*.a11y.test.tsx` (axe, mirror `milestones-section.a11y.test.tsx`) for `CompositionSection`, `RecentActivitySection`, `HeroAnchor`, and the edit layer (drag handles labelled, checkboxes labelled, reorder reachable by keyboard). Zero violations.
  Run: `bun --filter=@pekulo/web test --testNamePattern a11y src/app/\(cap\)/dashboard`
  Expected: `Tests: <n> passed`, 0 axe violations, exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard" && git commit -m "test(#39): a11y for dashboard widgets + edit mode"`

- [x] **T26 — Visual GREEN (react-grab) + AC-3 Lighthouse** [AC: AC-1, AC-3]
  Start the web app, open `/dashboard`, and capture `mcp__react-grab-mcp__get_element_context` on the Cap view first viewport (verify wealth → % → next-milestone order on the default layout — AC-1) and on "Personnaliser" mode (drag handles + toggles present). Run the Lighthouse CI step on `/dashboard` (the project's `lighthouse` gate — check `package.json` scripts / `.github/workflows`) and confirm Performance ≥ 90 (AC-3); confirm the network panel shows NO `@dnd-kit` chunk on the default load (only after entering edit mode).
  Run: `bun --filter=@pekulo/web run lighthouse -- --url=/dashboard` (or the project's actual Lighthouse command — verify in Step-0).
  Expected: Performance ≥ 0.90; dnd-kit chunk absent from the default-load waterfall.
  Commit: (no code — record the Lighthouse number + react-grab confirmation in the Dev Agent Record Completion Notes.)

- [x] **T27 — Full typecheck + test sweep across touched packages** [AC: all]
  ```bash
  bun --filter=@pekulo/validators run typecheck && bun --filter=@pekulo/contracts run typecheck \
    && bun --filter=@pekulo/api run typecheck && bun --filter=@pekulo/web run typecheck \
    && bun --filter=@pekulo/api test src/modules/dashboard \
    && bun --filter=@pekulo/web test src/app/\(cap\)/dashboard
  ```
  Expected: every command exit 0.
  Commit: (none — gate only; fix-forward if red.)

- [x] **T28 — Doc-sync (lesson 2026-05-31 — paid in this change)** [AC: all]
  Because this story superseded the epics.md 7-2 scope and re-touched the done 7-1 aggregator, update every artefact so none contradicts the code:
  1. `docs/epics.md` — under "Story 7-2-dashboard-cap-page", **append** a "Realized scope (2026-06-04)" note (do NOT delete the original): configurable widgets + server layout persistence + recentActivity DTO extension; AC set now AC-1..AC-9.
  2. `docs/adr/0017-configurable-dashboard-widgets.md` — **new ADR**: decision = configurable widgets; dnd-kit (lazy, web-only); server-side `dashboard_layout` table; FR-41 honoured on default layout only (U1 tradeoff). Context / Decision / Consequences. Register it in `docs/state.yaml` `architecture.adrs` (next id ADR-0017).
  3. `docs/architecture.md` — refresh the dashboard driver line(s) to mention the layout table + recentActivity; cite ADR-0017.
  4. `docs/epics-context/epic-7-context.md` — re-run is owned by aped-story; note in the story that the cache must be refreshed (the "Previous stories — outcomes" 7-2 entry is appended by aped-review at done).
  5. Ticket **#39** — `gh issue edit 39 --body-file -` with the re-spec'd AC-1..AC-9 + scope-expansion note (or a clarifying comment).
  6. `docs/lessons.md` — add a lesson: "a story-time scope expansion into a new subsystem (here: configurable dashboard widgets + a new table) should be split into sibling stories; absorbing it into one XL story trades reviewability for momentum — record the override and the doc-sync (Scope: aped-story, aped-dev, aped-review)."
  Run: `bash .aped/scripts/validate-epic-context.sh docs/epics-context/epic-7-context.md` (WARN-only) and the placeholder lint.
  Expected: no placeholder-lint failures; ADR-0017 present.
  Commit: `git add docs/ && git commit -m "docs(#39): scope-expansion doc-sync — ADR-0017, epics, architecture, lesson"`

---

## Dev Notes

- **Architecture:**
  - Module pattern (ADR-0009): `apps/api/src/modules/dashboard/*` — overview stays pure composition (no Prisma); the new **layout** concern owns the single `dashboard_layout` table via `dashboard-layout.repository.ts` + `dashboard-layout.service.ts`, mounted on the SAME `/rpc/v1/dashboard` router. Router type inferred (`ReturnType<typeof createDashboardRouter>`), never annotated `Elysia` (lesson 2026-05-04).
  - Component → Hook → Action boundary (ADR-0010): widgets/sections never import an action directly — they go through `use<Feature><Resource>` hooks (`useDashboardOverview`, `useDashboardLayout`). Mutations declare `invalidateWithTags` via the registry, never a manual `queryClient.invalidateQueries` (R4, lesson 2026-05-25).
  - Cache invalidation is registry-SSOT (`apps/web/src/lib/zapaction/keys.ts`): the existing `transactionsTags.list()` edge already invalidates `dashboardKeys.overview()`, so a new transaction refreshes both the Récentes list AND the dashboard recentActivity for free (FR-44). The new `dashboardLayoutTags.current()` edge invalidates only `dashboardLayoutKeys.layout()`.
  - Prisma: per-user table, `@@map`/`@map` snake_case, RLS appended to the migration SQL manually (ADR-0013), explicit `where: { userId }` on every query (lint `pekulo/no-prisma-query-without-user-id`). Decimal→number via `decimalToNumber` if any numeric column is added (none here — `widgets` is JSONB).
  - **AGENTS.md (apps/web):** "This is NOT the Next.js you know." Before writing route/dynamic-import/RSC code, read the relevant guide under `apps/web/node_modules/next/dist/docs/`. `dynamic(() => import(...), { ssr: false })` is the dnd-kit lazy boundary (AC-3).
  - FR-41 reconciliation (D1): the default registry order is the FR-41 trio first; AC-1 asserts on the default layout. Custom layouts may reorder/hide — U1 tradeoff captured in ADR-0017.
  - **react-native-css/Tamagui v5 media:** `$lg` = 1024 px (lesson 2026-05-17). The bento module already pivots at 1024 — reuse it; do not introduce a second breakpoint.

- **Files:** see File List below. New: 1 prisma model, 3 validator blocks, 1 contract edit, 2 api layer files (layout repo+service), 5 web `_widgets/*`, 3 web `_components/*` sections + hero, 2 web `_lib/*` helpers, 1 web edit-context, 2 web layout action/hook, + tests. Modified: dashboard service/routes/module, runtime-dependencies, transactions.service, keys.ts, cap-view, cap-shell, patrimoine-view, placeholder-card, transactions-recent-section, transactions-suggestions-section, contract, overview schema, epics/architecture/adr/lessons.

- **Testing:** Vitest via `bun --filter=@pekulo/<pkg> test <path>` (folder paths under `(cap)` must be shell-escaped: `src/app/\(cap\)/...`). Pure helpers (`to-activity`, `select-next-milestone`, `layout`) are plain unit tests. Components use the project `renderWithTamagui` harness (see `milestones-section.a11y.test.tsx`). axe a11y per surface. Service tests stub `DashboardPorts`. AC-3 Lighthouse is the CI gate, not a unit test. **`tsc` is NOT the commit gate** — `bun --filter run typecheck` + `bun test` before each commit; after any Prisma change `prisma:generate && typecheck` is inseparable (lesson 2026-06-01).

- **Dependencies:** `@dnd-kit/core@6.3.1` + `@dnd-kit/sortable@10.0.0` (+ `@dnd-kit/utilities`) — **web-only, lazy in edit mode only** (D5; verify the version pair via `npm view`, lesson 2026-06; verify the API via Context7 before T20). New Prisma migration `dashboard_layout`. DS components already exist (`PekuloCountUpEUR`, `PekuloCompositionRow`, `PekuloActivityRow`, `PekuloDonut`, `Section`) — no DS work.

- **Commit prefix:** `feat(#39): ...` / `refactor(#39): ...` / `test(#39): ...` / `docs(#39): ...` / `chore(#39): ...`. PR: `gh pr create --base main --title "feat(#39): Story 7-2 — Cap page + configurable dashboard widgets" --body "Closes #39"`.

### Existing code at write time (Step-0 quotes — verbatim, do not paraphrase)

`packages/validators/src/dashboard/dashboard.schemas.ts:10-39` (current `dashboardOverviewSchema` — T8 appends `recentActivity`, T2 appends the layout schemas):
```ts
export const dashboardCompositionSchema = z.object({
  liquideEur: z.number(),
  placementsEur: z.number(),
  immobilierEur: z.number(),
});
export type DashboardComposition = z.infer<typeof dashboardCompositionSchema>;

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
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "asOf must be YYYY-MM-DD").nullable(),
  }),
});
export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;
```

`packages/contracts/src/dashboard/dashboard.contract.ts` (current — T3 replaces): `getOverview: oc.output(dashboardOverviewSchema)` only, plus `dashboardContractMeta { moduleKey:"dashboard", mountPath:"/rpc/v1/dashboard", version:"v1" }`.

`apps/api/src/modules/dashboard/dashboard.service.ts:41-49` (current `DashboardPorts` — T9 adds `listRecentActivity`):
```ts
export interface DashboardPorts {
  listAccounts: (userId: string) => Promise<Account[]>;
  listHoldings: (userId: string) => Promise<Holding[]>;
  resolveQuote: (input: PriceQuoteInput) => Promise<PriceQuote>;
  getRates: (base: HoldingCurrency) => Promise<FxRates>;
  getTotalEquity: (userId: string) => Promise<{ totalEquityEur: number }>;
  getCompass: (userId: string) => Promise<{ objectif: number } | null>;
  computeProgress: (input: ComputeProgressInput) => ComputeProgressOutput;
}
```
`getOverview` (current) returns `{ totalWealthEur, composition{liquideEur:snapshot.kpi.cash, placementsEur:snapshot.kpi.marketValue, immobilierEur:equity.totalEquityEur}, compass, fx }` — T9 adds `recentActivity` to the `Promise.all` and the return.

`apps/api/src/modules/dashboard/dashboard.routes.ts` (current — T6 replaces): single `getOverview` handler with `if (!context.userId?.trim()) throw new PekuloError("UNAUTHORIZED", ...)`.

`apps/api/src/modules/dashboard/dashboard.module.ts` (current — T7 replaces): `createDashboardModule(deps: DashboardPorts)` → `createDashboardService(deps)` + `createDashboardRouter({ service })`; returns `{ service, router }`. **Note:** today it returns `service`; T7 changes the signature to add `prismaService` and returns `{ router }`.

`apps/api/src/bootstrap/runtime-dependencies.ts:257-265` (current `createDashboardModule({...})` call — T7 adds `prismaService` + `listRecentActivity`):
```ts
  const dashboardModule = createDashboardModule({
    listAccounts: (userId) => accountsModule.service.list(userId),
    listHoldings: (userId) => holdingsModule.service.list(userId, { includeClosed: false }),
    resolveQuote: (input) => holdingsModule.service.resolveQuote(input),
    getRates: (base) => holdingsModule.frankfurterClient.getRates(base),
    getTotalEquity: (userId) => realestateModule.service.getTotalEquity(userId),
    getCompass: (userId) => compassModule.service.getCompass(userId),
    computeProgress: (input) => compassModule.service.computeProgress(input),
  });
```
The `orpcRouter.dashboard = dashboardModule.router` line (L274) is unchanged.

`apps/web/src/app/(cap)/dashboard/_components/cap-view.tsx` (current — T22 replaces the render body): mobile = hand-built `MobileFlatCapView` (Hero off `useDashboardCompass().progress.data.currentWealth`, MiniKpis, Trajectoire placeholder "7-1", MilestonesSection, Hypothèse "6-x", Composition `FlatListPlaceholder "5-x"`, Activité `FlatListPlaceholder "5-x"`); desktop = `styles.bento` with `PlaceholderCard variant="hero" ownerStory="7-1"`, `CompassSection`, `PlaceholderCard trajectory "7-1"`, `MilestonesSection`, `PlaceholderCard composition "5-x"`, `PlaceholderCard activity "5-x"`, `PlaceholderCard hypothesis "6-x"`. Wrapped in `AddMilestoneDialogProvider`.

`apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx` (current — T21 adds the "Personnaliser" button + edit provider): client shell with `PekuloNavRail` + header (date / top-tab toggle / "Nouvelle transaction" pill / `PekuloUserDot`) + `<main>{children}</main>` + `PekuloMobileBottomNav` + the create-transaction `PekuloDialog`. `isDashboardRoot = pathname === "/dashboard"`; `activeTab` from `?tab`.

`apps/web/src/app/(cap)/dashboard/_components/patrimoine-view.tsx` (current — T23 replaces the two placeholders): hero (total = sum of account cashBalances), `AccountsSection`, `BankConnectionsSection`, Composition `FlatListPlaceholder rows={3} ownerStory="3-x / 4-x"`, Activité `FlatListPlaceholder rows={5} ownerStory="5-x"`.

`apps/web/src/app/(cap)/dashboard/_components/placeholder-card.tsx` (current — T24 removes hero/composition/activity variants): `PlaceholderVariant = "hero"|"trajectory"|"composition"|"activity"|"hypothesis"`; `PlaceholderCard` wraps body in `Section`. Keep `trajectory` + `hypothesis`.

`apps/web/src/app/(cap)/dashboard/_hooks/use-dashboard-overview.ts` (current — unchanged; the schema it returns gains `recentActivity` via T8): `useActionQuery(getDashboardOverview, { input: undefined, queryKey: dashboardKeys.overview(), readPolicy: "read-only", staleTime: 30_000 })`.

`apps/web/src/app/(cap)/dashboard/_actions/dashboard-actions.ts` (current — mirror for T16's layout actions): `defineAction<void, DashboardOverview, ActionContext>({ name:"getDashboardOverview", input: z.void(), handler: async () => { await ensureRequestContext(); return dashboardClient.getOverview(); } })`.

`apps/web/src/lib/zapaction/keys.ts:146-156` (current `dashboardKeys` — T16 adds `dashboardLayoutKeys`/`dashboardLayoutTags` + a registry edge):
```ts
export const DASHBOARD_KEY = "dashboard" as const;
export const dashboardKeys = createFeatureKeys(DASHBOARD_KEY, {
  overview: () => ["overview"] as const,
});
```

`apps/web/.../transactions/_components/transactions-recent-section.tsx:229-235` (current inline mapping — T11 replaces with `txToActivity`):
```ts
const activity: Activity = {
  label: tx.label,
  account: accountLabelById.get(tx.accountId) ?? "—",
  category: TRANSACTION_CATEGORY_LABELS[tx.category],
  direction: tx.type === "inflow" ? "in" : "out",
  amountEur: tx.amount,
};
```

`packages/validators/src/milestones/milestones.schemas.ts:91-106` (current — T12 consumes `MilestoneStatusEntry`):
```ts
export const milestoneStatusEntrySchema = z.object({
  id: milestoneIdSchema,
  status: milestoneStatusSchema, // "ahead" | "on-track" | "behind"
  expectedAt: z.number(),
  delta: z.number(), // > 0 = behind (amount still to reach), <= 0 = ahead/on-track
});
export type MilestoneStatusEntry = z.infer<typeof milestoneStatusEntrySchema>;
export const getStatusesOutputSchema = z.array(milestoneStatusEntrySchema);
```

DS contracts (already shipped, consumed as-is): `PekuloCompositionRow({ label, amount, pct, sub? })`, `PekuloCountUpEUR({ value, precise?, durationMs? })`, `PekuloActivityRow({ tx: Activity, categoryPrefix?, logo?, aiApplied? })`, `PekuloRecentActivityCard({ activities, title?, ariaLabel? })`, `Section({ title?, ariaLabel?, action?, flat?, children })`. `Activity = { label, account, category, direction:"in"|"out", amountEur, logoUrl? }` from `@pekulo/types`.

### File decision template (per file — single responsibility)

- `apps/api/prisma/schema/dashboard.prisma` — the `dashboard_layout` table (one row/user, JSONB widgets). In: none · Out: `DashboardLayout` model.
- `apps/api/src/modules/dashboard/dashboard-layout.repository.ts` — Prisma find/upsert for the layout row. In: `ExtendedPrismaClient` · Out: `DashboardLayoutRepository`.
- `apps/api/src/modules/dashboard/dashboard-layout.service.ts` — validate-on-read/write trust boundary. In: repository · Out: `DashboardLayoutService`.
- `apps/web/.../_widgets/widget-registry.tsx` — SSOT widget set + default order + render fns. In: section components · Out: `WIDGET_REGISTRY`.
- `apps/web/.../_widgets/layout.ts` — pure merge of saved layout ↔ registry defaults (AC-6). In: `DashboardLayout|null` · Out: `ResolvedWidget[]` / `defaultLayout()`.
- `apps/web/.../_widgets/widget-grid.tsx` — render visible widgets in order; lazy edit boundary. In: `ResolvedWidget[]`, `editing` · Out: grid JSX.
- `apps/web/.../_widgets/edit/widget-edit-layer.tsx` — the ONLY dnd-kit importer: sortable + toggles + save/reset/done. In: `ResolvedWidget[]` + `useDashboardLayout` · Out: edit JSX.
- `apps/web/.../_components/{hero-anchor,composition-section,recent-activity-section}.tsx` — one widget surface each, wired to its hook. 
- `apps/web/.../_lib/{to-activity,select-next-milestone}.ts` — one pure mapping/selection each.
- `apps/web/.../_hooks/use-dashboard-layout.ts` + `_actions/dashboard-layout-actions.ts` — read+save layout through the hook/action boundary.
- `apps/web/.../_components/dashboard-edit-context.tsx` — shell↔CapView editing flag.

## File List

**Created:**
- `apps/api/prisma/schema/dashboard.prisma`
- `apps/api/prisma/migrations/<ts>_dashboard_layout/migration.sql`
- `apps/api/src/modules/dashboard/dashboard-layout.repository.ts`
- `apps/api/src/modules/dashboard/dashboard-layout.service.ts`
- `apps/api/src/modules/dashboard/dashboard-layout.service.test.ts`
- `apps/web/src/app/(cap)/dashboard/_lib/to-activity.ts` (+ `.test.ts`)
- `apps/web/src/app/(cap)/dashboard/_lib/select-next-milestone.ts` (+ `.test.ts`)
- `apps/web/src/app/(cap)/dashboard/_components/composition-section.tsx` (+ `.test.tsx`, `.a11y.test.tsx`)
- `apps/web/src/app/(cap)/dashboard/_components/recent-activity-section.tsx` (+ `.test.tsx`, `.a11y.test.tsx`)
- `apps/web/src/app/(cap)/dashboard/_components/hero-anchor.tsx` (+ `.test.tsx`, `.a11y.test.tsx`)
- `apps/web/src/app/(cap)/dashboard/_components/dashboard-edit-context.tsx`
- `apps/web/src/app/(cap)/dashboard/_actions/dashboard-layout-actions.ts`
- `apps/web/src/app/(cap)/dashboard/_hooks/use-dashboard-layout.ts`
- `apps/web/src/app/(cap)/dashboard/_widgets/widget-registry.tsx`
- `apps/web/src/app/(cap)/dashboard/_widgets/layout.ts` (+ `.test.ts`)
- `apps/web/src/app/(cap)/dashboard/_widgets/widget-grid.tsx` (+ `.test.tsx`)
- `apps/web/src/app/(cap)/dashboard/_widgets/edit/widget-edit-layer.tsx` (+ `.test.tsx`, `.a11y.test.tsx`)
- `docs/adr/0017-configurable-dashboard-widgets.md`

**Modified:**
- `packages/validators/src/dashboard/dashboard.schemas.ts` (layout schemas + `recentActivity`)
- `packages/contracts/src/dashboard/dashboard.contract.ts` (getLayout/saveLayout)
- `apps/api/src/modules/dashboard/dashboard.service.ts` (+ `listRecentActivity` port + compose)
- `apps/api/src/modules/dashboard/dashboard.routes.ts` (layout handlers)
- `apps/api/src/modules/dashboard/dashboard.module.ts` (layout repo/service wiring)
- `apps/api/src/modules/dashboard/dashboard.service.test.ts`
- `apps/api/src/modules/transactions/transactions.service.ts` (`listRecentActivity`)
- `apps/api/src/bootstrap/runtime-dependencies.ts` (prismaService + recentActivity port)
- `apps/web/src/lib/zapaction/keys.ts` (`dashboardLayoutKeys`/`Tags` + edge)
- `apps/web/src/app/(cap)/dashboard/_components/cap-view.tsx`
- `apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx`
- `apps/web/src/app/(cap)/dashboard/_components/patrimoine-view.tsx`
- `apps/web/src/app/(cap)/dashboard/_components/placeholder-card.tsx`
- `apps/web/src/app/(cap)/dashboard/page.test.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.tsx`
- `apps/web/package.json` (@dnd-kit deps)
- `docs/epics.md`, `docs/architecture.md`, `docs/epics-context/epic-7-context.md`, `docs/state.yaml` (ADR-0017 registration), `docs/lessons.md`

## Extension — drag-resize widgets (post-review, 2026-06-05)

After 7-2 reached `review`, the user asked for **direct widget resizing on the grid** (width + height). Kept inside 7-2 (user override); the doc-debt is paid here (reaffirms the 2026-06-05 "split scope expansions, or pay the doc-debt same-change" lesson). ADR-0017 Consequences updated.

**Realized:**

- `DashboardWidget` schema gains optional `colSpan` (1–12) + `rowSpan` (1–4); absent → the registry default. Backward-compatible with stored layouts (flows through contracts + the api validator untouched).
- The widget registry carries a `rowSpan` default per widget; `resolveLayout` honours stored sizes; `WidgetGrid` renders inline `grid-column`/`grid-row` spans on a generic `.bentoCell` fill class (replaces the fixed named card classes).
- The edit mode is now the **bento grid itself**: each cell has a drag handle (dnd-kit `rectSortingStrategy` reorder), a visibility switch, and a bottom-right resize handle that snaps the col/row span to the grid units (`snapSpan`, pure helper). Reorder/toggle commit one save; resize updates live + persists on pointer-up.
- Persistence flows through the existing `saveLayout` path (spans stored in the JSONB `widgets`); `reset` restores the defaults.

**Limitation:** resize is pointer-driven; keyboard resize is a follow-up (reorder + visibility are keyboard-reachable). The dnd/resize pointer interaction is verified live (jsdom can't measure the grid); `snapSpan` + `serializeLayout` + the size round-trip are unit-tested.

**Ops fixes found in live testing (both runtime 500s, both because the unit tests stubbed the DB):** the `dashboard_layout` migration was applied via `migrate deploy` (deferred at T1 → `getLayout` 500'd on the missing table); `DashboardLayout` was registered in `id-prefixes.config.ts` as a `null` opt-out (`user_id` PK, no synthetic id → the prefixed-ids extension threw on the `saveLayout` upsert create → 500). Lesson 2026-06-05 (prefixed-ids registration) records the class.

## Dev Agent Record

- **Model:** claude-opus-4-8[1m]
- **Started:** 2026-06-04T17:20:23Z
- **Completed:** 2026-06-05T09:04:29Z

### Summary

Shipped the configurable Cap dashboard end-to-end across all 28 tasks (5 phases): per-user `dashboard_layout` table + RLS + oRPC getLayout/saveLayout (D6); `recentActivity` in the 7-1 overview DTO via a new transactions `listRecentActivity` port (D3); the shared real-data widgets (HeroAnchor / CompositionSection / RecentActivitySection) + the `txToActivity` DRY refactor (D4) + `selectNextMilestone` (FR-41); the configurable widget system — registry + AC-6 merge, read grid, dnd-kit lazy edit layer, "Personnaliser" toggle + edit context (D1/D5); Patrimoine wired onto the shared sections (D2); placeholder cleanup; axe a11y on every new surface; and the scope-expansion doc-sync (ADR-0017, epics realized-scope note, lesson). Every task ran its own RED→GREEN→commit with a witnessed RED on each behavioural test. Final sweep green: validators/contracts/api/web typecheck exit 0; api dashboard 19 pass; web dashboard 176 pass (82 files). The page renders real data (verified against the user's live screenshots since react-grab MCP was offline).

### Files changed

See the **File List** above — all created/modified files landed. Net adds vs the plan: a narrow `accountLister` port on the transactions service/module (T9, server-side account-label resolution); a `DashboardEditProvider`/`useDashboardEdit` no-op-safe context (T21); the four `*.a11y.test.tsx` (T25); ADR-0017 + the epics/state/lessons doc-sync (T28).

### Deviations

- **T1 — migration hand-authored.** `migrate dev` hangs on the shared Supabase transaction pooler (documented in `prisma.config.ts`), and mutating a shared remote DB from an automated run is out of scope. So the schema landed via `prisma generate` (client now has `DashboardLayout`) + a hand-authored `migration.sql` mirroring `compass_history` (RLS appended manually). Apply via `migrate deploy` as an ops step. Scripts are `prisma:migrate:dev` / `prisma:migrate:deploy` (not `prisma:migrate`).
- **T5 / T9+T10 — TDD-honest reorders.** The layout service test was pulled forward from T10 to T5 (test-first on the parse-on-read/corrupt→null logic). T9 (compose) and T10 (tests) were committed together because the dashboard service-test `basePorts` must gain the `listRecentActivity` port atomically with the compose change — the story's split is not green-able apart.
- **T9 — `listRecentActivity` not verbatim.** The transactions service had no recent-activity read and resolved account labels client-side. Added a narrow OPTIONAL `accountLister` port (L1, mirrors `logos`) so the service shapes `DashboardActivity` server-side (label resolved, direction/amount/logo mapped); absent port → account `"—"`. Covered by a new transactions-service test.
- **T2/T8/T11/T14 — import corrections.** `txDirectionSchema` does not exist → a local `z.enum(["in","out"])` (`activityDirectionSchema`) mirrors `@pekulo/types#TxDirection`. `TRANSACTION_CATEGORY_LABELS` is in `@pekulo/validators` (not `@pekulo/types` as the drafts assumed). `CategoryIcon` / `TransactionLogo` import from `@pekulo/ui`. The suggestions-section was left inline (its `Suggestion` shape diverges from `Activity` — story escape hatch).
- **T15 — `useMilestoneStatuses` exists.** (The recon agent was wrong.) `compassObjectif`/`compassHorizonYears` are `number | undefined` on the cap state → guarded before formatting.
- **T16 — hook shape.** `useDashboardLayout` exposes `{ widgets, save, reset }`; the editing flag lives in the T21 edit context (its real consumers). `reset` saves an empty layout that `resolveLayout` backfills to defaults (AC-5).
- **T17 — dep scope.** `bun add --filter=@pekulo/web` landed `@dnd-kit/*` in the ROOT package.json; corrected to `bun add --cwd apps/web` so the web-only dep is scoped to its only consumer. Versions verified via `npm view` (sortable@10 ↔ core@^6.3, core latest 6.3.1, utilities 3.2.2).
- **Phase D order — dependency-driven.** Executed T17 → T18 → **T21 → T20 → T19** → T22 → T23 → T24 (vs the story's T19→T20→T21): WidgetGrid's `dynamic(import(edit-layer))` and the edit layer's `useDashboardEdit` are forward deps that must exist before the importer typechecks.
- **T18 — `nextMilestone` folded.** Ships `defaultVisible: false` (the hero shows the next-milestone line); the default viewport is hero (wealth + delta) + compass (%). It stays a real opt-in widget.
- **T20 — dnd-kit API.** Used the classic `@dnd-kit/core` + `@dnd-kit/sortable` v6/v10 surface (`DndContext`/`SortableContext`/`useSortable`/`arrayMove`/sensors), verified via Context7 — the newer `@dnd-kit/react` `DragDropProvider` surface that Context7 surfaced first is a DIFFERENT package we don't ship. Reorder/serialize logic is pure + unit-tested; the sensor→onDragEnd seam is keyboard-accessible but its end-to-end drive is verified visually (jsdom can't run dnd-kit's coordinate sensors).
- **Post-rewire visual/correctness fixes** (`88031e9`, `087168c`): the generic column-span grid lost the bento `grid-row` spans + cell-fill → WidgetGrid now maps each widget to its named bento card class; HeroAnchor card variant wraps in `Section` (card background) + flex/space-between fill; the "Personnaliser" toggle is gated behind a post-mount flag (the `searchParams`-derived visibility was causing an SSR/CSR hydration mismatch); the activity rows split `role="listitem"` (div) from the navigable `button` (axe `aria-allowed-role`). The hydration errors the user caught mid-session were hot-reload code skews, not stable-state regressions.
- **T26 — visual + Lighthouse.** react-grab MCP was offline all session → the per-GREEN visual check was deferred to review (Aria) and to the user's live screenshots, which confirmed the page renders real data + the bento layout after the fixes. Lighthouse Performance ≥ 90 (AC-3) is the `pr.yml` CI gate (no local script); the dnd-kit bundle-isolation half of AC-3 is structurally proven — `@dnd-kit/*` is imported ONLY in `widget-edit-layer.tsx` behind `dynamic(ssr:false)`, asserted by `widget-grid.test`.
- **T28 — two doc-sync items deferred.** (1) The `docs/architecture.md` driver-line refresh is **blocked by the upstream-doc write guard** while the story is in-progress (same as 7-1's T11) → deferred to aped-review; the exact edit is queued below. (2) The ticket #39 AC-1..AC-9 re-spec is outward-facing → deferred to review/ship (or to a user-confirmed `gh issue edit`). The epic-7 context cache recompile is owned by aped-story.

**Queued `docs/architecture.md` edit (apply in review):** in the FR-44 "Cache invalidation graph" bullet, replace the trailing sentence _"The module owns no tables/repository — pure composition over accounts / holdings / realestate / compass ports."_ with a note that the OVERVIEW half stays pure composition but its DTO gained `recentActivity` (7-2 D3), and that 7-2 added the dashboard's first table `dashboard_layout` (one JSONB row/user, RLS-scoped) behind `dashboard.getLayout`/`saveLayout` powering the configurable widget grid (dnd-kit lazy behind `dynamic(ssr:false)`, out of the default bundle — NFR-3; FR-41 guaranteed on the default layout only; `dashboardLayoutTags.current()` invalidates only `dashboardLayoutKeys.layout()`) — cite **ADR-0017**.

### Test output

Final sweep (T27), verbatim:

```
validators typecheck: exit 0
contracts  typecheck: exit 0
api        typecheck: exit 0
web        typecheck: exit 0
api  test src/modules/dashboard: 19 pass / 0 fail (4 files)
web  test src/app/(cap)/dashboard: 176 passed (82 files)
web  lint: 0 errors, 2 warnings (pre-existing array-index-key on the activity rows)
```

Per-AC coverage: AC-1/AC-6 → `_widgets/layout.test.ts`; AC-2 → `to-activity.test.ts` + `recent-activity-section.test.tsx` (press→push) + api `listRecentActivity`; AC-3 → `widget-grid.test.tsx` (edit layer absent on default path) + CI Lighthouse; AC-4/AC-5 → `dashboard-layout.service.test.ts` + `widget-edit-layer.test.tsx` (toggle/reset/reorder) + `dashboard-registry.test.ts` (layout edge); AC-6 → layout merge + service corrupt→null; AC-7 → component loading/empty tests + service `recentActivity` degrade-to-[]; AC-8 → `hero-anchor.test.tsx` (totalWealth ≠ compass currentWealth); AC-9 → `composition-section.test.tsx` (3 rows + %). a11y: `*.a11y.test.tsx` on Composition / RecentActivity / Hero / edit layer — 0 axe violations. AC-3 Lighthouse number: pending CI on the PR (not runnable locally).
