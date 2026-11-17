// apps/mobile/components/screen-shell.tsx
// Scrollable safe-area wrapper for mobile tab/stack screens. Paints the Tamagui
// `$background` token (so the screen follows pekulo-dark / pekulo-light instead
// of whatever the OS shows behind a transparent ScrollView) and applies
// automatic content inset adjustment (Apple HIG / Expo Router guideline).
//
// `showTitle={false}` is for screens whose native header already renders a
// large title (Cap) — avoids a duplicated, misaligned title.

import { useContext, type ReactNode } from "react";
import { Platform, ScrollView } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { Text, View } from "@pekulo/ui/client";

export interface ScreenShellProps {
  title: string;
  subtitle?: string;
  showTitle?: boolean;
  children: ReactNode;
}

export function ScreenShell({ title, subtitle, showTitle = true, children }: ScreenShellProps) {
  const insets = useContext(SafeAreaInsetsContext);
  const topInset = Platform.OS === "android" ? (insets?.top ?? 0) : 0;

  return (
    <View flex={1} backgroundColor="$background">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20 + topInset,
          paddingBottom: 20,
          gap: 24,
        }}
      >
        {(showTitle || Boolean(subtitle)) && (
          <View gap="$1">
            {showTitle && (
              <Text color="$color" fontSize="$h1" fontWeight="600">
                {title}
              </Text>
            )}
            {Boolean(subtitle) && (
              <Text color="$colorSecondary" fontSize="$bodySm">
                {subtitle}
              </Text>
            )}
          </View>
        )}
        {children}
      </ScrollView>
    </View>
  );
}
