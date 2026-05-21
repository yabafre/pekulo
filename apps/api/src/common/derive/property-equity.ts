// apps/api/src/common/derive/property-equity.ts
// Pure net property equity helper (story 4-2). FR-25.
//
// Inputs by argument only. No `prisma`, no `fetch`, no `Date.now()`, no
// `@opentelemetry/*` import (AC-8 grep guard).
//
// Returns `currentValuation − outstandingPrincipal`. Mortgage is optional —
// an unencumbered property surfaces full valuation. Underwater properties
// (debt > valuation) return a negative number; the caller decides whether
// to display it raw or clamp to zero (the dashboard total-wealth aggregator
// in story 7-1 will sum raw values).

export interface PropertyEquityInput {
  property: { currentValuation: number };
  mortgage: { outstandingPrincipal: number } | null;
}

export function computePropertyEquity(input: PropertyEquityInput): number {
  const debt = input.mortgage?.outstandingPrincipal ?? 0;
  return input.property.currentValuation - debt;
}
