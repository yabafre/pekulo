// apps/api/src/common/derive/rental-cashflow.ts
// Pure monthly rental cash-flow helper (story 4-2). FR-24.
//
// Inputs by argument only. Zero DB / network / clock / telemetry imports
// (AC-8 grep guard — see story file for the literal token list).
//
// Returns `null` when no rental block exists — a property without a rental
// has no defined cash-flow (FR-23 makes rental optional 1:1 per property).
// The mortgage component is optional: a rental-only property surfaces
// `rent − charges`.

export interface RentalCashFlowInput {
  rental: { monthlyRent: number; monthlyCharges: number } | null;
  mortgage: { monthlyPayment: number } | null;
}

export function computeRentalCashFlow(input: RentalCashFlowInput): number | null {
  if (!input.rental) return null;
  const monthlyPayment = input.mortgage?.monthlyPayment ?? 0;
  return input.rental.monthlyRent - input.rental.monthlyCharges - monthlyPayment;
}
