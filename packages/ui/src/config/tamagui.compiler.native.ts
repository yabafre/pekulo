// packages/ui/src/config/tamagui.compiler.native.ts
// Story 10-8 — config entry for @tamagui/babel-plugin / @tamagui/metro-plugin
// in apps/mobile ONLY. @tamagui/static loads the compiler config with a plain
// Node require() (registerRequire) that never resolves `.native.ts`, so the
// runtime config (./tamagui.ts → "./fonts") would bake the WEB font stack into
// every flattened native Text. Importing "./fonts.native" explicitly makes the
// compile-time config equal the runtime config Metro builds on device.
//
// `./animations` intentionally stays extension-less: the compiler resolved the
// web (CSS) driver before this story and does not use animation drivers to
// flatten styles; changing it is out of scope.
//
// Excluded from packages/ui's web typecheck by the `**/*.native.ts` rule;
// type-checked by apps/mobile through apps/mobile/tamagui.config.ts.
import { animations } from "./animations";
import { createPekuloConfig } from "./create-config";
import { createPekuloFonts, pekuloFontDefaultProps } from "./fonts.native";

export const config = createPekuloConfig({
  animations,
  fonts: createPekuloFonts(),
  defaultProps: pekuloFontDefaultProps,
});
