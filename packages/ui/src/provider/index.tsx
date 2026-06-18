"use client";

// packages/ui/src/provider/index.tsx
// Single client boundary for @pekulo/ui consumers. Mounts Tamagui's runtime
// context (theme switching, animation driver, media-query watcher) +
// next-themes integration for SSR-correct first paint.
//
// Wire-up baselines (story 8-2 — both themes registered, data-theme driven):
//   - <NextThemeProvider attribute="data-theme" defaultTheme="system"
//       themes={["light","dark"]} value={{light:"pekulo-light",dark:"pekulo-dark"}}>
//     `attribute="data-theme"` makes next-theme write data-theme="pekulo-dark"
//     | "pekulo-light" on <html> — the exact attribute the layout anti-FOUC
//     script writes AND the generated CSS keys off (fix-tamagui-css.mjs re-keys
//     the rc.42-collided theme blocks to [data-theme=…]). The `value` map
//     translates the stored key (light|dark|system — what the anti-FOUC script
//     reads from localStorage) to the Tamagui theme name. defaultTheme="system"
//     matches the server DEFAULT_USER_PREF. skipNextHead was REMOVED (story
//     11-7): its branch renders a bare inline <script> with no nonce, which the
//     enforced nonce CSP blocks; next/script <Script> gets the per-request nonce.
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

// Re-export the theme-setting hook from THIS package so consumers (apps/web)
// read the SAME @tamagui/next-theme instance — and therefore the SAME
// ThemeSettingContext — that PekuloRootProvider mounts below. Importing
// `useThemeSetting` straight from "@tamagui/next-theme" in apps/web resolved a
// DIFFERENT copy (rc.41 vs packages/ui's rc.42) → a mismatched context →
// `set()` silently no-op'd → theme switching never applied. Routing the hook
// through @pekulo/ui pins it to the provider's instance (story 8-2 fix).
export { useThemeSetting } from "@tamagui/next-theme";

export function PekuloRootProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      themes={["light", "dark"]}
      value={{ light: "pekulo-light", dark: "pekulo-dark" }}
    >
      {/* TamaguiProvider's defaultTheme is the JS-context fallback (a real
          registered theme name); the visible theme is CSS-driven via the
          data-theme attribute above, so SSR first paint follows the anti-FOUC
          script regardless of this value. */}
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
