// apps/mobile/app/_layout.tsx
// Root Expo Router layout: loads Geist + Geist Mono fonts, mounts
// PekuloRootProvider (@pekulo/ui), QueryClientProvider (@tanstack/react-query),
// and AuthProvider (Supabase Auth + expo-secure-store), syncs React Navigation
// ThemeProvider with active Pekulo theme, and mounts (tabs), parametres, and login.

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
import { PekuloRootProvider, useThemeSetting } from "@pekulo/ui";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { usePathname, useRouter } from "expo-router";
import Stack from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";

import { AuthProvider, createMobileQueryClient, useAuth } from "../lib/auth/auth-context";

void SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { resolvedTheme } = useThemeSetting();
  const { isAuthenticated, isLoading, requireAuth } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLight = resolvedTheme === "pekulo-light";

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
        colors: { ...DefaultTheme.colors, background: "#ffffff", card: "#fafafa" },
      }
    : {
        ...DarkTheme,
        colors: { ...DarkTheme.colors, background: "#000000", card: "#0a0a0a" },
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
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="login"
          options={{
            headerShown: false,
            title: "Connexion",
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

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PekuloRootProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </PekuloRootProvider>
    </QueryClientProvider>
  );
}
