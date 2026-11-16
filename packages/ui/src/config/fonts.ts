// packages/ui/src/config/fonts.ts
// Web font configuration for Tamagui — preserves exact V1 web theme/snapshot shape.
import { defaultConfig } from "@tamagui/config/v5";

import { pekuloFonts, pekuloFontSizes, pekuloFontWeights, pekuloLineHeights } from "../tokens";

export function createPekuloFonts() {
  return {
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
  };
}
