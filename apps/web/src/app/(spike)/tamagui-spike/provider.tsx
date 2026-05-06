"use client";

// apps/web/src/app/(spike)/tamagui-spike/provider.tsx
// The single client boundary for the W2 spike. All Tamagui runtime context
// (theme switching, animation driver, media-query watcher) lives behind this
// wall.
//
// Reference: https://tamagui.dev/docs/guides/next-js — section "App Router".
//
// Theme wiring:
//   - NextThemeProvider learns our custom theme names ("pekulo-light",
//     "pekulo-dark") via the `themes` prop. Without it, NextThemeProvider
//     defaults to ["light", "dark"] and never raises the right data-theme
//     attribute, leaving Tamagui's runtime in "no theme" state — which is
//     what produced the broken light render in the first paint of T4.2.
//   - We do NOT pass `disableRootThemeClass` so TamaguiProvider applies the
//     `t_pekulo-dark` class on its wrapping <View>, ensuring descendants
//     inherit the theme's token resolution even before NextThemeProvider's
//     hydration race resolves.

import type { ReactNode } from "react";
import { NextThemeProvider } from "@tamagui/next-theme";
import { TamaguiProvider } from "tamagui";

import config from "../../../../tamagui.config";

export function PekuloTamaguiProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      skipNextHead
      defaultTheme="pekulo-dark"
      themes={["pekulo-light", "pekulo-dark"]}
    >
      <TamaguiProvider config={config} defaultTheme="pekulo-dark">
        {children}
      </TamaguiProvider>
    </NextThemeProvider>
  );
}
