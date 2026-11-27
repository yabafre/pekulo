// apps/mobile/app/_layout.tsx
// Root Expo Router layout: loads Geist + Geist Mono fonts, mounts
// QueryClientProvider, PekuloRootProvider (@pekulo/ui), and AuthProvider,
// holds splash screen until fonts AND auth session state resolve (zero login
// flash), syncs React Navigation ThemeProvider with active Pekulo theme, and
// presents Paramètres + the edit/create flows as native form sheets:
//   - iOS: native transparent header carrying `Stack.Toolbar` items;
//   - Android (story 10-6 AC-2/AC-6): headerless (the scaffold renders its own
//     header row), `sheetElevation: 0` (design-spec: no drop shadows), plus the
//     DS `ActionSheetHost` for row action menus (AC-3).

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
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { usePathname, useRouter } from "expo-router";
import Stack from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";

import { ActionSheetHost } from "../lib/action-sheet-host";
import { AuthProvider, createMobileQueryClient, useAuth } from "../lib/auth/auth-context";
import { isDsGalleryEnabled } from "../lib/ds-gallery";
import { useMobileSettingsData } from "../lib/hooks/use-mobile-queries";
import { I18nProvider, useI18n } from "../lib/i18n";
import { PARAMETRES_DETENTS, SHEET_ROUTES, sheetOptions } from "../lib/sheet-presentation";

void SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { resolvedTheme } = useThemeSetting();
  const { isAuthenticated, isLoading, requireAuth } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const isLight = resolvedTheme === "pekulo-light";
  const palette = isLight ? pekuloColors.light : pekuloColors.dark;
  const chrome = { background: palette.surface.bg, ink: palette.text.primary };

  useEffect(() => {
    if (fontsReady && !isLoading) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const isDsGalleryRoute = isDsGalleryEnabled() && pathname.startsWith("/ds/");
    if (requireAuth && !isAuthenticated && pathname !== "/login" && !isDsGalleryRoute) {
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
          options={{ ...sheetOptions(PARAMETRES_DETENTS, chrome), title: t("settings.title") }}
        />
        {SHEET_ROUTES.map((sheet) => (
          <Stack.Screen
            key={sheet.name}
            name={sheet.name}
            options={sheetOptions(sheet.detents, chrome)}
          />
        ))}
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
      {Platform.OS === "android" ? <ActionSheetHost /> : null}
    </ThemeProvider>
  );
}

/** Drives the UI language from the saved `settings.lang` preference. */
function LocalizedRoot({ children }: { children: ReactNode }) {
  const { prefs } = useMobileSettingsData();
  return <I18nProvider lang={prefs.lang}>{children}</I18nProvider>;
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
          <LocalizedRoot>
            <RootNavigator fontsReady={fontsReady} />
          </LocalizedRoot>
        </AuthProvider>
      </PekuloRootProvider>
    </QueryClientProvider>
  );
}
