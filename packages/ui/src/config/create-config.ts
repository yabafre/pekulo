// packages/ui/src/config/create-config.ts
// Story 10-8 — the single createTamagui() body shared by the runtime config
// (`./tamagui.ts`, platform-resolved by Metro / Next / Vitest / @tamagui/cli)
// and the native compiler config (`./tamagui.compiler.native.ts`, which must
// import `./fonts.native` explicitly because @tamagui/static loads configs
// with a plain Node require() that ignores `.native.ts`).
//
// Both @tamagui/cli rc.42 theme notes and the AC-1/AC-2 history of story 10-2
// live in `./tamagui.ts`'s header.
import { defaultConfig } from "@tamagui/config/v5";
import { createTamagui } from "@tamagui/core";

import { pekuloDark } from "../themes/pekulo-dark";
import { pekuloLight } from "../themes/pekulo-light";
import { pekuloRadius, pekuloSpacing } from "../tokens";

export interface PekuloConfigInput {
  animations: Parameters<typeof createTamagui>[0]["animations"];
  fonts: unknown;
  /** Native only (story 10-8). `undefined` on web keeps the web config byte-identical. */
  defaultProps?: Record<string, Record<string, unknown>>;
}

export function createPekuloConfig({ animations, fonts, defaultProps }: PekuloConfigInput) {
  return createTamagui({
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
    // createTamagui() treats `undefined` exactly like an absent key
    // (`configIn.defaultProps || {}`), so web output does not change.
    defaultProps: defaultProps as never,
    // Token overrides — Pekulo spacing/radius/font scales replace defaultConfig's.
    tokens: {
      ...defaultConfig.tokens,
      space: pekuloSpacing as never,
      size: pekuloSpacing as never,
      radius: pekuloRadius as never,
    },
    fonts: fonts as never,
  });
}
