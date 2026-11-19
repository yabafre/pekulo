// apps/mobile/app/_layout.tsx
// Root Expo Router layout: loads Geist + Geist Mono fonts, mounts
// QueryClientProvider, PekuloRootProvider (@pekulo/ui), and AuthProvider,
// holds splash screen until fonts AND auth session state resolve (zero login
// flash), syncs React Navigation ThemeProvider with active Pekulo theme, and
// presents Paramètres as a native iOS form sheet.

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
import { PekuloRootProvider, pekuloColors, useThemeSetting } from "@pekulo/ui";
import { Text } from "@pekulo/ui/client";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { usePathname, useRouter } from "expo-router";
import Stack from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable } from "react-native";

import { AuthProvider, createMobileQueryClient, useAuth } from "../lib/auth/auth-context";

void SplashScreen.preventAutoHideAsync().catch(() => {});

function SheetCloseButton() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fermer les paramètres"
      hitSlop={8}
      testID="close-settings-btn"
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/");
        }
      }}
      style={({ pressed }) => ({
        minWidth: 44,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text color="$color" fontSize="$bodySm" fontWeight="600">
        Fermer
      </Text>
    </Pressable>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { resolvedTheme } = useThemeSetting();
  const { isAuthenticated, isLoading, requireAuth } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLight = resolvedTheme === "pekulo-light";
  const palette = isLight ? pekuloColors.light : pekuloColors.dark;

  useEffect(() => {
    if (fontsReady && !isLoading) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    if (requireAuth && !isAuthenticated && pathname !== "/login") {
      router.replace("/login");
    } else if (isAuthenticated && pathname === "/login") {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, pathname, requireAuth, router]);

  const navTheme = isLight
    ? {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: palette.surface.bg,
          card: palette.surface.card,
        },
      }
    : {
        ...DarkTheme,
        colors: { ...DarkTheme.colors, background: palette.surface.bg, card: palette.surface.card },
      };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={isLight ? "dark" : "light"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="parametres"
          options={{
            headerShown: true,
            title: "Paramètres",
            presentation: "formSheet",
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.85, 1.0],
            headerTransparent: true,
            headerShadowVisible: false,
            headerTitleStyle: { color: palette.text.primary },
            headerTintColor: palette.text.primary,
            contentStyle: { backgroundColor: palette.surface.bg },
            headerRight: () => <SheetCloseButton />,
          }}
        />
        <Stack.Screen
          name="login"
          options={{
            headerShown: false,
            title: "Connexion",
            animation: "fade",
            gestureEnabled: false,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => createMobileQueryClient());
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

  const fontsReady = Boolean(fontsLoaded || fontError);

  if (!fontsReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PekuloRootProvider>
        <AuthProvider>
          <RootNavigator fontsReady={fontsReady} />
        </AuthProvider>
      </PekuloRootProvider>
    </QueryClientProvider>
  );
}
