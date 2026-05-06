// packages/ui/src/themes/pekulo-light.ts
// NOTE: NOT registered in createTamagui#themes due to @tamagui/cli@2.0.0-rc.41
// selector-emission bug (see W2 spike T6, finding 3). Kept in TS for the
// contrast tests + future re-registration when the CLI is fixed.
import { pekuloColors } from "../tokens/colors";

export const pekuloLight = {
  background: pekuloColors.light.surface.bg,
  backgroundCard: pekuloColors.light.surface.card,
  backgroundElevated: pekuloColors.light.surface.elevated,
  backgroundMuted: pekuloColors.light.surface.muted,
  color: pekuloColors.light.text.primary,
  colorSecondary: pekuloColors.light.text.secondary,
  colorTertiary: pekuloColors.light.text.tertiary,
  colorMuted: pekuloColors.light.text.muted,
  colorOnAccent: pekuloColors.light.text.onAccent,
  accent: pekuloColors.light.accent[500],
  accentHover: pekuloColors.light.accent[600],
  success: pekuloColors.light.semantic.success,
  warning: pekuloColors.light.semantic.warning,
  danger: pekuloColors.light.semantic.danger,
  info: pekuloColors.light.semantic.info,
  borderDefault: pekuloColors.light.border.default,
  borderStrong: pekuloColors.light.border.strong,
  borderFocus: pekuloColors.light.border.focus,
  chartActual: pekuloColors.light.chart.actual,
  chartPlan: pekuloColors.light.chart.plan,
  chartProjection: pekuloColors.light.chart.projection,
  chartGrid: pekuloColors.light.chart.grid,
  donutTrack: pekuloColors.light.donut.track,
  donutFill: pekuloColors.light.donut.fill,
} as const;
