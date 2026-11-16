// apps/mobile/components/screen-shell.tsx
// Scrollable safe-area wrapper for mobile tab/stack screens. Uses Tamagui's
// View/Text via @pekulo/ui/client and React Native's ScrollView with
// automatic content inset adjustment (Apple HIG / Expo Router guideline).
//
// AC-2 (verbatim from story 10-2-mobile-app-bootstrap:37):
//   Given the shared design-system configuration and native theme provider,
//   When the mobile application compiles with the Tamagui optimizing compiler
//   and mounts its root screen, Then both dark and light Pekulo themes apply
//   cleanly and the shared hero and stat components render without web-only
//   runtime errors.
// AC-3 (verbatim from story 10-2-mobile-app-bootstrap:38):
//   Given the mobile navigation shell, When the application launches at the
//   root route, Then the Cap tab renders as the initial screen, all five
//   primary destinations (`Cap`, `Transactions`, `Mensuel`, `Portefeuille`,
//   `Immobilier`) are navigable, and `Paramètres` opens in one tap from the
//   Cap header.

import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { Text, View } from "@pekulo/ui/client";

export interface ScreenShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function ScreenShell({ title, subtitle, children }: ScreenShellProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: "transparent" }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20, gap: 24 }}
    >
      <View gap="$1">
        <Text color="$color" fontSize="$h1" fontWeight="600">
          {title}
        </Text>
        {subtitle !== undefined && (
          <Text color="$colorSecondary" fontSize="$bodySm">
            {subtitle}
          </Text>
        )}
      </View>
      {children}
    </ScrollView>
  );
}
