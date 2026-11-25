// apps/mobile/components/tab-stack-layout.tsx
// Shared native iOS/Android Stack layout for primary tabs: enables native iOS
// Large Title collapse, translucent header chrome synced to Pekulo themes, and
// a 44x44pt HIG-compliant profile/settings button in the navigation bar.

import { pekuloColors, useThemeSetting } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { Link, useRouter } from "expo-router";
import Stack from "expo-router/stack";
import { SymbolView } from "expo-symbols";
import { Pressable } from "react-native";
import { useTheme } from "tamagui";

import { useI18n, type MessageKey } from "../lib/i18n";

export function SettingsHeaderButton({ testID = "header-settings-btn" }: { testID?: string }) {
  const theme = useTheme();
  const { t } = useI18n();
  // Same profile glyph as the native toolbar button on the other tabs.
  return (
    <Link href="/parametres" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.actions.openSettings")}
        hitSlop={4}
        testID={testID}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <SymbolView
          name={{ ios: "person.crop.circle", android: "account_circle" }}
          size={24}
          tintColor={theme.color.val}
          fallback={
            <Text color="$color" fontSize="$bodySm" fontWeight="600">
              ⚙︎
            </Text>
          }
        />
      </Pressable>
    </Link>
  );
}

/** 44×44pt SF Symbol "plus" button for a tab's primary create action. */
export function HeaderAddButton({
  onPress,
  accessibilityLabel,
  testID = "header-add-btn",
}: {
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <SymbolView
        name={{ ios: "plus", android: "add" }}
        size={20}
        weight="semibold"
        tintColor={theme.color.val}
        fallback={
          <Text color="$color" fontSize="$h2" fontWeight="500">
            +
          </Text>
        }
      />
    </Pressable>
  );
}

/** Header trailing items: optional create button, then the settings avatar. */
export function TabHeaderActions({
  onAdd,
  addLabel,
  settingsTestID,
}: {
  onAdd?: () => void;
  addLabel?: string;
  settingsTestID?: string;
}) {
  return (
    <View flexDirection="row" alignItems="center">
      {onAdd ? (
        <HeaderAddButton onPress={onAdd} accessibilityLabel={addLabel ?? "Ajouter"} />
      ) : null}
      <SettingsHeaderButton testID={settingsTestID} />
    </View>
  );
}

/**
 * Native header items for a tab screen (real `UIBarButtonItem`s on iOS 26):
 * render inside the screen, e.g. `<TabToolbar onAdd={…} addLabel="…" />`.
 * `Stack.Toolbar.*` children must stay direct children of `Stack.Toolbar`.
 */
export function TabToolbar({ onAdd, addLabel }: { onAdd?: () => void; addLabel?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <Stack.Toolbar placement="right">
      {onAdd ? (
        <Stack.Toolbar.Button
          icon="plus"
          accessibilityLabel={addLabel ?? t("common.actions.add")}
          onPress={onAdd}
        />
      ) : null}
      <Stack.Toolbar.Button
        icon="person.crop.circle"
        accessibilityLabel={t("common.actions.openSettings")}
        onPress={() => router.push("/parametres")}
      />
    </Stack.Toolbar>
  );
}

export interface TabStackLayoutProps {
  titleKey: MessageKey;
}

export function TabStackLayout({ titleKey }: TabStackLayoutProps) {
  const { t } = useI18n();
  const title = t(titleKey);
  const { resolvedTheme } = useThemeSetting();
  const palette = resolvedTheme === "pekulo-light" ? pekuloColors.light : pekuloColors.dark;

  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerLargeTitle: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerLargeStyle: { backgroundColor: "transparent" },
        headerTitleStyle: { color: palette.text.primary },
        headerLargeTitleStyle: { color: palette.text.primary },
        headerTintColor: palette.text.primary,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: palette.surface.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  );
}
