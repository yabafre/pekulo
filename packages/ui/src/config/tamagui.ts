// packages/ui/src/config/tamagui.ts
// createTamagui() invocation shared by apps/web and apps/mobile.
// Platform-specific modules (`./animations`, `./fonts`) resolve to
// `*.native.ts` under Metro (Reanimated + Geist native faces) and to the
// CSS/web variants on Next.js / Vitest / `@tamagui/cli`.
//
// AC-1 (verbatim from story 10-2-mobile-app-bootstrap:36):
//   Given the mobile workspace and the cross-platform design-system additions,
//   When workspace installation, typechecking, linting, formatting,
//   design-system tests, and Tamagui CSS regeneration checks run, Then every
//   check exits 0 with zero regressions and zero drift on the pre-generated
//   web stylesheet.
// AC-2 (verbatim from story 10-2-mobile-app-bootstrap:37):
//   Given the shared design-system configuration and native theme provider,
//   When the mobile application compiles with the Tamagui optimizing compiler
//   and mounts its root screen, Then both dark and light Pekulo themes apply
//   cleanly and the shared hero and stat components render without web-only
//   runtime errors.
//
// Both `pekulo-dark` and `pekulo-light` are registered (story 8-2, AC-2).
// @tamagui/cli rc.42 STILL collides two custom themes onto one `.tm_*` class
// (the rc.41 bug persists), so the generated theme blocks are re-keyed to
// `[data-theme="pekulo-dark"]` / `[data-theme="pekulo-light"]` by
// scripts/fix-tamagui-css.mjs — the attribute NextThemeProvider + the layout
// anti-FOUC script both write. See that script's header for the full rationale.
//
// Story 10-8: the createTamagui() body lives in ./create-config.ts so the
// native compiler config (./tamagui.compiler.native.ts) builds the exact same
// config with the native fonts. `pekuloFontDefaultProps` is `undefined` on
// web (fonts.ts) and `{ Text: { fontFamily: "$body" } }` on native
// (fonts.native.ts) — Tamagui only swaps in the weight-matched Geist face
// when a Text carries a fontFamily.
import { animations } from "./animations";
import { createPekuloConfig } from "./create-config";
import { createPekuloFonts, pekuloFontDefaultProps } from "./fonts";

export const config = createPekuloConfig({
  animations,
  fonts: createPekuloFonts(),
  defaultProps: pekuloFontDefaultProps,
});

export type AppConfig = typeof config;

declare module "@tamagui/web" {
  // biome-ignore lint/style/useNamingConvention: Tamagui module-augmentation contract
  interface TamaguiCustomConfig extends AppConfig {}
}
