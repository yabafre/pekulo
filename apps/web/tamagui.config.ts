// apps/web/tamagui.config.ts
// Tamagui v2-rc.41 config for the W2 pre-flight spike. Layered on top of
// @tamagui/config/v5 so we inherit a working font stack, transitions,
// shorthands and breakpoints. Only the themes are overridden with Pekulo
// tokens. Tamagui v2 dropped the createTheme() helper — themes are plain
// objects mapping theme keys to color values, passed straight to createTamagui.

import { defaultConfig } from "@tamagui/config/v5";
import { animations } from "@tamagui/config/v5-css";
import { createTamagui } from "@tamagui/core";

import { pekuloColors } from "./src/app/(spike)/tamagui-spike/tokens";

const pekuloDark = {
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
} as const;

const pekuloLight = {
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
} as const;

export const config = createTamagui({
  ...defaultConfig,
  animations,
  themes: {
    ...defaultConfig.themes,
    "pekulo-dark": pekuloDark,
    "pekulo-light": pekuloLight,
  },
  defaultTheme: "pekulo-dark",
});

export type AppConfig = typeof config;

declare module "@tamagui/core" {
  // biome-ignore lint/style/useNamingConvention: Tamagui module-augmentation contract
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
