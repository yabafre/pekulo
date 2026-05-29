"use client";

// packages/ui/src/provider/index.tsx
// Single client boundary for @pekulo/ui consumers. Mounts Tamagui's runtime
// context (theme switching, animation driver, media-query watcher) +
// next-themes integration for SSR-correct first paint.
//
// Wire-up baselines (inherited from W2 spike retrofit):
//   - <NextThemeProvider defaultTheme="pekulo-dark"
//       themes={["pekulo-light", "pekulo-dark"]}>
//     The themes prop MUST be explicit — omitting it defaults to ["light",
//     "dark"] and the data-theme attribute never matches Pekulo's custom
//     names. skipNextHead was REMOVED (story 11-7): its branch renders a bare
//     inline <script> with no nonce, which the enforced nonce-based CSP blocks.
//     Routing the anti-FOUC script through next/script <Script> instead lets
//     Next attach the per-request nonce to it automatically.
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
import { PekuloToastViewport, ToastProvider } from "../toast";

export function PekuloRootProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider defaultTheme="pekulo-dark" themes={["pekulo-light", "pekulo-dark"]}>
      {/* TamaguiProvider's TS contract requires `defaultTheme` (matches
          NextThemeProvider above). Both fall back to the same value at
          runtime — kept in sync by hand for now. When light is registered
          the value will flip in lock-step. */}
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
