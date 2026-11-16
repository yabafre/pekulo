// apps/mobile/app/(tabs)/(cap)/_layout.tsx
// AC-3 (verbatim from story 10-2-mobile-app-bootstrap:38):
//   Given the mobile navigation shell, When the application launches at the
//   root route, Then the Cap tab renders as the initial screen, all five
//   primary destinations (`Cap`, `Transactions`, `Mensuel`, `Portefeuille`,
//   `Immobilier`) are navigable, and `Paramètres` opens in one tap from the
//   Cap header.
import { Link } from "expo-router";
import Stack from "expo-router/stack";
import { Pressable } from "react-native";
import { Text, View } from "@pekulo/ui/client";

function SettingsAvatarLink() {
  return (
    <Link href="/parametres" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ouvrir les paramètres"
        testID="open-settings-btn"
      >
        <View
          width={34}
          height={34}
          borderRadius="$full"
          backgroundColor="$backgroundMuted"
          alignItems="center"
          justifyContent="center"
        >
          <Text color="$color" fontSize="$bodySm" fontWeight="600">
            A
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

export default function CapStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        headerLargeTitle: true,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Cap",
          headerRight: SettingsAvatarLink,
        }}
      />
    </Stack>
  );
}
