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
  byId: (propertyId: string) => ["byId", propertyId] as const,
  valuations: (propertyId: string) => ["valuations", propertyId] as const,
});
export const realestateTags = createFeatureTags(REALESTATE_KEY, {
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
  // Realestate (story 4-1) — `list` invalidates the realestate aggregate.
  // Stories 4-2 (derives) / 4-3 (UI) / 7-1 (dashboard) add cross-feature
  // edges (e.g. realestateTags.list → dashboardKeys.cap) when they land;
  // the registry entry exists now because the realestate oRPC module is
  // mounted (T16) and consumers can subscribe immediately.
  [realestateTags.all()]: [realestateKeys.list()],
  [realestateTags.list()]: [realestateKeys.list()],
});
