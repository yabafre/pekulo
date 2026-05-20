// packages/types/src/stat/stat.types.ts
// Stat tone — generic value-display tonality for the Mensuel surface and
// any KPI tile that flips colour based on a gain/loss sign.

export const STAT_TONES = ["gain", "loss"] as const;
export type StatTone = (typeof STAT_TONES)[number];
