// packages/ui/src/provider/index.native.tsx
// Native root provider for @pekulo/ui consumers (apps/mobile).
// Mounts TamaguiProvider with Pekulo themes (`pekulo-dark` / `pekulo-light`)
// driven by OS color scheme or an explicit theme override.
// Excludes @tamagui/next-theme (next/script) and web-only CSS injection flags.
//
// AC-2 (verbatim from story 10-2-mobile-app-bootstrap:37):
//   Given the shared design-system configuration and native theme provider,
//   When the mobile application compiles with the Tamagui optimizing compiler
//   and mounts its root screen, Then both dark and light Pekulo themes apply
//   cleanly and the shared hero and stat components render without web-only
//   runtime errors.

import type { ReactNode } from "react";
import { useColorScheme } from "react-native";
import { TamaguiProvider } from "tamagui";

import { config } from "../config/tamagui";

export interface PekuloRootProviderProps {
  children: ReactNode;
  /** Optional explicit theme override; defaults to OS color scheme ("pekulo-dark" fallback). */
  theme?: "pekulo-dark" | "pekulo-light" | "system";
}

export function PekuloRootProvider({ children, theme = "system" }: PekuloRootProviderProps) {
  const colorScheme = useColorScheme();
  const resolvedTheme =
    theme === "system" ? (colorScheme === "light" ? "pekulo-light" : "pekulo-dark") : theme;

  return (
    <TamaguiProvider config={config} defaultTheme={resolvedTheme}>
      {children}
    </TamaguiProvider>
  );
}
