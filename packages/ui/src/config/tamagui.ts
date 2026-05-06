// packages/ui/src/config/tamagui.ts
// createTamagui() invocation. Wires defaultConfig + animations-css driver
// (web-only, RSC-safe, honours prefers-reduced-motion natively) + Pekulo
// themes/tokens.
//
// Only `pekulo-dark` is registered in `themes:` due to the @tamagui/cli
// v2-rc.41 selector-emission bug for two custom-named themes (finding 3
// of W2 spike). `pekulo-light` exists in TS for the contrast tests +
// future re-registration. When the CLI bug ships a fix, add
// `"pekulo-light": pekuloLight` here in one line.
import { defaultConfig } from "@tamagui/config/v5";
import { animations } from "@tamagui/config/v5-css";
import { createTamagui } from "@tamagui/core";

import { pekuloDark } from "../themes/pekulo-dark";
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
