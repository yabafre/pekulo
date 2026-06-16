// packages/ui/src/config/tamagui.ts
// createTamagui() invocation. Wires defaultConfig + animations-css driver
// (web-only, RSC-safe, honours prefers-reduced-motion natively) + Pekulo
// themes/tokens.
//
// Both `pekulo-dark` and `pekulo-light` are registered (story 8-2, AC-2).
// @tamagui/cli rc.42 STILL collides two custom themes onto one `.tm_*` class
// (the rc.41 bug persists), so the generated theme blocks are re-keyed to
// `[data-theme="pekulo-dark"]` / `[data-theme="pekulo-light"]` by
// scripts/fix-tamagui-css.mjs — the attribute NextThemeProvider + the layout
// anti-FOUC script both write. See that script's header for the full rationale.
import { defaultConfig } from "@tamagui/config/v5";
import { animations } from "@tamagui/config/v5-css";
import { createTamagui } from "@tamagui/core";

import { pekuloDark } from "../themes/pekulo-dark";
import { pekuloLight } from "../themes/pekulo-light";
import {
  pekuloFonts,
  pekuloFontSizes,
  pekuloFontWeights,
  pekuloLineHeights,
  pekuloRadius,
  pekuloSpacing,
} from "../tokens";

export const config = createTamagui({
  ...defaultConfig,
  animations,
  settings: {
    ...defaultConfig.settings,
    // Allow longhand style props (`backgroundColor`, `borderRadius`, ...)
    // alongside Tamagui's shorthands (`bg`, `rounded`, ...). UX preview source
    // uses longhands ; reviewers read longhands more fluently.
    onlyAllowShorthands: false,
  },
  themes: {
    "pekulo-dark": pekuloDark,
    "pekulo-light": pekuloLight,
  },
  defaultTheme: "pekulo-dark",
  // Token overrides — Pekulo spacing/radius/font scales replace defaultConfig's.
  tokens: {
    ...defaultConfig.tokens,
    space: pekuloSpacing as never,
    size: pekuloSpacing as never,
    radius: pekuloRadius as never,
  },
  fonts: {
    ...defaultConfig.fonts,
    body: {
      family: pekuloFonts.sans,
      size: pekuloFontSizes as never,
      weight: pekuloFontWeights as never,
      lineHeight: pekuloLineHeights as never,
    },
    heading: {
      family: pekuloFonts.sans,
      size: pekuloFontSizes as never,
      weight: pekuloFontWeights as never,
      lineHeight: pekuloLineHeights as never,
    },
    mono: {
      family: pekuloFonts.mono,
      size: pekuloFontSizes as never,
      weight: pekuloFontWeights as never,
      lineHeight: pekuloLineHeights as never,
    },
  },
});

export type AppConfig = typeof config;

declare module "@tamagui/web" {
  // biome-ignore lint/style/useNamingConvention: Tamagui module-augmentation contract
  interface TamaguiCustomConfig extends AppConfig {}
}
