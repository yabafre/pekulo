// apps/mobile/app/_layout.tsx
// Root Expo Router layout: loads Geist + Geist Mono fonts, mounts
// PekuloRootProvider (@pekulo/ui), syncs React Navigation ThemeProvider with OS
// scheme, and mounts the (tabs) navigator plus the Paramètres modal route.
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

import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import {
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
  GeistMono_700Bold,
} from "@expo-google-fonts/geist-mono";
import { PekuloRootProvider } from "@pekulo/ui";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import Stack from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
    GeistMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const navTheme =
    colorScheme === "light"
      ? {
          ...DefaultTheme,
          colors: { ...DefaultTheme.colors, background: "#ffffff", card: "#fafafa" },
        }
      : {
          ...DarkTheme,
          colors: { ...DarkTheme.colors, background: "#000000", card: "#0a0a0a" },
        };

  return (
    <PekuloRootProvider>
      <ThemeProvider value={navTheme}>
        <StatusBar style={colorScheme === "light" ? "dark" : "light"} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="parametres"
            options={{
              headerShown: true,
              title: "Paramètres",
              presentation: "modal",
            }}
          />
        </Stack>
      </ThemeProvider>
    </PekuloRootProvider>
  );
}
