// packages/ui/src/themes/pekulo-dark.ts
import { pekuloColors } from "../tokens/colors";

export const pekuloDark = {
  background: pekuloColors.dark.surface.bg,
  backgroundCard: pekuloColors.dark.surface.card,
  backgroundElevated: pekuloColors.dark.surface.elevated,
  backgroundMuted: pekuloColors.dark.surface.muted,
  color: pekuloColors.dark.text.primary,
  colorSecondary: pekuloColors.dark.text.secondary,
  colorTertiary: pekuloColors.dark.text.tertiary,
  colorMuted: pekuloColors.dark.text.muted,
  colorOnAccent: pekuloColors.dark.text.onAccent,
  accent: pekuloColors.dark.accent[500],
  accentHover: pekuloColors.dark.accent[400],
  success: pekuloColors.dark.semantic.success,
  warning: pekuloColors.dark.semantic.warning,
  danger: pekuloColors.dark.semantic.danger,
  info: pekuloColors.dark.semantic.info,
  borderDefault: pekuloColors.dark.border.default,
  borderStrong: pekuloColors.dark.border.strong,
  borderFocus: pekuloColors.dark.border.focus,
  chartActual: pekuloColors.dark.chart.actual,
  chartPlan: pekuloColors.dark.chart.plan,
  chartProjection: pekuloColors.dark.chart.projection,
  chartGrid: pekuloColors.dark.chart.grid,
  donutTrack: pekuloColors.dark.donut.track,
  donutFill: pekuloColors.dark.donut.fill,
} as const;
