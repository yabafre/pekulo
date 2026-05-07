// packages/ui/src/themes/pekulo-light.ts
// NOTE: NOT registered in createTamagui#themes due to @tamagui/cli@2.0.0-rc.41
// selector-emission bug (W2 spike T6, finding 3). Kept in TS for the contrast
// tests + future re-registration when the CLI is fixed.
import { pekuloColors } from "../tokens/colors";

const c = pekuloColors.light;

export const pekuloLight = {
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
  perfGain: c.perf.gain,
  perfGainSoft: c.perf.gainSoft,
  perfLoss: c.perf.loss,
  perfLossSoft: c.perf.lossSoft,
  perfNeutral: c.perf.neutral,
  dataBlue: c.dataBlue,
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
