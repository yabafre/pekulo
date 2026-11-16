// packages/ui/src/config/fonts.native.ts
// React Native font configuration for Tamagui — uses pixel lineHeights and
// explicit weight→fontFace mappings loaded via @expo-google-fonts/geist.
import { defaultConfig } from "@tamagui/config/v5";
import { createFont } from "@tamagui/core";

import { pekuloFontSizes, pekuloFontWeights, pekuloLetterSpacings } from "../tokens";

function computeNativeLineHeights(ratio: number): Record<keyof typeof pekuloFontSizes, number> {
  return Object.fromEntries(
    Object.entries(pekuloFontSizes).map(([key, px]) => [key, Math.round(px * ratio)]),
  ) as Record<keyof typeof pekuloFontSizes, number>;
}

const geistFace = {
  400: { normal: "Geist_400Regular" },
  500: { normal: "Geist_500Medium" },
  600: { normal: "Geist_600SemiBold" },
  700: { normal: "Geist_700Bold" },
};

const geistMonoFace = {
  400: { normal: "GeistMono_400Regular" },
  500: { normal: "GeistMono_500Medium" },
  600: { normal: "GeistMono_600SemiBold" },
};

export function createPekuloFonts() {
  return {
    ...defaultConfig.fonts,
    body: createFont({
      family: "Geist_400Regular",
      size: pekuloFontSizes,
      lineHeight: computeNativeLineHeights(1.4),
      weight: pekuloFontWeights,
      letterSpacing: pekuloLetterSpacings,
      face: geistFace,
    }),
    heading: createFont({
      family: "Geist_600SemiBold",
      size: pekuloFontSizes,
      lineHeight: computeNativeLineHeights(1.25),
      weight: pekuloFontWeights,
      letterSpacing: pekuloLetterSpacings,
      face: geistFace,
    }),
    mono: createFont({
      family: "GeistMono_400Regular",
      size: pekuloFontSizes,
      lineHeight: computeNativeLineHeights(1.4),
      weight: pekuloFontWeights,
      letterSpacing: pekuloLetterSpacings,
      face: geistMonoFace,
    }),
  };
}
