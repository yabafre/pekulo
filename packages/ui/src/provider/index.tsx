"use client";

// packages/ui/src/provider/index.tsx
// Single client boundary for @pekulo/ui consumers. Mounts Tamagui's runtime
// context (theme switching, animation driver, media-query watcher) +
// next-themes integration for SSR-correct first paint.
//
// Wire-up baselines (inherited from W2 spike retrofit, non-negotiable):
//   - <NextThemeProvider skipNextHead defaultTheme="pekulo-dark"
//       themes={["pekulo-light", "pekulo-dark"]}>
//     The themes prop MUST be explicit — omitting it defaults to ["light",
//     "dark"] and the data-theme attribute never matches Pekulo's custom
//     names.
//   - <TamaguiProvider config={config} disableInjectCSS disableRootThemeClass>
//     disableInjectCSS — the package ships a pre-generated CSS file that
//     consumers import (apps/web/src/app/layout.tsx imports
//     "@pekulo/ui/generated.css"); the runtime does not re-emit atomic CSS
//     on every render.
//     disableRootThemeClass — the theme class is set by NextThemeProvider on
//     <html> via data-theme, not by TamaguiProvider's wrapping <View>.
//
// Ref: https://tamagui.dev/docs/guides/next-js section "App Router"
//      docs/spikes/0-9-tamagui-decision.md (post-review revision).

import type { ReactNode } from "react";
import { NextThemeProvider } from "@tamagui/next-theme";
import { TamaguiProvider } from "tamagui";

import { config } from "../config/tamagui";
import { PekuloToastViewport, ToastProvider } from "../components/toast";

export function PekuloRootProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      skipNextHead
      defaultTheme="pekulo-dark"
      themes={["pekulo-light", "pekulo-dark"]}
    >
      <TamaguiProvider
        config={config}
        defaultTheme="pekulo-dark"
        disableInjectCSS
        disableRootThemeClass
      >
        <ToastProvider>
          {children}
          <PekuloToastViewport />
        </ToastProvider>
      </TamaguiProvider>
    </NextThemeProvider>
  );
}
