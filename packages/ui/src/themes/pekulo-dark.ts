// packages/ui/src/themes/pekulo-dark.ts
import { pekuloColors } from "../tokens/colors";

const c = pekuloColors.dark;

export const pekuloDark = {
  background: c.surface.bg,
  backgroundCard: c.surface.card,
  backgroundElevated: c.surface.elevated,
  backgroundMuted: c.surface.muted,
  backgroundOverlay: c.surface.overlay,
  color: c.text.primary,
  colorSecondary: c.text.secondary,
  colorTertiary: c.text.tertiary,
  colorMuted: c.text.muted,
  colorOnAccent: c.text.onAccent,
  // SSOT-aligned perf delta tokens (chromatic = ONLY for ± monetary deltas).
  perfGain: c.perf.gain,
  perfGainSoft: c.perf.gainSoft,
  perfLoss: c.perf.loss,
  perfLossSoft: c.perf.lossSoft,
  perfNeutral: c.perf.neutral,
  dataBlue: c.dataBlue,
  // Semantic aliases — preserved for ergonomic component code. `$accent` is
  // a synonym for perf.gain (positive delta); `$success` / `$danger` carry
  // perf semantics. `$warning` is a documented Pekulo extension (amber,
  // LLM-confidence labels). `$info` aliases dataBlue.
  accent: c.perf.gain,
  accentHover: c.perf.gain,
  success: c.perf.gain,
  warning: c.warning,
  danger: c.perf.loss,
  info: c.dataBlue,
  borderDefault: c.border.default,
  borderStrong: c.border.strong,
  borderFocus: c.border.focus,
  chartActual: c.chart.actual,
  chartPlan: c.chart.plan,
  chartProjection: c.chart.projection,
  chartGrid: c.chart.grid,
  donutTrack: c.donut.track,
  donutFill: c.donut.fill,
} as const;
