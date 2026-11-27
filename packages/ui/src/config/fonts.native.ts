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

// Story 10-8 review — the keyword weights `normal` / `bold` alias 400 / 700:
// Tamagui only deletes `fontWeight` when it finds a face for it, so an unmapped
// weight would leave a custom family + weight pair (Android → Roboto).
const geistFace = {
  400: { normal: "Geist_400Regular" },
  500: { normal: "Geist_500Medium" },
  600: { normal: "Geist_600SemiBold" },
  700: { normal: "Geist_700Bold" },
  normal: { normal: "Geist_400Regular" },
  bold: { normal: "Geist_700Bold" },
};

const geistMonoFace = {
  400: { normal: "GeistMono_400Regular" },
  500: { normal: "GeistMono_500Medium" },
  600: { normal: "GeistMono_600SemiBold" },
  700: { normal: "GeistMono_700Bold" },
  normal: { normal: "GeistMono_400Regular" },
  bold: { normal: "GeistMono_700Bold" },
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

/**
 * Story 10-8 — every native Tamagui Text gets `fontFamily: "$body"`, so
 * Tamagui's native face swap (getSplitStyles) resolves `Geist_<weight>` and
 * deletes `fontWeight` (a custom family + weight makes Android fall back to
 * Roboto). Named styled(Text) components are keyed by their own name and must
 * set `fontFamily: "$body"` themselves (see PekuloBreadcrumb.native.tsx).
 */
export const pekuloFontDefaultProps: Record<string, Record<string, unknown>> | undefined = {
  Text: { fontFamily: "$body" },
};

/** Story 10-8 — base face for raw React Native TextInput surfaces. */
export const PEKULO_NATIVE_BODY_FACE = geistFace[400].normal;
