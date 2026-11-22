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
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { usePathname, useRouter } from "expo-router";
import Stack from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ReactNode } from "react";

import { AuthProvider, createMobileQueryClient, useAuth } from "../lib/auth/auth-context";
import { useMobileSettingsData } from "../lib/hooks/use-mobile-queries";
import { I18nProvider, useI18n } from "../lib/i18n";

void SplashScreen.preventAutoHideAsync().catch(() => {});

// Edit/create flows presented as native iOS form sheets. Short forms open at a
// medium detent and can be dragged to full height; long forms open full height.
const SHEET_ROUTES: { name: string; detents: number[] }[] = [
  { name: "sheets/transaction", detents: [1.0] },
  { name: "sheets/milestone", detents: [0.6, 1.0] },
  { name: "sheets/account", detents: [1.0] },
  { name: "sheets/account-balance", detents: [0.5, 1.0] },
  { name: "sheets/holding", detents: [1.0] },
  { name: "sheets/lot", detents: [1.0] },
  { name: "sheets/property", detents: [0.75, 1.0] },
  { name: "sheets/valuation", detents: [0.5, 1.0] },
  { name: "sheets/valuations", detents: [0.6, 1.0] },
  { name: "sheets/mortgage", detents: [1.0] },
  { name: "sheets/rental", detents: [0.6, 1.0] },
  { name: "sheets/cloture", detents: [1.0] },
  { name: "sheets/compass", detents: [0.6, 1.0] },
];

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { resolvedTheme } = useThemeSetting();
  const { isAuthenticated, isLoading, requireAuth } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
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
            title: t("settings.title"),
            presentation: "formSheet",
            sheetGrabberVisible: true,
            sheetAllowedDetents: [1.0],
            headerTransparent: true,
            headerShadowVisible: false,
            headerTitleStyle: { color: palette.text.primary },
            headerTintColor: palette.text.primary,
            contentStyle: { backgroundColor: palette.surface.bg },
          }}
        />
        {SHEET_ROUTES.map((sheet) => (
          <Stack.Screen
            key={sheet.name}
            name={sheet.name}
            options={{
              headerShown: true,
              presentation: "formSheet",
              sheetGrabberVisible: true,
              sheetAllowedDetents: sheet.detents,
              headerTransparent: true,
              headerShadowVisible: false,
              headerTitleStyle: { color: palette.text.primary },
              headerTintColor: palette.text.primary,
              contentStyle: { backgroundColor: palette.surface.bg },
            }}
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
