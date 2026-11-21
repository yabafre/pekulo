// apps/mobile/components/tab-stack-layout.tsx
// Shared native iOS/Android Stack layout for primary tabs: enables native iOS
// Large Title collapse, translucent header chrome synced to Pekulo themes, and
// a 44x44pt HIG-compliant profile/settings button in the navigation bar.

import { pekuloColors, useThemeSetting } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { Link } from "expo-router";
import Stack from "expo-router/stack";
import { SymbolView } from "expo-symbols";
import { Pressable } from "react-native";
import { useTheme } from "tamagui";

import { useAuth } from "../lib/auth/auth-context";

export function SettingsHeaderButton({ testID = "header-settings-btn" }: { testID?: string }) {
  const { userEmail } = useAuth();
  const initial = (userEmail?.trim().charAt(0) || "A").toUpperCase();

  return (
    <Link href="/parametres" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ouvrir les paramètres"
        hitSlop={4}
        testID={testID}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View
          width={36}
          height={36}
          borderRadius="$full"
          backgroundColor="$backgroundMuted"
          alignItems="center"
          justifyContent="center"
        >
          <Text color="$color" fontSize="$bodySm" fontWeight="600">
            {initial}
          </Text>
        </View>
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
        name="plus"
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

export interface TabStackLayoutProps {
  title: string;
}

export function TabStackLayout({ title }: TabStackLayoutProps) {
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
      <Stack.Screen
        name="index"
        options={{
          title,
          headerRight: () => <SettingsHeaderButton />,
        }}
      />
    </Stack>
  );
}
