// packages/types/src/realestate/realestate.types.ts
// Real-estate UI prop shape — domain entity + schemas land in
// @pekulo/validators alongside Epic 4 (realestate-domain).

export interface Property {
  label: string;
  valuationEur: number;
  debtRemainingEur: number;
  monthlyPaymentEur: number;
  yearsRemaining: number;
  repaidPct: number;
}
