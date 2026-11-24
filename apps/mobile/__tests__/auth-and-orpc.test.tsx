import { PekuloRootProvider } from "@pekulo/ui";
import { Text } from "@pekulo/ui/client";
import { AuthRetryableFetchError, type Session } from "@supabase/supabase-js";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ORPCError } from "@orpc/client";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import type { ReactNode } from "react";
import { Alert, AppState, Pressable } from "react-native";

import appConfig from "../app.json";
import CapScreen from "../app/(tabs)/(cap)/index";
import ImmobilierScreen from "../app/(tabs)/immobilier";
import MensuelScreen from "../app/(tabs)/mensuel";
import PortefeuilleScreen from "../app/(tabs)/portefeuille";
import TransactionsScreen from "../app/(tabs)/transactions";
import LoginScreen from "../app/login";
import ParametresScreen from "../app/parametres";
import RootLayout from "../app/_layout";
import { AuthProvider, createMobileQueryClient, useAuth } from "../lib/auth/auth-context";
import {
  mobileQueryKeys,
  useMobileCapData,
  useMobileSettingsData,
} from "../lib/hooks/use-mobile-queries";
import { createMobileOrpcLink, getAccessToken, getApiBaseUrl } from "../lib/orpc/client";
import {
  accountsClient,
  compassClient,
  createMobileOrpcClients,
  dashboardClient,
  holdingsClient,
  milestonesClient,
  monthlyClient,
  realestateClient,
  settingsClient,
  transactionsClient,
} from "../lib/orpc/modules";
import {
  AUTH_STORAGE_KEY,
  getSupabaseConfig,
  isSupabaseConfigured,
  supabase,
} from "../lib/supabase/client";
import {
  CHUNK_SIZE,
  chunkedSecureStorage,
  createChunkedSecureStorage,
  splitByUtf8Bytes,
} from "../lib/supabase/secure-storage";

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockPathname = "/";

jest.mock("expo-router", () => {
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    usePathname: () => mockPathname,
    useRouter: () => ({
      replace: mockReplace,
      push: mockPush,
      back: jest.fn(),
    }),
  };
});

jest.mock("expo-router/stack", () => {
  const React = require("react") as typeof import("react");
  function MockStack({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  MockStack.Screen = function MockStackScreen() {
    return null;
  };
  MockStack.SearchBar = function MockStackSearchBar() {
    return null;
  };
  // Native toolbar items rendered as plain buttons so tests can press them.
  function MockToolbar({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  MockToolbar.Button = function MockToolbarButton({
    children,
    onPress,
    accessibilityLabel,
    variant,
    disabled,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
    variant?: string;
    disabled?: boolean;
  }) {
    const RN = require("react-native") as typeof import("react-native");
    return React.createElement(
      RN.Pressable,
      {
        accessibilityRole: "button",
        accessibilityLabel,
        disabled,
        onPress,
        testID: variant === "done" ? "sheet-primary-btn" : undefined,
      },
      typeof children === "string" ? React.createElement(RN.Text, null, children) : null,
    );
  };
  MockToolbar.Menu = MockToolbar;
  MockToolbar.MenuAction = MockToolbar.Button;
  MockToolbar.Spacer = function MockSpacer() {
    return null;
  };
  MockStack.Toolbar = MockToolbar;
  return { __esModule: true, default: MockStack };
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
    monthlyClient: { listMonthly: jest.fn(), getMonthly: jest.fn() },
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
    mockPathname = "/";
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
    const manifest = JSON.parse((await SecureStore.getItemAsync("sb-session-large")) ?? "null");
    expect(manifest).toMatchObject({ __chunked: true, count: 3 });
    expect(manifest.id).toMatch(/^[0-9a-z]{8}$/);
    const chunkKeyOf = (m: { id: string }, i: number) => `sb-session-large__chunk_${m.id}_${i}`;
    expect(await SecureStore.getItemAsync(chunkKeyOf(manifest, 0))).toHaveLength(CHUNK_SIZE);

    // Reassembles losslessly
    expect(await storage.getItem("sb-session-large")).toBe(largePayload);

    // Missing chunk returns null rather than partial corrupted session
    await SecureStore.deleteItemAsync(chunkKeyOf(manifest, 1));
    expect(await storage.getItem("sb-session-large")).toBeNull();

    // Overwriting with a short value purges old chunks
    await storage.setItem("sb-session-large", largePayload);
    const second = JSON.parse((await SecureStore.getItemAsync("sb-session-large")) ?? "null");
    await storage.setItem("sb-session-large", '{"token":"now-short"}');
    expect(await SecureStore.getItemAsync(chunkKeyOf(second, 0))).toBeNull();
    expect(await storage.getItem("sb-session-large")).toBe('{"token":"now-short"}');

    // removeItem purges manifest and chunks
    await storage.setItem("sb-session-remove", largePayload);
    const removed = JSON.parse((await SecureStore.getItemAsync("sb-session-remove")) ?? "null");
    await storage.removeItem("sb-session-remove");
    expect(await storage.getItem("sb-session-remove")).toBeNull();
    expect(await SecureStore.getItemAsync(`sb-session-remove__chunk_${removed.id}_0`)).toBeNull();
  });

  it("chunks by UTF-8 BYTES (the platform limit), never splitting a surrogate pair (AC-1)", async () => {
    const storage = createChunkedSecureStorage();
    const payloads = {
      twoByte: "é".repeat(3000),
      threeByte: "日".repeat(2000),
      surrogates: `a${"😀".repeat(1500)}`,
    };
    await Promise.all(
      Object.entries(payloads).map(async ([name, payload]) => {
        const key = `sb-utf8-${name}`;
        await storage.setItem(key, payload);
        const manifest = JSON.parse((await SecureStore.getItemAsync(key)) ?? "null");
        expect(manifest.count).toBeGreaterThan(1);
        const chunks = await Promise.all(
          Array.from(
            { length: manifest.count },
            async (_, i) =>
              (await SecureStore.getItemAsync(`${key}__chunk_${manifest.id}_${i}`)) ?? "",
          ),
        );
        for (const chunk of chunks) {
          expect(new TextEncoder().encode(chunk).length).toBeLessThanOrEqual(CHUNK_SIZE);
          // No lone surrogate: a chunk survives a UTF-8 round trip unchanged.
          expect(new TextDecoder().decode(new TextEncoder().encode(chunk))).toBe(chunk);
        }
        expect(await storage.getItem(key)).toBe(payload);
      }),
    );
    expect(splitByUtf8Bytes("")).toEqual([]);
    expect(splitByUtf8Bytes("a".repeat(CHUNK_SIZE))).toHaveLength(1);
    expect(splitByUtf8Bytes("a".repeat(CHUNK_SIZE + 1))).toHaveLength(2);
  });

  it("keeps the previous session readable when a write is killed before the manifest swap (AC-1)", async () => {
    let failManifest = false;
    const driver = {
      getItemAsync: SecureStore.getItemAsync,
      deleteItemAsync: SecureStore.deleteItemAsync,
      setItemAsync: async (key: string, value: string) => {
        if (failManifest && key === "sb-crash") throw new Error("process killed");
        await SecureStore.setItemAsync(key, value);
      },
    };
    const storage = createChunkedSecureStorage(driver);
    const v1 = JSON.stringify({ token: "1".repeat(4000) });
    const v2 = JSON.stringify({ token: "2".repeat(4000) });

    await storage.setItem("sb-crash", v1);
    failManifest = true;
    await expect(storage.setItem("sb-crash", v2)).rejects.toThrow("process killed");
    failManifest = false;

    expect(await storage.getItem("sb-crash")).toBe(v1);
    await storage.setItem("sb-crash", v2);
    expect(await storage.getItem("sb-crash")).toBe(v2);
  });

  it("still reads and purges sessions stored by the first (id-less) chunk layout (AC-1)", async () => {
    await SecureStore.setItemAsync("sb-legacy__chunk_0", "abc");
    await SecureStore.setItemAsync("sb-legacy__chunk_1", "def");
    await SecureStore.setItemAsync("sb-legacy", '{"__chunked":true,"count":2}');
    const storage = createChunkedSecureStorage();

    expect(await storage.getItem("sb-legacy")).toBe("abcdef");
    await storage.removeItem("sb-legacy");
    expect(await SecureStore.getItemAsync("sb-legacy")).toBeNull();
    expect(await SecureStore.getItemAsync("sb-legacy__chunk_0")).toBeNull();
    expect(await SecureStore.getItemAsync("sb-legacy__chunk_1")).toBeNull();
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

    // Spot-check additional domain contract module paths
    await clients.dashboardClient.getOverview();
    expect(capturedUrl).toBe("https://api.pekulo.app/rpc/v1/dashboard/getOverview");
    expect(capturedAuthHeader).toBe("Bearer jwt-test-bearer-999");

    await clients.realestateClient.getTotalEquity();
    expect(capturedUrl).toBe("https://api.pekulo.app/rpc/v1/realestate/getTotalEquity");
    expect(capturedAuthHeader).toBe("Bearer jwt-test-bearer-999");

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

  it("forwards the Bearer to /rpc/v1/<module>/<procedure> for EVERY domain module (AC-2)", async () => {
    const seen: { url: string; auth: string | null }[] = [];
    const fetchSpy = jest.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const headers = input instanceof Request ? input.headers : new Headers(init?.headers);
      seen.push({
        url:
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
        auth: headers.get("authorization"),
      });
      return new Response(JSON.stringify({ json: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof globalThis.fetch;
    const clients = createMobileOrpcClients(
      createMobileOrpcLink({
        baseUrl: () => "https://api.pekulo.app",
        tokenResolver: async () => "jwt-every-module",
        fetch: fetchSpy,
      }),
    );

    const calls: [string, () => Promise<unknown>][] = [
      ["dashboard/getOverview", () => clients.dashboardClient.getOverview()],
      ["compass/getCompass", () => clients.compassClient.getCompass()],
      ["milestones/list", () => clients.milestonesClient.list()],
      ["accounts/list", () => clients.accountsClient.list()],
      ["holdings/list", () => clients.holdingsClient.list({})],
      ["realestate/getTotalEquity", () => clients.realestateClient.getTotalEquity()],
      ["transactions/listTransactions", () => clients.transactionsClient.listTransactions({})],
      ["monthly/listMonthly", () => clients.monthlyClient.listMonthly({})],
      ["settings/get", () => clients.settingsClient.get()],
    ];
    // Fire every call, then match each request to its procedure by URL.
    await Promise.all(calls.map(([, call]) => call().catch(() => undefined))); // stub body ≠ real output
    expect(seen).toHaveLength(calls.length);
    for (const [path] of calls) {
      const request = seen.find((r) => r.url === `https://api.pekulo.app/rpc/v1/${path}`);
      expect(request).toBeDefined();
      expect(request?.auth).toBe("Bearer jwt-every-module");
    }
  });

  it("refuses the loopback default and cleartext URLs outside development (AC-2)", () => {
    expect(getApiBaseUrl({}, true)).toBe("http://127.0.0.1:3001");
    expect(getApiBaseUrl({ EXPO_PUBLIC_API_BASE_URL: "http://192.168.1.5:3001" }, true)).toBe(
      "http://192.168.1.5:3001",
    );
    expect(() => getApiBaseUrl({}, false)).toThrow("EXPO_PUBLIC_API_BASE_URL is not set");
    expect(() =>
      getApiBaseUrl({ EXPO_PUBLIC_API_BASE_URL: "http://api.pekulo.app" }, false),
    ).toThrow("https://");
    expect(getApiBaseUrl({ EXPO_PUBLIC_API_BASE_URL: "https://api.pekulo.app/" }, false)).toBe(
      "https://api.pekulo.app",
    );
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

    // 1. Rejects invalid email and short password (< 12 chars) before hitting Supabase
    await fireEvent.changeText(screen.getByTestId("login-email-input"), "not-an-email");
    await fireEvent.changeText(
      screen.getByTestId("login-password-input"),
      "super-secret-password-2026",
    );
    await fireEvent.press(screen.getByTestId("login-submit-btn"));
    expect(screen.getByText("Veuillez saisir une adresse e-mail valide.")).toBeTruthy();
    expect(signInSpy).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId("login-email-input"), "alex@pekulo.app");
    await fireEvent.changeText(screen.getByTestId("login-password-input"), "short123");
    await fireEvent.press(screen.getByTestId("login-submit-btn"));

    expect(screen.getByText("Le mot de passe doit contenir au moins 12 caractères.")).toBeTruthy();
    expect(signInSpy).not.toHaveBeenCalled();

    // 1b. Surfaces Supabase authentication errors on rejected credentials
    signInSpy.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials" } as never,
    });
    await fireEvent.changeText(
      screen.getByTestId("login-password-input"),
      "wrong-secret-password-2026",
    );
    await fireEvent.press(screen.getByTestId("login-submit-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("login-error-msg").props.children).toBe("Identifiants invalides.");
    });

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

  // AC-4 (verbatim from story 10-4-mobile-auth-and-orpc:19):
  //   Given an authenticated mobile session with live remote responses, When the user
  //   visits `Cap` (including the `Cap` and `Patrimoine` view toggle), `Transactions`
  //   (with one-tap AI category suggestion confirmation), `Mensuel`, `Portefeuille`,
  //   `Immobilier`, and `Paramètres` (theme and language controls plus sign-out),
  //   Then each screen renders the live domain figures through the shared native
  //   design-system components and reflects mutations immediately.
  it("renders live oRPC data on Cap (including Patrimoine toggle), Transactions (with suggestion confirm), Mensuel, Portefeuille, Immobilier, and Paramètres (AC-4)", async () => {
    jest.spyOn(dashboardClient, "getOverview").mockResolvedValue({
      totalWealthEur: 245000,
      composition: {
        liquideEur: 35000,
        placementsEur: 120000,
        immobilierEur: 90000,
      },
      compass: {
        percent: 24.5,
        objectif: 1000000,
        gap: 755000,
        currentWealth: 155000,
      },
      fx: { source: "live", asOf: "2026-11-19" },
      recentActivity: [
        {
          label: "Dividende ETF World",
          account: "PEA Bourse Direct",
          category: "bonus",
          direction: "in",
          amountEur: 420,
          logoUrl: null,
        },
      ],
    });
    jest.spyOn(compassClient, "getCompass").mockResolvedValue({
      objectif: 1000000,
      horizonYears: 25,
    });
    jest.spyOn(milestonesClient, "list").mockResolvedValue([
      {
        id: "mst_123456789012345678901",
        userId: FAKE_SESSION.user.id,
        targetCapital: 250000,
        targetYear: 2030,
        label: "Cap Quart de Million",
        position: 0,
        createdAt: new Date("2026-05-03T00:00:00Z"),
        updatedAt: new Date("2026-05-03T00:00:00Z"),
      },
    ]);
    jest.spyOn(milestonesClient, "getStatuses").mockResolvedValue([
      {
        id: "mst_123456789012345678901",
        status: "ahead",
        expectedAt: 140000,
        delta: -15000,
      },
    ]);
    jest.spyOn(accountsClient, "list").mockResolvedValue([
      {
        id: "acc_123456789012345678901",
        userId: FAKE_SESSION.user.id,
        label: "PEA Bourse Direct",
        type: "pea",
        currency: "EUR",
        cashBalance: 35000,
        notes: null,
        createdAt: new Date("2026-05-03T00:00:00Z"),
        updatedAt: new Date("2026-05-03T00:00:00Z"),
      },
    ]);

    // 1. Cap screen + Patrimoine top-tab toggle
    const capView = await renderWithLiveProviders(<CapScreen />);
    await waitFor(() => {
      expect(screen.getByText("24,5 %")).toBeTruthy();
      expect(screen.getByText("250 k€ · 2030")).toBeTruthy();
      expect(screen.getByText("Cap Quart de Million")).toBeTruthy();
      expect(screen.getByText("Dividende ETF World")).toBeTruthy();
    });

    await fireEvent.press(screen.getByText("Patrimoine"));
    await waitFor(() => {
      expect(screen.getByText("PEA Bourse Direct")).toBeTruthy();
    });
    await capView.unmount();

    // 2. Transactions screen + 1-tap AI suggestion confirmation
    jest.spyOn(transactionsClient, "monthSummary").mockResolvedValue({
      month: "2026-11",
      incomeEur: 4500,
      spendingEur: 1800,
      netChangeEur: 2700,
    });
    jest.spyOn(transactionsClient, "listPendingSuggestions").mockResolvedValue({
      items: [
        {
          id: "tx_123456789012345678901",
          accountId: "acc_123456789012345678901",
          occurredOn: "2026-11-18",
          label: "Boulangerie Paul",
          amount: 14,
          type: "outflow",
          category: "autre",
          isImprevu: false,
          notes: null,
          transferPairId: null,
          suggestedCategory: "restauration",
          suggestedConfidence: 0.92,
          suggestedRoute: "ollama",
          suggestedAt: "2026-11-18T10:00:00Z",
          logoUrl: null,
          createdAt: "2026-11-18T10:00:00Z",
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });
    jest.spyOn(transactionsClient, "listTransactions").mockResolvedValue({
      items: [
        {
          id: "tx_223456789012345678902",
          accountId: "acc_123456789012345678901",
          occurredOn: "2026-11-15",
          label: "Salaire Novembre",
          amount: 4500,
          type: "inflow",
          category: "salaire",
          isImprevu: false,
          notes: null,
          transferPairId: null,
          createdAt: "2026-11-15T08:00:00Z",
        },
      ],
      nextCursor: null,
    });
    const confirmSpy = jest.spyOn(transactionsClient, "confirmCategorisation").mockResolvedValue({
      id: "tx_123456789012345678901",
      accountId: "acc_123456789012345678901",
      occurredOn: "2026-11-18",
      label: "Boulangerie Paul",
      amount: 14,
      type: "outflow",
      category: "restauration",
      isImprevu: false,
      notes: null,
      transferPairId: null,
      createdAt: "2026-11-18T10:00:00Z",
    });

    const txView = await renderWithLiveProviders(<TransactionsScreen />);
    await waitFor(() => {
      expect(screen.getByText("Boulangerie Paul")).toBeTruthy();
      expect(screen.getByText("Salaire Novembre")).toBeTruthy();
    });

    await fireEvent.press(screen.getByText("✓ Confirmer"));
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith({
        id: "tx_123456789012345678901",
        category: "restauration",
      });
    });
    await txView.unmount();

    // 3. Mensuel screen
    jest.spyOn(monthlyClient, "listMonthly").mockResolvedValue({
      items: [
        {
          source: "persisted",
          record: {
            id: "mr_123456789012345678901",
            year: 2026,
            monthNum: 11,
            incomeEur: 4500,
            spendingEur: 1800,
            transfersEur: 1000,
            netChangeEur: 2700,
            signedOffAt: "2026-11-30T00:00:00Z",
            createdAt: "2026-11-01T00:00:00Z",
          },
        },
      ],
    });

    jest.spyOn(monthlyClient, "getMonthly").mockResolvedValue({
      source: "derived",
      record: {
        year: 2026,
        monthNum: 11,
        incomeEur: 4500,
        spendingEur: 1800,
        transfersEur: 1000,
        netChangeEur: 2700,
        signedOffAt: null,
      },
    });

    const monthlyView = await renderWithLiveProviders(<MensuelScreen />);
    await waitFor(() => {
      expect(screen.getByText("nov. 2026")).toBeTruthy();
      expect(screen.getByText("Clôturé")).toBeTruthy();
    });
    await monthlyView.unmount();

    // 4. Portefeuille screen
    jest.spyOn(holdingsClient, "list").mockResolvedValue([
      {
        id: "hld_123456789012345678901",
        userId: FAKE_SESSION.user.id,
        accountId: "acc_123456789012345678901",
        kind: "etf",
        ticker: "VWCE.DE",
        isin: null,
        label: "Vanguard FTSE All-World",
        currency: "EUR",
        quantity: 100,
        avgCost: 100,
        lastPrice: 125,
        lastPriceAt: new Date("2026-11-19T00:00:00Z"),
        notes: null,
        createdAt: new Date("2026-05-03T00:00:00Z"),
        updatedAt: new Date("2026-11-19T00:00:00Z"),
        closedAt: null,
      },
    ]);

    const pfView = await renderWithLiveProviders(<PortefeuilleScreen />);
    await waitFor(() => {
      expect(screen.getByText("VWCE.DE")).toBeTruthy();
      expect(screen.getByText("Vanguard FTSE All-World · PEA Bourse Direct")).toBeTruthy();
    });
    await pfView.unmount();

    // 5. Immobilier screen
    jest.spyOn(realestateClient, "listProperties").mockResolvedValue([
      {
        id: "res_123456789012345678901",
        userId: FAKE_SESSION.user.id,
        label: "Loft Bordeaux Chartrons",
        propertyType: "residence-principale",
        currentValuation: 380000,
        lastValuedOn: new Date("2026-11-01T00:00:00Z"),
        createdAt: new Date("2026-05-03T00:00:00Z"),
        updatedAt: new Date("2026-11-01T00:00:00Z"),
      },
    ]);
    jest.spyOn(realestateClient, "listPropertyDerives").mockResolvedValue([
      {
        propertyId: "res_123456789012345678901",
        monthlyCashFlowEur: null,
        netEquityEur: 190000,
      },
    ]);
    jest.spyOn(realestateClient, "getTotalEquity").mockResolvedValue({
      totalEquityEur: 190000,
      perProperty: [{ propertyId: "res_123456789012345678901", netEquityEur: 190000 }],
    });

    const immoView = await renderWithLiveProviders(<ImmobilierScreen />);
    await waitFor(() => {
      expect(screen.getByText("Loft Bordeaux Chartrons")).toBeTruthy();
      expect(screen.getByText("50% remboursé")).toBeTruthy();
    });
    await immoView.unmount();

    // 6. Paramètres screen theme + language switch + sign-out
    jest.spyOn(settingsClient, "get").mockResolvedValue({ theme: "dark", lang: "fr" });
    const updateThemeSpy = jest
      .spyOn(settingsClient, "updateTheme")
      .mockResolvedValue({ theme: "light", lang: "fr" });
    const updateLangSpy = jest
      .spyOn(settingsClient, "updateLang")
      .mockResolvedValue({ theme: "light", lang: "en" });
    const signOutSpy = jest.spyOn(supabase.auth, "signOut").mockResolvedValue({ error: null });

    const settingsView = await renderWithLiveProviders(<ParametresScreen />);
    await waitFor(() => {
      expect(screen.getByText("alex@pekulo.app")).toBeTruthy();
    });

    await fireEvent.press(screen.getByText("Clair"));
    await waitFor(() => {
      expect(updateThemeSpy).toHaveBeenCalledWith({ theme: "light" });
    });

    await fireEvent.press(screen.getByText("English"));
    await waitFor(() => {
      expect(updateLangSpy).toHaveBeenCalledWith({ lang: "en" });
    });

    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      const destructive = buttons?.find((btn) => btn.style === "destructive");
      destructive?.onPress?.();
    });

    await fireEvent.press(screen.getByTestId("settings-auth-action-btn"));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Se déconnecter ?",
        expect.any(String),
        expect.any(Array),
      );
      expect(signOutSpy).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });

    await settingsView.unmount();
    alertSpy.mockRestore();
    signOutSpy.mockRestore();
  });

  it("shows loading skeleton and retryable error state on authenticated CapScreen instead of fake preview balances (AC-4)", async () => {
    const overviewSpy = jest
      .spyOn(dashboardClient, "getOverview")
      .mockRejectedValueOnce(new Error("API unavailable"));
    jest.spyOn(compassClient, "getCompass").mockResolvedValue(null);
    jest.spyOn(milestonesClient, "list").mockResolvedValue([]);
    jest.spyOn(accountsClient, "list").mockResolvedValue([]);

    const view = await renderWithLiveProviders(<CapScreen />, FAKE_SESSION);
    await waitFor(() => {
      expect(screen.getByText("Impossible de charger votre cap")).toBeTruthy();
      expect(screen.getByText("Réessayer")).toBeTruthy();
      expect(screen.queryByText("180 400 €")).toBeNull();
    });

    overviewSpy.mockResolvedValueOnce({
      totalWealthEur: 200000,
      composition: { liquideEur: 50000, placementsEur: 150000, immobilierEur: 0 },
      compass: { percent: 25, objectif: 800000, gap: 600000, currentWealth: 200000 },
      fx: { source: "live", asOf: "2026-11-19" },
      recentActivity: [],
    });
    await fireEvent.press(screen.getByText("Réessayer"));
    await waitFor(() => {
      expect(screen.getByText("25,0 %")).toBeTruthy();
    });

    await view.unmount();
  });

  // AC-3 (verbatim from story 10-4-mobile-auth-and-orpc:18):
  //   Given the mobile root navigation, When authentication enforcement is active and no
  //   session is present, Then unauthenticated users are directed to the sign-in screen
  //   where submitting valid credentials signs in and navigates to the primary dashboard;
  it("redirects unauthenticated users to /login when Supabase Auth enforcement is active (AC-3)", async () => {
    const prevUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const prevKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const getSessionSpy = jest.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const unsubscribe = jest.fn();
    const onAuthSpy = jest.spyOn(supabase.auth, "onAuthStateChange").mockReturnValue({
      data: { subscription: { id: "sub-1", callback: jest.fn(), unsubscribe } },
    });

    try {
      mockPathname = "/";
      const view = await render(<RootLayout />);
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/login");
      });
      await view.unmount();
      expect(unsubscribe).toHaveBeenCalled();
    } finally {
      if (prevUrl === undefined) {
        delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      } else {
        process.env.EXPO_PUBLIC_SUPABASE_URL = prevUrl;
      }
      if (prevKey === undefined) {
        delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      } else {
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = prevKey;
      }
      getSessionSpy.mockRestore();
      onAuthSpy.mockRestore();
    }
  });

  it("allows unauthenticated /ds/* routes only when EXPO_PUBLIC_DS_GALLERY=1 (10-5 AC-4)", async () => {
    const prevUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const prevKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const prevGallery = process.env.EXPO_PUBLIC_DS_GALLERY;
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const getSessionSpy = jest.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const onAuthSpy = jest.spyOn(supabase.auth, "onAuthStateChange").mockReturnValue({
      data: { subscription: { id: "sub-ds", callback: jest.fn(), unsubscribe: jest.fn() } },
    });

    try {
      process.env.EXPO_PUBLIC_DS_GALLERY = "1";
      mockPathname = "/ds/PekuloStat.gain";
      const allowedView = await render(<RootLayout />);
      await waitFor(() => {
        expect(getSessionSpy).toHaveBeenCalled();
      });
      expect(mockReplace).not.toHaveBeenCalled();
      await allowedView.unmount();

      delete process.env.EXPO_PUBLIC_DS_GALLERY;
      const blockedView = await render(<RootLayout />);
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/login");
      });
      await blockedView.unmount();
    } finally {
      if (prevUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      else process.env.EXPO_PUBLIC_SUPABASE_URL = prevUrl;
      if (prevKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = prevKey;
      if (prevGallery === undefined) delete process.env.EXPO_PUBLIC_DS_GALLERY;
      else process.env.EXPO_PUBLIC_DS_GALLERY = prevGallery;
      getSessionSpy.mockRestore();
      onAuthSpy.mockRestore();
    }
  });
});

export { renderWithLiveProviders };

describe("10-4 session lifecycle — sign-out purge, token refresh, expired sessions", () => {
  const internalStore = () =>
    (SecureStore as unknown as { __store: Map<string, string> })["__store"] as Map<string, string>;
  const storedAuthKeys = () =>
    [...internalStore().keys()].filter((key) => key.startsWith(AUTH_STORAGE_KEY));

  let auth!: ReturnType<typeof useAuth>;
  function Capture() {
    auth = useAuth();
    return null;
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    internalStore().clear();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    for (const qc of activeQueryClients.splice(0)) qc.clear();
  });

  function configureSupabase() {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    jest
      .spyOn(supabase.auth, "onAuthStateChange")
      .mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } } as never);
  }

  const bigSession = () =>
    JSON.stringify({ access_token: "a".repeat(2200), refresh_token: "r".repeat(1800) });

  it("sign-out purges the manifest and EVERY chunk when the revoke call fails offline (AC-1)", async () => {
    await chunkedSecureStorage.setItem(AUTH_STORAGE_KEY, bigSession());
    expect(storedAuthKeys().length).toBeGreaterThan(1);
    // supabase-js RESOLVES with { error } (it does not reject) and keeps the stored session.
    const signOutSpy = jest
      .spyOn(supabase.auth, "signOut")
      .mockResolvedValue({ error: new AuthRetryableFetchError("offline", 0) });

    await renderWithLiveProviders(<Capture />);
    expect(auth.isAuthenticated).toBe(true);
    await act(async () => {
      await auth.signOut();
    });

    expect(signOutSpy).toHaveBeenCalled();
    expect(storedAuthKeys()).toEqual([]);
    expect(auth.isAuthenticated).toBe(false);
  });

  it("sign-out purges the stored session when the revoke call throws, and clears the query cache (AC-1)", async () => {
    await chunkedSecureStorage.setItem(AUTH_STORAGE_KEY, bigSession());
    jest.spyOn(supabase.auth, "signOut").mockRejectedValue(new Error("boom"));

    const { queryClient } = await renderWithLiveProviders(<Capture />);
    queryClient.setQueryData(["cached"], { secret: true });
    await act(async () => {
      await auth.signOut();
    });

    expect(storedAuthKeys()).toEqual([]);
    expect(queryClient.getQueryData(["cached"])).toBeUndefined();
  });

  it("reads the access token at request time through supabase (refreshing it), falling back to state (AC-2)", async () => {
    configureSupabase();
    const getSession = jest.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: { ...FAKE_SESSION, access_token: "refreshed-token" } },
      error: null,
    } as never);

    await renderWithLiveProviders(<Capture />);
    expect(await getAccessToken()).toBe("refreshed-token");
    expect(getSession).toHaveBeenCalled();

    getSession.mockResolvedValue({ data: { session: null }, error: null } as never);
    expect(await getAccessToken()).toBe(FAKE_SESSION.access_token);
  });

  it("starts and stops supabase auto-refresh with the app state, and unsubscribes on unmount (AC-1)", async () => {
    configureSupabase();
    jest.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: FAKE_SESSION },
      error: null,
    } as never);
    const start = jest.spyOn(supabase.auth, "startAutoRefresh").mockResolvedValue(undefined);
    const stop = jest.spyOn(supabase.auth, "stopAutoRefresh").mockResolvedValue(undefined);
    const remove = jest.fn();
    let onChange: ((state: string) => void) | undefined;
    jest.spyOn(AppState, "addEventListener").mockImplementation(((
      _type: string,
      handler: (state: string) => void,
    ) => {
      onChange = handler;
      return { remove };
    }) as never);

    const view = await renderWithLiveProviders(<Capture />);
    expect(onChange).toBeDefined();
    onChange?.("background");
    expect(stop).toHaveBeenCalledTimes(1);
    onChange?.("active");
    expect(start).toHaveBeenCalledTimes(1);

    await view.unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("signs the user out when the API answers 401, but not for other failures (AC-1, AC-3)", async () => {
    const signOutSpy = jest.spyOn(supabase.auth, "signOut").mockResolvedValue({ error: null });
    function Probe({ status }: { status: number }) {
      useQuery({
        queryKey: ["probe", status],
        queryFn: async () => {
          throw status === 401
            ? new ORPCError("UNAUTHORIZED", { status: 401 })
            : new ORPCError("INTERNAL_SERVER_ERROR", { status });
        },
      });
      const { isAuthenticated } = useAuth();
      return <Text testID="probe-auth">{isAuthenticated ? "in" : "out"}</Text>;
    }

    const serverError = await renderWithLiveProviders(<Probe status={500} />);
    await waitFor(() => expect(serverError.queryClient.isFetching()).toBe(0));
    expect(screen.getByTestId("probe-auth").props.children).toBe("in");
    expect(signOutSpy).not.toHaveBeenCalled();
    await serverError.unmount();

    await renderWithLiveProviders(<Probe status={401} />);
    await waitFor(() => expect(screen.getByTestId("probe-auth").props.children).toBe("out"));
    expect(signOutSpy).toHaveBeenCalledTimes(1);
  });
});
