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
  list: () => ["list"] as const,
  byId: (id: string) => ["byId", id] as const,
});
export const transactionsTags = createFeatureTags(TRANSACTIONS_KEY, {
  list: () => ["list"] as const,
});

setTagRegistry({
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
  ],
  [compassTags.current()]: [
    compassKeys.current(),
    compassKeys.setup(),
    compassKeys.progress(),
    compassKeys.curve(),
    compassKeys.history(),
    milestonesKeys.list(),
  ],
  // Milestones — `list` invalidates the milestones list + `compass.setup`
  // (the setup state is derived from "compass row exists AND ≥1 milestone",
  // so adding/removing a milestone flips it). Without this, the dashboard
  // stays on the setup CTA for staleTime (30s) after the first milestone
  // is added, defeating the inline AddMilestoneForm round-trip.
  [milestonesTags.all()]: [milestonesKeys.list(), compassKeys.setup()],
  [milestonesTags.list()]: [milestonesKeys.list(), compassKeys.setup()],
  [accountsTags.all()]: [accountsKeys.list()],
  [accountsTags.list()]: [accountsKeys.list()],
  // Holdings — `list` invalidates the holdings list. Once the portfolio
  // aggregate ships its own read path, the cross-feature edge to
  // portfolioKeys.holdings + portfolioKeys.snapshot lands back here.
  [holdingsTags.all()]: [holdingsKeys.list()],
  [holdingsTags.list()]: [holdingsKeys.list()],
  // Realestate (story 4-1 + 4-2 + 4-3) — the `list` tag invalidates the
  // entire realestate read graph via the bare `[REALESTATE_KEY]` prefix.
  // TanStack's `invalidateQueries({queryKey:["realestate"]})` is inclusive
  // prefix-match, so this single edge covers `realestateKeys.list()`,
  // `byId(id)` AND `valuations(id)` in one shot — the 4-3 UI hooks
  // (useProperties / useListPropertyDerives / useProperty /
  // useListValuations) all subscribe to keys under the `realestate`
  // prefix. Surgical edges are not required at V1 scale (NFR-16: 50
  // properties / user). 7-1 dashboard will add a dedicated
  // `realestateTags.list → dashboardKeys.cap` edge when it ships.
  //
  // 2026-05-22 aped-review fix — earlier shape mapped to
  // `realestateKeys.list()` only, which silently missed `byId` and
  // `valuations`; the 9 mutation hooks compensated with manual
  // `queryClient.invalidateQueries({queryKey:[REALESTATE_KEY]})` calls
  // that violated R3/R4 + lesson 2026-05-20 ("hooks consume zapaction,
  // never raw @tanstack/react-query"). Fixing the registry restores
  // the SSOT.
  [realestateTags.all()]: [[REALESTATE_KEY]],
  [realestateTags.list()]: [[REALESTATE_KEY]],
  // Transactions (story 5-1) — `list` invalidates the entire transactions
  // read graph via the bare `[TRANSACTIONS_KEY]` prefix (matches realestate
  // pattern at L130) AND `accountsKeys.list()` since a recorded transaction
  // affects the cash-balance display on the Patrimoine tab. Stories 5-3 / 5-4
  // / 6-2 / 7-1 will append their own invalidation edges.
  [transactionsTags.all()]: [[TRANSACTIONS_KEY], accountsKeys.list()],
  [transactionsTags.list()]: [[TRANSACTIONS_KEY], accountsKeys.list()],
});
