// packages/types/src/composition/composition.types.ts
// Wealth-class repartition shape consumed by PekuloCompositionCard /
// PekuloCompositionRow.

export interface CompositionItem {
  label: string;
  amount: number;
  pct: number;
  sub?: string;
}
