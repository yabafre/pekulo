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

// pekuloLight removed from runtime — see the `themes:` block below for the
// CLI's `prefers-color-scheme` selector-emission bug. The light palette stays
// in tokens.ts so the contrast test can still exercise it.

export const config = createTamagui({
  ...defaultConfig,
  animations,
  // @tamagui/config/v5 defaults to onlyAllowShorthands: true, which rejects
  // longhand style props like `backgroundColor`, `borderRadius`, `padding`,
  // `marginTop`, `alignItems`. The spike port keeps the longhand vocabulary
  // (the docs/ux-preview source uses it, and reviewers read longhands more
  // fluently than `bg` / `rounded` / `p` / `mt` / `items`). Disabling the
  // restriction here re-allows both forms — shorthands still work where used.
  settings: {
    ...defaultConfig.settings,
    onlyAllowShorthands: false,
  },
  // We deliberately do NOT spread ...defaultConfig.themes here. Tamagui's type
  // system intersects keys across every theme — mixing v5 component themes
  // (which expose only `background`, `color`, `borderColor`, …) with the Pekulo
  // themes (which add `backgroundCard`, `colorSecondary`, `colorTertiary`, …)
  // would erase our custom keys from the inferred type and reject usages like
  // `<View backgroundColor="$backgroundCard">`. The spike only consumes <View>
  // and <Text> primitives which don't need component themes (Button, Input,
  // …). Story 0-10 will revisit theme composition when @pekulo/ui ships.
  // We register only `pekulo-dark` in Tamagui's runtime config because the
  // CLI's `tamagui generate-css` (v2-rc.41) emits malformed CSS when a second
  // custom-named theme is present alongside a `prefers-color-scheme` media
  // block — the second theme's selector is dropped and PostCSS rejects the
  // whole file with `Invalid empty selector` (verified live, line 32 of the
  // generated output). The W2 contrast contract tests `pekulo-light` from
  // `tokens.ts` directly (independent of Tamagui's runtime), so the AC-2
  // proof survives. When 0-10 (or its post-pivot replacement) re-evaluates
  // the design system, the second theme either lands on a stable Tamagui
  // release or gets emitted via a hand-rolled CSS layer.
  themes: {
    "pekulo-dark": pekuloDark,
  },
  defaultTheme: "pekulo-dark",
});

export type AppConfig = typeof config;

declare module "@tamagui/core" {
  // biome-ignore lint/style/useNamingConvention: Tamagui module-augmentation contract
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
