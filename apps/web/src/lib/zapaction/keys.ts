import { createFeatureKeys, createFeatureTags } from "@zapaction/core";
import { setTagRegistry } from "@zapaction/query";

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

export const monthlyKeys = createFeatureKeys("monthly", {
  list: () => ["list"] as const,
  byYear: (year: number) => ["year", year] as const,
});
export const monthlyTags = createFeatureTags("monthly", {
  list: () => ["list"] as const,
});

export const transactionsKeys = createFeatureKeys("transactions", {
  list: () => ["list"] as const,
});
export const transactionsTags = createFeatureTags("transactions", {
  list: () => ["list"] as const,
});

export const portfolioKeys = createFeatureKeys("portfolio", {
  accounts: () => ["accounts"] as const,
  holdings: () => ["holdings"] as const,
  snapshot: () => ["snapshot"] as const,
});
export const portfolioTags = createFeatureTags("portfolio", {
  accounts: () => ["accounts"] as const,
  holdings: () => ["holdings"] as const,
  snapshot: () => ["snapshot"] as const,
});

export const lotsKeys = createFeatureKeys("lots", {
  byHolding: (holdingId: string) => ["holding", holdingId] as const,
});
export const lotsTags = createFeatureTags("lots", {
  byHolding: (holdingId: string) => ["holding", holdingId] as const,
});

export const accountsKeys = createFeatureKeys("accounts", {
  list: () => ["list"] as const,
});
export const accountsTags = createFeatureTags("accounts", {
  list: () => ["list"] as const,
});

// Story 3-1 forward-pointer — standalone holdings feature key set + tag
// registry. Stories 3-2 / 3-3 / 3-4 declare their invalidation edges against
// `holdingsTags.list()` so the cache graph stays decoupled from
// `portfolioTags` (the portfolio aggregate carries cross-feature edges).
export const HOLDINGS_KEY = "holdings" as const;
export const holdingsKeys = createFeatureKeys(HOLDINGS_KEY, {
  list: () => ["list"] as const,
  byId: (id: string) => ["byId", id] as const,
  derived: (id: string) => ["derived", id] as const,
});
export const holdingsTags = createFeatureTags(HOLDINGS_KEY, {
  list: () => ["list"] as const,
});

setTagRegistry({
  [hypothesesTags.all()]: [hypothesesKeys.current()],
  [hypothesesTags.current()]: [hypothesesKeys.current()],
  // Compass — `current` invalidates every read of the compass aggregate
  // AND the milestones list (status badges depend on objectif).
  [compassTags.all()]: [
    compassKeys.current(),
    compassKeys.setup(),
    compassKeys.progress(),
    compassKeys.curve(),
    compassKeys.history(),
  ],
  [compassTags.current()]: [
    compassKeys.current(),
    compassKeys.setup(),
    compassKeys.progress(),
    compassKeys.curve(),
    compassKeys.history(),
  ],
  // Milestones — `list` invalidates the milestones list + `compass.setup`
  // (the setup state is derived from "compass row exists AND ≥1 milestone",
  // so adding/removing a milestone flips it). Without this, the dashboard
  // stays on the setup CTA for staleTime (30s) after the first milestone
  // is added, defeating the inline AddMilestoneForm round-trip.
  [milestonesTags.all()]: [milestonesKeys.list(), compassKeys.setup()],
  [milestonesTags.list()]: [milestonesKeys.list(), compassKeys.setup()],
  [monthlyTags.all()]: [monthlyKeys.list()],
  [monthlyTags.list()]: [monthlyKeys.list()],
  [transactionsTags.all()]: [transactionsKeys.list()],
  [transactionsTags.list()]: [transactionsKeys.list()],
  [portfolioTags.all()]: [
    portfolioKeys.accounts(),
    portfolioKeys.holdings(),
    portfolioKeys.snapshot(),
  ],
  [portfolioTags.accounts()]: [
    portfolioKeys.accounts(),
    portfolioKeys.snapshot(),
    accountsKeys.list(),
  ],
  [portfolioTags.holdings()]: [portfolioKeys.holdings(), portfolioKeys.snapshot()],
  [portfolioTags.snapshot()]: [portfolioKeys.snapshot()],
  [lotsTags.all()]: [],
  [accountsTags.all()]: [accountsKeys.list()],
  [accountsTags.list()]: [accountsKeys.list()],
  // Holdings — `list` invalidates the holdings list + the portfolio
  // aggregate's `holdings` slot (downstream stories 3-2/3-3/3-4 share the
  // snapshot read path). The cross-feature edge mirrors accountsTags →
  // portfolioKeys.accounts.
  [holdingsTags.all()]: [holdingsKeys.list(), portfolioKeys.holdings(), portfolioKeys.snapshot()],
  [holdingsTags.list()]: [holdingsKeys.list(), portfolioKeys.holdings(), portfolioKeys.snapshot()],
});
