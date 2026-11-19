import { PekuloRootProvider } from "@pekulo/ui";
import { Text } from "@pekulo/ui/client";
import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import type { ReactNode } from "react";
import { Pressable } from "react-native";

import appConfig from "../app.json";
import LoginScreen from "../app/login";
import { AuthProvider, createMobileQueryClient, useAuth } from "../lib/auth/auth-context";
import {
  mobileQueryKeys,
  useMobileCapData,
  useMobileSettingsData,
} from "../lib/hooks/use-mobile-queries";
import { createMobileOrpcLink, getApiBaseUrl } from "../lib/orpc/client";
import { createMobileOrpcClients, settingsClient } from "../lib/orpc/modules";
import { getSupabaseConfig, isSupabaseConfigured, supabase } from "../lib/supabase/client";
import { CHUNK_SIZE, createChunkedSecureStorage } from "../lib/supabase/secure-storage";

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => {
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    useRouter: () => ({
      replace: mockReplace,
      push: mockPush,
      back: jest.fn(),
    }),
  };
});

// oRPC Proxy clients ignore own-property `jest.spyOn` descriptors; expose spyable
// mock procedures for default module singletons while keeping the real
// `createMobileOrpcClients` factory intact for AC-2 wire-level tests.
jest.mock("../lib/orpc/modules", () => {
  const actual = jest.requireActual("../lib/orpc/modules");
  return {
    ...actual,
    dashboardClient: { getOverview: jest.fn() },
    compassClient: { getCompass: jest.fn() },
    milestonesClient: { list: jest.fn(), getStatuses: jest.fn() },
    accountsClient: { list: jest.fn() },
    transactionsClient: {
      monthSummary: jest.fn(),
      listPendingSuggestions: jest.fn(),
      listTransactions: jest.fn(),
      confirmCategorisation: jest.fn(),
    },
    monthlyClient: { listMonthly: jest.fn() },
    holdingsClient: { list: jest.fn() },
    realestateClient: {
      listProperties: jest.fn(),
      listPropertyDerives: jest.fn(),
      getTotalEquity: jest.fn(),
    },
    settingsClient: {
      get: jest.fn(),
      updateTheme: jest.fn(),
      updateLang: jest.fn(),
    },
  };
});

const FAKE_SESSION: Session = {
  access_token: "jwt-mobile-live-token-155",
  refresh_token: "refresh-token-155",
  expires_in: 3600,
  expires_at: 1999999999,
  token_type: "bearer",
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    aud: "authenticated",
    role: "authenticated",
    email: "alex@pekulo.app",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-05-03T00:00:00Z",
  },
};

const activeQueryClients: ReturnType<typeof createMobileQueryClient>[] = [];

async function renderWithLiveProviders(ui: ReactNode, session: Session | null = FAKE_SESSION) {
  const queryClient = createMobileQueryClient();
  activeQueryClients.push(queryClient);
  const view = await render(
    <QueryClientProvider client={queryClient}>
      <PekuloRootProvider theme="pekulo-dark">
        <AuthProvider initialSession={session} requireAuth={session !== null}>
          {ui}
        </AuthProvider>
      </PekuloRootProvider>
    </QueryClientProvider>,
  );
  return {
    queryClient,
    ...view,
  };
}

describe("10-4 mobile Supabase Auth (expo-secure-store) and @pekulo/contracts oRPC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const internalStore = (
      SecureStore as unknown as Record<string, Map<string, string> | undefined>
    )["__store"];
    internalStore?.clear();
  });

  afterEach(() => {
    for (const qc of activeQueryClients.splice(0)) {
      qc.clear();
    }
  });

  // AC-1 (verbatim from story 10-4-mobile-auth-and-orpc:16):
  //   Given the mobile authentication client backed by chunked device secure storage,
  //   When a user signs in with email and password (including session payloads exceeding
  //   the platform's 2048-byte single-entry limit), Then the session is split, persisted,
  //   and reassembled losslessly, the authentication context exposes the active session
  //   and user email, and signing out purges all stored chunks and clears the client query cache.
  it("persists and reassembles both small (<1800B) and large (>2048B) session payloads in expo-secure-store (AC-1)", async () => {
    expect(appConfig.expo.plugins).toContain("expo-secure-store");
    expect(typeof supabase.auth.getSession).toBe("function");
    expect(isSupabaseConfigured({})).toBe(false);
    expect(
      getSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
      configured: true,
    });

    const storage = createChunkedSecureStorage();

    // 1. Small payload stored directly under key
    await storage.setItem("sb-session-small", '{"token":"short"}');
    expect(await storage.getItem("sb-session-small")).toBe('{"token":"short"}');

    // 2. Large payload (> 2048 bytes, 4200 chars) split into 3 chunks of <= 1800 chars
    const largePayload = JSON.stringify({
      access_token: "a".repeat(2200),
      refresh_token: "r".repeat(1800),
      user: { email: "alex@pekulo.app" },
    });
    expect(largePayload.length).toBeGreaterThan(CHUNK_SIZE * 2);

    await storage.setItem("sb-session-large", largePayload);
    const rawManifest = await SecureStore.getItemAsync("sb-session-large");
    expect(rawManifest).toBe('{"__chunked":true,"count":3}');
    expect(await SecureStore.getItemAsync("sb-session-large__chunk_0")).toHaveLength(CHUNK_SIZE);

    // Reassembles losslessly
    expect(await storage.getItem("sb-session-large")).toBe(largePayload);

    // Missing chunk returns null rather than partial corrupted session
    await SecureStore.deleteItemAsync("sb-session-large__chunk_1");
    expect(await storage.getItem("sb-session-large")).toBeNull();

    // Overwriting with a short value purges old chunks
    await storage.setItem("sb-session-large", largePayload);
    await storage.setItem("sb-session-large", '{"token":"now-short"}');
    expect(await SecureStore.getItemAsync("sb-session-large__chunk_0")).toBeNull();
    expect(await storage.getItem("sb-session-large")).toBe('{"token":"now-short"}');

    // removeItem purges manifest and chunks
    await storage.setItem("sb-session-remove", largePayload);
    await storage.removeItem("sb-session-remove");
    expect(await storage.getItem("sb-session-remove")).toBeNull();
    expect(await SecureStore.getItemAsync("sb-session-remove__chunk_0")).toBeNull();
  });

  // AC-2 (verbatim from story 10-4-mobile-auth-and-orpc:17):
  //   Given an authenticated user session on mobile, When any domain contract client
  //   (dashboard, compass, milestones, accounts, holdings, real-estate, transactions,
  //   monthly, or settings) invokes a remote procedure, Then the request targets the
  //   configured versioned RPC endpoint for that module and procedure and attaches
  //   the active session access token as a Bearer authorization header.
  it("forwards Authorization: Bearer <access_token> to /rpc/v1/<module>/<procedure> on @pekulo/contracts calls (AC-2)", async () => {
    expect(getApiBaseUrl({ EXPO_PUBLIC_API_BASE_URL: "https://api.pekulo.app///" })).toBe(
      "https://api.pekulo.app",
    );

    let capturedUrl = "";
    let capturedAuthHeader: string | null = null;

    const customFetch = jest.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      capturedUrl =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const headers = input instanceof Request ? input.headers : new Headers(init?.headers);
      capturedAuthHeader = headers.get("authorization");
      return new Response(
        JSON.stringify({
          json: {
            theme: "dark",
            lang: "fr",
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as unknown as typeof globalThis.fetch;

    const link = createMobileOrpcLink({
      baseUrl: () => "https://api.pekulo.app",
      tokenResolver: async () => "jwt-test-bearer-999",
      fetch: customFetch,
    });
    const clients = createMobileOrpcClients(link);

    const prefs = await clients.settingsClient.get();
    expect(capturedUrl).toBe("https://api.pekulo.app/rpc/v1/settings/get");
    expect(capturedAuthHeader).toBe("Bearer jwt-test-bearer-999");
    expect(prefs).toEqual({ theme: "dark", lang: "fr" });

    // Unauthenticated call omits Authorization header
    const anonLink = createMobileOrpcLink({
      baseUrl: () => "https://api.pekulo.app",
      tokenResolver: async () => null,
      fetch: customFetch,
    });
    const anonClients = createMobileOrpcClients(anonLink);
    await anonClients.settingsClient.get();
    expect(capturedAuthHeader).toBeNull();
  });

  // AC-3 (verbatim from story 10-4-mobile-auth-and-orpc:18):
  //   Given the mobile root navigation, When authentication enforcement is active and no
  //   session is present, Then unauthenticated users are directed to the sign-in screen
  //   where submitting valid credentials signs in and navigates to the primary dashboard;
  //   And when running in unconfigured local or CI preview mode without a session, screens
  //   degrade gracefully to deterministic preview data so existing navigation and smoke
  //   flows remain green.
  it("validates credentials on /login, signs in via Supabase Auth, and clears cache on sign-out (AC-1, AC-3)", async () => {
    const signInSpy = jest.spyOn(supabase.auth, "signInWithPassword");
    const signOutSpy = jest.spyOn(supabase.auth, "signOut").mockResolvedValue({ error: null });

    function AuthStatusProbe() {
      const { userEmail, isAuthenticated, signOut } = useAuth();
      return (
        <>
          <LoginScreen />
          {isAuthenticated && (
            <>
              <Text testID="probe-email">{userEmail}</Text>
              <Pressable
                testID="probe-signout-btn"
                onPress={() => {
                  void signOut();
                }}
              >
                <Text>Sign out</Text>
              </Pressable>
            </>
          )}
        </>
      );
    }

    const queryClient = createMobileQueryClient();
    activeQueryClients.push(queryClient);
    queryClient.setQueryData(["mobile", "probe"], { cached: true });

    await render(
      <QueryClientProvider client={queryClient}>
        <PekuloRootProvider theme="pekulo-dark">
          <AuthProvider initialSession={null} requireAuth={false}>
            <AuthStatusProbe />
          </AuthProvider>
        </PekuloRootProvider>
      </QueryClientProvider>,
    );

    // 1. Rejects short password (< 12 chars) before hitting Supabase
    await fireEvent.changeText(screen.getByTestId("login-email-input"), "alex@pekulo.app");
    await fireEvent.changeText(screen.getByTestId("login-password-input"), "short123");
    await fireEvent.press(screen.getByTestId("login-submit-btn"));

    expect(screen.getByText("Le mot de passe doit contenir au moins 12 caractères.")).toBeTruthy();
    expect(signInSpy).not.toHaveBeenCalled();

    // 2. Valid 12+ char password calls supabase.auth.signInWithPassword and redirects to "/"
    signInSpy.mockResolvedValueOnce({
      data: { session: FAKE_SESSION, user: FAKE_SESSION.user },
      error: null,
    });

    await fireEvent.changeText(
      screen.getByTestId("login-password-input"),
      "super-secret-password-2026",
    );
    await fireEvent.press(screen.getByTestId("login-submit-btn"));

    await waitFor(() => {
      expect(signInSpy).toHaveBeenCalledWith({
        email: "alex@pekulo.app",
        password: "super-secret-password-2026",
      });
      expect(mockReplace).toHaveBeenCalledWith("/");
      expect(screen.getByTestId("probe-email")).toBeTruthy();
    });

    // 3. Sign out clears session and purges React Query cache
    await fireEvent.press(screen.getByTestId("probe-signout-btn"));
    await waitFor(() => {
      expect(signOutSpy).toHaveBeenCalled();
      expect(screen.queryByTestId("probe-email")).toBeNull();
      expect(queryClient.getQueryData(["mobile", "probe"])).toBeUndefined();
    });

    signInSpy.mockRestore();
    signOutSpy.mockRestore();
  });

  // AC-3 + AC-4 (verbatim from story 10-4-mobile-auth-and-orpc:18-19):
  //   And when running in unconfigured local or CI preview mode without a session, screens
  //   degrade gracefully to deterministic preview data so existing navigation and smoke
  //   flows remain green.
  it("serves deterministic preview data when unauthenticated and live settings mutations when authenticated (AC-3, AC-4)", async () => {
    expect(mobileQueryKeys.cap()).toEqual(["mobile", "cap"]);

    function PreviewProbe() {
      const cap = useMobileCapData();
      const settings = useMobileSettingsData();
      return (
        <>
          <Text testID="preview-progress">{cap.data?.progressLabel ?? "loading"}</Text>
          <Text testID="preview-lang">{settings.prefs.lang}</Text>
        </>
      );
    }

    function LiveSettingsProbe() {
      const settings = useMobileSettingsData();
      return (
        <>
          <Text testID="live-lang">{settings.prefs.lang}</Text>
          <Pressable
            testID="switch-lang-btn"
            onPress={() => {
              void settings.updateLang("en");
            }}
          >
            <Text>EN</Text>
          </Pressable>
        </>
      );
    }

    const previewView = await renderWithLiveProviders(<PreviewProbe />, null);
    await waitFor(() => {
      expect(screen.getByTestId("preview-progress").props.children).toBe("22,6 %");
      expect(screen.getByTestId("preview-lang").props.children).toBe("fr");
    });
    await previewView.unmount();

    const getSpy = jest
      .spyOn(settingsClient, "get")
      .mockResolvedValue({ theme: "dark", lang: "fr" });
    const langSpy = jest
      .spyOn(settingsClient, "updateLang")
      .mockResolvedValue({ theme: "dark", lang: "en" });

    const liveView = await renderWithLiveProviders(<LiveSettingsProbe />, FAKE_SESSION);
    await waitFor(() => {
      expect(getSpy).toHaveBeenCalled();
    });
    await fireEvent.press(screen.getByTestId("switch-lang-btn"));
    await waitFor(() => {
      expect(langSpy).toHaveBeenCalledWith({ lang: "en" });
      expect(screen.getByTestId("live-lang").props.children).toBe("en");
    });
    await liveView.unmount();

    getSpy.mockRestore();
    langSpy.mockRestore();
  });
});

export { renderWithLiveProviders };
