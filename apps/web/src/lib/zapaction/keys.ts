import { createFeatureKeys, createFeatureTags } from "@zapaction/core"
import { setTagRegistry } from "@zapaction/query"

export const hypothesesKeys = createFeatureKeys("hypotheses", {
  current: () => ["current"] as const,
})

export const hypothesesTags = createFeatureTags("hypotheses", {
  current: () => ["current"] as const,
})

export const monthlyKeys = createFeatureKeys("monthly", {
  list: () => ["list"] as const,
  byYear: (year: number) => ["year", year] as const,
})

export const monthlyTags = createFeatureTags("monthly", {
  list: () => ["list"] as const,
})

export const transactionsKeys = createFeatureKeys("transactions", {
  list: () => ["list"] as const,
})

export const transactionsTags = createFeatureTags("transactions", {
  list: () => ["list"] as const,
})

export const portfolioKeys = createFeatureKeys("portfolio", {
  accounts: () => ["accounts"] as const,
  holdings: () => ["holdings"] as const,
  snapshot: () => ["snapshot"] as const,
})

export const portfolioTags = createFeatureTags("portfolio", {
  accounts: () => ["accounts"] as const,
  holdings: () => ["holdings"] as const,
  snapshot: () => ["snapshot"] as const,
})

export const lotsKeys = createFeatureKeys("lots", {
  byHolding: (holdingId: string) => ["holding", holdingId] as const,
})

export const lotsTags = createFeatureTags("lots", {
  byHolding: (holdingId: string) => ["holding", holdingId] as const,
})

setTagRegistry({
  [hypothesesTags.all()]: [hypothesesKeys.current()],
  [hypothesesTags.current()]: [hypothesesKeys.current()],
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
  ],
  [portfolioTags.holdings()]: [
    portfolioKeys.holdings(),
    portfolioKeys.snapshot(),
  ],
  [portfolioTags.snapshot()]: [portfolioKeys.snapshot()],
  // lots: invalidated by holdingId; we keep generic "all" for cross-cutting refresh too.
  [lotsTags.all()]: [],
})
