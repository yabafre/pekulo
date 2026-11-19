// apps/mobile/components/screen-shell.tsx
// Root scrollable safe-area surface for mobile screens. Keeps `<ScrollView>`
// as the direct root element so iOS `NativeTabs` automatic content insets,
// scroll-to-top on tab re-tap, and Liquid Glass scroll edges work natively.

import { Text, View } from "@pekulo/ui/client";
import { useContext, type ReactNode } from "react";
import { Platform, RefreshControl, ScrollView } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { useTheme } from "tamagui";

export interface ScreenShellProps {
  /** Optional inline title (omit on screens that use a native iOS Large Title Stack header). */
  title?: string;
  subtitle?: string;
  /** Optional custom top bar (e.g. Cap | Patrimoine toggle) replacing title/subtitle. */
  topBar?: ReactNode;
  headerRight?: ReactNode;
  /** Apply top safe-area inset manually for screens with `headerShown: false`. */
  respectTopSafeArea?: boolean;
  /** Pull-to-refresh handler wired to React Query `refetch()`. */
  onRefresh?: () => Promise<unknown> | void;
  refreshing?: boolean;
  children: ReactNode;
}

export function ScreenShell({
  title,
  subtitle,
  topBar,
  headerRight,
  respectTopSafeArea = false,
  onRefresh,
  refreshing = false,
  children,
}: ScreenShellProps) {
  const theme = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const isIOS = Platform.OS === "ios";
  // On iOS, `contentInsetAdjustmentBehavior="automatic"` already applies both
  // top (status bar / Dynamic Island or translucent Large Title header) and
  // bottom (home indicator + NativeTabs bar) insets natively. Applying
  // SafeAreaInsets on top of that on iOS would double-inset the scroll view.
  const topInset = !isIOS && respectTopSafeArea ? (insets?.top ?? 0) : 0;
  const bottomInset = !isIOS ? (insets?.bottom ?? 0) : 0;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void onRefresh();
            }}
            tintColor={theme.colorSecondary.val}
          />
        ) : undefined
      }
      style={{ flex: 1, backgroundColor: theme.background.val }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 16 + topInset,
        paddingBottom: 32 + bottomInset,
        gap: 24,
      }}
    >
      {topBar ? (
        <View flexDirection="row" alignItems="center" justifyContent="space-between" gap="$3">
          {topBar}
          {headerRight}
        </View>
      ) : title || headerRight ? (
        <View gap="$1">
          <View flexDirection="row" alignItems="center" justifyContent="space-between" gap="$3">
            {title ? (
              <Text color="$color" fontSize="$h1" fontWeight="600" flexShrink={1}>
                {title}
              </Text>
            ) : (
              <View />
            )}
            {headerRight}
          </View>
          {Boolean(subtitle) && (
            <Text color="$colorSecondary" fontSize="$bodySm">
              {subtitle}
            </Text>
          )}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}
