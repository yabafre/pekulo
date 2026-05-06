"use client";

// apps/web/src/app/(spike)/tamagui-spike/provider.tsx
// The single client boundary for the W2 spike. All Tamagui runtime context
// (theme switching, animation driver, media-query watcher) lives behind this
// wall. Children render as Server Components; with React 19 Tamagui auto-injects
// runtime styles via <style> tags — no useServerInsertedHTML / config.getCSS()
// dance required (the docs/ux-preview pattern was webpack-flavoured and breaks
// Turbopack's bundling because it pulls Tamagui internals into the SSR pass).
//
// Reference: https://tamagui.dev/docs/guides/next-js — section "App Router (Turbopack)".

import type { ReactNode } from "react";
import { NextThemeProvider } from "@tamagui/next-theme";
import { TamaguiProvider } from "tamagui";

import config from "../../../../tamagui.config";

export function PekuloTamaguiProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider skipNextHead defaultTheme="pekulo-dark">
      <TamaguiProvider config={config} defaultTheme="pekulo-dark" disableRootThemeClass>
        {children}
      </TamaguiProvider>
    </NextThemeProvider>
  );
}
