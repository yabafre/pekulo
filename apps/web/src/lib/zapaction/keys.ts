import { createFeatureKeys, createFeatureTags } from "@zapaction/core";
import { setTagRegistry } from "@zapaction/query";

// Tag registry — only features whose hooks actually consume the keys live
// here. Forward-pointer features (monthly, transactions, portfolio aggregate,
// lots) were removed during the D3 audit pass: their api routes aren't
// mounted (see lib/orpc/modules.ts), no hook reads from them, and their
// setTagRegistry entries fired no-op invalidations. Each story that adds
// the corresponding read/write path re-introduces its keys + tags + registry
// edges here.

export const hypothesesKeys = createFeatureKeys("hypotheses", {
  current: () => ["current"] as const,
});
export const hypothesesTags = createFeatureTags("hypotheses", {
  current: () => ["current"] as const,
});

export const compassKeys = createFeatureKeys("compass", {
  current: () => ["current"] as const,
  setup: () => ["setup"] as const,
  progress: () => ["progress"] as const,
  curve: () => ["curve"] as const,
  history: (limit?: number) => ["history", limit ?? 50] as const,
});
export const compassTags = createFeatureTags("compass", {
  current: () => ["current"] as const,
});

export const milestonesKeys = createFeatureKeys("milestones", {
  list: () => ["list"] as const,
  statuses: (currentWealth: number) => ["statuses", currentWealth] as const,
});
export const milestonesTags = createFeatureTags("milestones", {
  list: () => ["list"] as const,
});

export const accountsKeys = createFeatureKeys("accounts", {
  list: () => ["list"] as const,
});
export const accountsTags = createFeatureTags("accounts", {
  list: () => ["list"] as const,
});

// Story 6-3 — third-party LLM opt-in (FR-34). Single `optIn` read; the toggle
// mutation invalidates it via the registry edge below. Story 6-5 (FR-36) adds
// `activityLog` — a read-only audit query with NO write path on the web tier
// (categorisation is server-side fire-and-forget), so it needs a key but NO
// tag and NO setTagRegistry edge: it refreshes on staleTime, never on a
// client mutation.
export const llmKeys = createFeatureKeys("llm", {
  optIn: () => ["optIn"] as const,
  aiNotice: () => ["aiNotice"] as const,
  activityLog: () => ["activityLog"] as const,
});
export const llmTags = createFeatureTags("llm", {
  optIn: () => ["optIn"] as const,
  aiNotice: () => ["aiNotice"] as const,
});

const HOLDINGS_KEY = "holdings" as const;
export const holdingsKeys = createFeatureKeys(HOLDINGS_KEY, {
  list: () => ["list"] as const,
  byId: (id: string) => ["byId", id] as const,
  derived: (id: string) => ["derived", id] as const,
});
export const holdingsTags = createFeatureTags(HOLDINGS_KEY, {
  list: () => ["list"] as const,
});

// Story 4-1 forward-pointer — realestate feature key set + tag registry.
// Stories 4-2 (derives) / 4-3 (UI) / 7-1 (dashboard) declare their
// invalidation edges against `realestateTags.list()` so the cache graph
// stays decoupled at the aggregate level.
export const REALESTATE_KEY = "realestate" as const;
export const realestateKeys = createFeatureKeys(REALESTATE_KEY, {
  list: () => ["list"] as const,
  // TODO(4-2/4-3): `byId` consumed by `useProperty(id)` in 4-3 ; `valuations`
  // consumed by the cap-history panel in 4-3. Until those stories land, the
  // factories are declared here so adding the consuming hooks doesn't require
  // touching this file again (review-supp L5 — keep forward-pointer scope
  // explicit so the audit doesn't flag them as dead code).
  byId: (propertyId: string) => ["byId", propertyId] as const,
  valuations: (propertyId: string) => ["valuations", propertyId] as const,
});
export const realestateTags = createFeatureTags(REALESTATE_KEY, {
  list: () => ["list"] as const,
});

// Story 5-1 — transactions feature key set + tag registry. The block was
// removed during the D3 audit pass; re-introduced now that the transactions
// oRPC module is mounted. Stories 5-3 (transfer rule), 5-4 (monthly agg),
// 6-2 (LLM categorise), 7-1 (dashboard) declare their invalidation edges
// against `transactionsTags.list()` without further touching this file.
export const TRANSACTIONS_KEY = "transactions" as const;
export const transactionsKeys = createFeatureKeys(TRANSACTIONS_KEY, {
  // `limit`, `month` AND `page` are part of the queryKey: the Récentes section
  // (10/page, month-scoped, numbered) and any unscoped caller must not collide.
  // month ?? "all" = the pre-6-9 unscoped window; page ?? 1 = cursor mode / first
  // page. Mirrors compassKeys.history(limit?).
  list: (limit?: number, month?: string, page?: number) =>
    ["list", limit ?? 50, month ?? "all", page ?? 1] as const,
  byId: (id: string) => ["byId", id] as const,
  // Story 6-4 — pending-suggestion list. `page` is part of the queryKey so the
  // numbered pages cache independently (same reason as `list(limit)`). No new
  // registry edge needed: the transactionsTags.list() edge invalidates the bare
  // [TRANSACTIONS_KEY] prefix, which covers every ["pending", n] entry (confirming
  // refreshes Suggestions IA + Récentes across all loaded pages).
  // Story 6-9 ext — `month` joins the key so per-month pending caches separately
  // (month ?? "all" = the unscoped backlog). Bare-prefix invalidation unchanged.
  pending: (page?: number, month?: string) => ["pending", page ?? 1, month ?? "all"] as const,
  // Story 6-9 (FR-64) — month-scoped stat-card aggregate. month undefined =
  // the server-resolved default (latest activity month); keyed "default" so it
  // caches separately from explicit months and refreshes when activity changes.
  monthSummary: (month?: string) => ["monthSummary", month ?? "default"] as const,
});
export const transactionsTags = createFeatureTags(TRANSACTIONS_KEY, {
  list: () => ["list"] as const,
});

// Story 5-4 — monthly aggregate (FR-37/38). `get(year, monthNum)` is the
// granular query key. The `get` tag invalidates that exact month; any
// transactions mutation bulk-invalidates every month via the bare prefix
// in the transactions edge below (AC-5).
export const MONTHLY_KEY = "monthly" as const;
export const monthlyKeys = createFeatureKeys(MONTHLY_KEY, {
  get: (year: number, monthNum: number) => ["get", year, monthNum] as const,
  list: (limit: number) => ["list", limit] as const,
});
export const monthlyTags = createFeatureTags(MONTHLY_KEY, {
  all: () => [] as const,
  get: (year: number, monthNum: number) => ["get", year, monthNum] as const,
});

// Story 5-6 — Bridge bank connections list (FR-60). Single read for now
// (listConnections), no byId; 5-7 may add a granular get when the settings UI
// surfaces per-connection details (status badge, lastRefreshedAt, etc.).
export const BANK_CONNECTIONS_KEY = "bankConnections" as const;
export const bankConnectionsKeys = createFeatureKeys(BANK_CONNECTIONS_KEY, {
  list: () => ["list"] as const,
});
export const bankConnectionsTags = createFeatureTags(BANK_CONNECTIONS_KEY, {
  list: () => ["list"] as const,
});

// Story 7-1 (FR-43/FR-44) — dashboard read-aggregator. Read-only feature: it
// has NO write path of its own, so it declares `dashboardKeys` but NO
// `dashboardTags`. `overview` is invalidated BY every wealth-affecting
// feature's list tag via the registry edges below — recording a transaction,
// editing an account / holding / property, or changing the compass objectif
// all refresh the Cap view total wealth. Consumed by useDashboardOverview
// (read-only).
export const DASHBOARD_KEY = "dashboard" as const;
export const dashboardKeys = createFeatureKeys(DASHBOARD_KEY, {
  overview: () => ["overview"] as const,
});

// Story 7-2 (D6) — the per-user widget layout. Unlike the read-only overview,
// the layout HAS a write path (saveLayout), so it declares both keys AND tags;
// saving the layout invalidates only its own read (the wealth overview is
// untouched by a reorder/visibility change).
export const dashboardLayoutKeys = createFeatureKeys(DASHBOARD_KEY, {
  layout: () => ["layout"] as const,
});
export const dashboardLayoutTags = createFeatureTags(DASHBOARD_KEY, {
  current: () => ["layout"] as const,
});

setTagRegistry({
  [dashboardLayoutTags.current()]: [dashboardLayoutKeys.layout()],
  [hypothesesTags.all()]: [hypothesesKeys.current()],
  [hypothesesTags.current()]: [hypothesesKeys.current()],
  // Compass — `current` invalidates every read of the compass aggregate
  // AND the milestones list (status badges + linear-plan derive depend on
  // the compass objectif / horizonYears ; a compass change ripples through
  // every status row). The edge was carried by manual onSuccess calls in
  // the pre-ZAP-1 hook ; codified here so the registry is the SSOT.
  [compassTags.all()]: [
    compassKeys.current(),
    compassKeys.setup(),
    compassKeys.progress(),
    compassKeys.curve(),
    compassKeys.history(),
    milestonesKeys.list(),
    dashboardKeys.overview(),
  ],
  [compassTags.current()]: [
    compassKeys.current(),
    compassKeys.setup(),
    compassKeys.progress(),
    compassKeys.curve(),
    compassKeys.history(),
    milestonesKeys.list(),
    dashboardKeys.overview(),
  ],
  // Milestones — `list` invalidates the milestones list + `compass.setup`
  // (the setup state is derived from "compass row exists AND ≥1 milestone",
  // so adding/removing a milestone flips it). Without this, the dashboard
  // stays on the setup CTA for staleTime (30s) after the first milestone
  // is added, defeating the inline AddMilestoneForm round-trip.
  [milestonesTags.all()]: [milestonesKeys.list(), compassKeys.setup()],
  [milestonesTags.list()]: [milestonesKeys.list(), compassKeys.setup()],
  [accountsTags.all()]: [accountsKeys.list(), dashboardKeys.overview()],
  [accountsTags.list()]: [accountsKeys.list(), dashboardKeys.overview()],
  // Story 6-3 — llm opt-in. The setLlmOptIn mutation invalidates the single
  // optIn read so the toggle state survives a reload.
  [llmTags.all()]: [llmKeys.optIn()],
  [llmTags.optIn()]: [llmKeys.optIn()],
  // Story 6-4 (DR-12) — markAiNotice invalidates the seen-state read.
  [llmTags.aiNotice()]: [llmKeys.aiNotice()],
  // Holdings — `list` invalidates the holdings list. Once the portfolio
  // aggregate ships its own read path, the cross-feature edge to
  // portfolioKeys.holdings + portfolioKeys.snapshot lands back here.
  [holdingsTags.all()]: [holdingsKeys.list(), dashboardKeys.overview()],
  [holdingsTags.list()]: [holdingsKeys.list(), dashboardKeys.overview()],
  // Realestate (story 4-1 + 4-2 + 4-3) — the `list` tag invalidates the
  // entire realestate read graph via the bare `[REALESTATE_KEY]` prefix.
  // TanStack's `invalidateQueries({queryKey:["realestate"]})` is inclusive
  // prefix-match, so this single edge covers `realestateKeys.list()`,
  // `byId(id)` AND `valuations(id)` in one shot — the 4-3 UI hooks
  // (useProperties / useListPropertyDerives / useProperty /
  // useListValuations) all subscribe to keys under the `realestate`
  // prefix. Surgical edges are not required at V1 scale (NFR-16: 50
  // properties / user). 7-1 dashboard shipped the
  // realestate/accounts/holdings/transactions/compass list →
  // `dashboardKeys.overview()` edges (read-only aggregate).
  //
  // 2026-05-22 aped-review fix — earlier shape mapped to
  // `realestateKeys.list()` only, which silently missed `byId` and
  // `valuations`; the 9 mutation hooks compensated with manual
  // `queryClient.invalidateQueries({queryKey:[REALESTATE_KEY]})` calls
  // that violated R3/R4 + lesson 2026-05-20 ("hooks consume zapaction,
  // never raw @tanstack/react-query"). Fixing the registry restores
  // the SSOT.
  [realestateTags.all()]: [[REALESTATE_KEY], dashboardKeys.overview()],
  [realestateTags.list()]: [[REALESTATE_KEY], dashboardKeys.overview()],
  // Transactions (story 5-1) — `list` invalidates the entire transactions
  // read graph via the bare `[TRANSACTIONS_KEY]` prefix (matches realestate
  // pattern at L130) AND `accountsKeys.list()` since a recorded transaction
  // affects the cash-balance display on the Patrimoine tab. Extended in 5-4
  // (AC-5) with `[MONTHLY_KEY]` so any transaction mutation re-derives the
  // monthly view — TanStack's prefix-match invalidates every monthly entry
  // under any (year, monthNum).
  [transactionsTags.all()]: [
    [TRANSACTIONS_KEY],
    accountsKeys.list(),
    [MONTHLY_KEY],
    dashboardKeys.overview(),
  ],
  [transactionsTags.list()]: [
    [TRANSACTIONS_KEY],
    accountsKeys.list(),
    [MONTHLY_KEY],
    dashboardKeys.overview(),
  ],
  // Monthly (story 5-4 + 5-5). The `get(0, 0)` stand-in carries the
  // structural shape; `all()` is the bulk edge that invalidates every
  // monthlyKeys.* slot via the bare `[MONTHLY_KEY]` prefix. Sign-off / reopen
  // mutations (5-5) pass `monthlyTags.all()` on their useActionMutation
  // invalidate option so both the per-month get cache AND the listMonthly
  // window cache refresh after the mutation resolves.
  [monthlyTags.all()]: [[MONTHLY_KEY]],
  [monthlyTags.get(0, 0)]: [monthlyKeys.get(0, 0)],
  // Story 5-6 — bank connections list. Successful completeConnection /
  // refreshConnection invalidates both the connections list AND the
  // transactions list (a Bridge import lands new transactions that should
  // surface in Récentes + cascade to monthly via the transactions edge).
  [bankConnectionsTags.list()]: [
    bankConnectionsKeys.list(),
    [TRANSACTIONS_KEY],
    accountsKeys.list(),
    [MONTHLY_KEY],
    dashboardKeys.overview(),
  ],
});
