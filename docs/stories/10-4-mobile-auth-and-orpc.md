# Story: 10-4-mobile-auth-and-orpc — Wire Supabase Auth (`expo-secure-store`) and `@pekulo/contracts` oRPC client in `apps/mobile`

**Epic:** Epic 10 — Design system parity (V1.5)
**Status:** in-progress
**Ticket:** #155
**Branch:** feature/155-10-4-mobile-auth-and-orpc
**Complexity:** L
**Covered FRs:** FR-46, FR-56 (live mobile data; also wires mobile surfaces for FR-47 sign-out and FR-51/FR-52 theme/language sync via `@pekulo/contracts`)

## User Story

**As a** Pekulo user, **I want** to sign in on mobile with my session persisted in `expo-secure-store` and view my live Cap, Transactions, Mensuel, Portefeuille, Immobilier, and Paramètres data via `@pekulo/contracts` oRPC clients, **so that** my mobile app mirrors my live Pekulo account across devices with zero design-system divergence.

## Acceptance Criteria

- **AC-1 (Chunked secure-store session persistence & auth lifecycle)** — **Given** the mobile authentication client backed by chunked device secure storage, **When** a user signs in with email and password (including session payloads exceeding the platform's 2048-byte single-entry limit), **Then** the session is split, persisted, and reassembled losslessly, the authentication context exposes the active session and user email, and signing out purges all stored chunks and clears the client query cache.
- **AC-2 (Typed domain contract client with Bearer JWT forwarding)** — **Given** an authenticated user session on mobile, **When** any domain contract client (dashboard, compass, milestones, accounts, holdings, real-estate, transactions, monthly, or settings) invokes a remote procedure, **Then** the request targets the configured versioned RPC endpoint for that module and procedure and attaches the active session access token as a Bearer authorization header.
- **AC-3 (Authentication screen & route gating with seamless preview fallback)** — **Given** the mobile root navigation, **When** authentication enforcement is active and no session is present, **Then** unauthenticated users are directed to the sign-in screen where submitting valid credentials signs in and navigates to the primary dashboard; **And** when running in unconfigured local or CI preview mode without a session, screens degrade gracefully to deterministic preview data so existing navigation and smoke flows remain green.
- **AC-4 (Live domain data across all five primary tabs and settings)** — **Given** an authenticated mobile session with live remote responses, **When** the user visits `Cap` (including the `Cap` and `Patrimoine` view toggle), `Transactions` (with one-tap AI category suggestion confirmation), `Mensuel`, `Portefeuille`, `Immobilier`, and `Paramètres` (theme and language controls plus sign-out), **Then** each screen renders the live domain figures through the shared native design-system components and reflects mutations immediately.
- **AC-5 (Automated mobile test suite & full monorepo quality gates)** — **Given** the unit and integration test suites covering chunked secure storage, Bearer header forwarding, sign-in and sign-out flows, and live data rendering across all five tabs and settings, **When** the mobile tests, design-system tests, typechecking, linting, formatting, and stylesheet freshness checks execute, **Then** every check exits 0 with zero web snapshot or stylesheet regressions.
- **AC-6 (Web interaction parity on mobile)** — **Given** an authenticated mobile session, **When** the user creates, edits, or deletes a transaction (with month navigation and AI category override), adds or deletes a milestone, creates, edits, re-balances, or deletes an account, adds a holding, records a lot, or closes a holding, creates a property, records a valuation, views the valuation history, attaches or updates a mortgage or a rental, or deletes a property, signs off the current month inside its close window or reopens a signed-off month, edits the compass objective and horizon, toggles the third-party AI opt-in, or deletes the account, **Then** each action calls the matching `@pekulo/contracts` procedure with input validated by the shared `@pekulo/validators` schema through native iOS sheets, action sheets, and destructive confirmations, the affected screens refresh immediately, **And** in unauthenticated preview mode every mutation is blocked with a sign-in prompt and no remote call.

## Tasks

Task order is load-bearing: **dependencies & Jest wiring (T1)**, **Supabase chunked SecureStore (T2)**, and **oRPC client/modules (T3)** must land before **AuthProvider + `/login` + `_layout.tsx` (T4)**, **React Query hooks (T5)**, **live screens (T6)**, **integration tests (T7)**, and **full monorepo sweep (T8)**. Follow every command literally.

- [x] **T1 — Add mobile Auth/oRPC dependencies (`expo-secure-store`, `@supabase/supabase-js`, `@orpc/client`, `@orpc/contract`, `@pekulo/contracts`, `@pekulo/validators`, `@tanstack/react-query`) and update Expo/Jest configuration** [AC: AC-1, AC-2, AC-5]

  Replace `apps/mobile/package.json` with:

  ```json
  {
    "name": "@pekulo/mobile",
    "version": "0.1.0",
    "private": true,
    "main": "expo-router/entry",
    "scripts": {
      "dev": "expo start --dev-client",
      "dev:go": "expo start --go",
      "ios": "expo run:ios",
      "ios:device": "expo run:ios --device",
      "android": "expo run:android",
      "prebuild": "expo prebuild",
      "typecheck": "tsc --noEmit",
      "lint": "bunx oxlint app components lib __tests__",
      "test": "jest"
    },
    "dependencies": {
      "@expo-google-fonts/geist": "^0.4.2",
      "@expo-google-fonts/geist-mono": "^0.4.3",
      "@orpc/client": "1.14.1",
      "@orpc/contract": "1.14.1",
      "@pekulo/contracts": "workspace:*",
      "@pekulo/types": "workspace:*",
      "@pekulo/ui": "workspace:*",
      "@pekulo/validators": "workspace:*",
      "@react-native-community/datetimepicker": "9.2.1",
      "@react-native-picker/picker": "2.11.4",
      "@react-navigation/native": "^7.1.6",
      "@supabase/supabase-js": "^2.104.1",
      "@tanstack/react-query": "^5.100.5",
      "expo": "~58.0.25",
      "expo-constants": "~58.0.16",
      "expo-dev-client": "~58.0.20",
      "expo-font": "~58.0.12",
      "expo-linking": "~58.0.17",
      "expo-router": "~58.0.31",
      "expo-secure-store": "~58.0.3",
      "expo-splash-screen": "~58.0.14",
      "expo-status-bar": "~58.0.5",
      "expo-symbols": "~58.0.5",
      "expo-system-ui": "~58.0.7",
      "lucide-react-native": "^1.73.0",
      "react": "19.3.0",
      "react-native": "0.88.1",
      "react-native-gesture-handler": "~3.3.0",
      "react-native-reanimated": "4.7.1",
      "react-native-safe-area-context": "~5.11.1",
      "react-native-screens": "~4.30.1",
      "react-native-svg": "15.16.0",
      "react-native-worklets": "0.13.0",
      "tamagui": "2.3.1"
    },
    "devDependencies": {
      "@babel/core": "^7.29.7",
      "@pekulo/tsconfig": "workspace:*",
      "@tamagui/babel-plugin": "2.3.1",
      "@tamagui/metro-plugin": "2.3.1",
      "@testing-library/react-native": "^14.1.0",
      "@types/jest": "30.0.0",
      "@types/react": "~19.3.0",
      "babel-plugin-transform-inline-environment-variables": "^0.4.4",
      "jest": "~30.5.2",
      "jest-expo": "~58.0.14",
      "react-test-renderer": "19.3.0",
      "test-renderer": "^1.3.1",
      "typescript": "^6.0.3"
    }
  }
  ```

  Replace `apps/mobile/app.json` with:

  ```json
  {
    "expo": {
      "name": "Pekulo",
      "slug": "pekulo",
      "version": "0.1.0",
      "scheme": "pekulo",
      "orientation": "portrait",
      "userInterfaceStyle": "automatic",
      "backgroundColor": "#000000",
      "ios": {
        "supportsTablet": true,
        "bundleIdentifier": "app.pekulo.mobile"
      },
      "android": {
        "package": "app.pekulo.mobile",
        "softwareKeyboardLayoutMode": "resize",
        "adaptiveIcon": {
          "backgroundColor": "#000000"
        }
      },
      "plugins": [
        "expo-router",
        "expo-dev-client",
        "expo-font",
        "expo-secure-store",
        [
          "expo-splash-screen",
          {
            "backgroundColor": "#000000",
            "dark": {
              "backgroundColor": "#000000"
            }
          }
        ]
      ],
      "experiments": {
        "typedRoutes": true,
        "reactCompiler": true
      }
    }
  }
  ```

  Replace `apps/mobile/jest.config.js` with:

  ```js
  const path = require("node:path");

  const babelRuntimeDir = path.dirname(
    require.resolve("@babel/runtime/package.json", {
      paths: [require.resolve("react-native/package.json")],
    }),
  );
  const reactNativeEntry = require.resolve("react-native");
  const reanimatedEntry = require.resolve("react-native-reanimated");
  const workletsEntry = require.resolve("react-native-worklets");
  const svgEntry = require.resolve("react-native-svg");
  const lucideNativeEntry = require.resolve("lucide-react-native");
  const dateTimePickerEntry = require.resolve("@react-native-community/datetimepicker");
  const pickerEntry = require.resolve("@react-native-picker/picker");
  const secureStoreEntry = require.resolve("expo-secure-store");

  /** @type {import("jest").Config} */
  module.exports = {
    preset: "jest-expo",
    testTimeout: 20000,
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    testMatch: ["<rootDir>/__tests__/**/*.test.{ts,tsx}"],
    moduleNameMapper: {
      "^@babel/runtime/(.*)$": `${babelRuntimeDir}/$1`,
      "^react-native$": reactNativeEntry,
      "^react-native-reanimated$": reanimatedEntry,
      "^react-native-worklets$": workletsEntry,
      "^react-native-svg$": svgEntry,
      "^lucide-react-native$": lucideNativeEntry,
      "^@react-native-community/datetimepicker$": dateTimePickerEntry,
      "^@react-native-picker/picker$": pickerEntry,
      "^expo-secure-store$": secureStoreEntry,
      "^@pekulo/ui$": "<rootDir>/../../packages/ui/src/index.native.ts",
      "^@pekulo/ui/client$": "<rootDir>/../../packages/ui/src/client.ts",
      "^@pekulo/ui/tamagui-config$": "<rootDir>/../../packages/ui/src/config/tamagui.ts",
      "^@pekulo/contracts$": "<rootDir>/../../packages/contracts/src/index.ts",
      "^@pekulo/validators$": "<rootDir>/../../packages/validators/src/index.ts",
      "^@pekulo/types$": "<rootDir>/../../packages/types/src/index.ts",
      "^@pekulo/zod$": "<rootDir>/../../packages/zod/src/index.ts",
      "^@/(.*)$": "<rootDir>/$1",
    },
    transformIgnorePatterns: [
      "node_modules/(?!((?:\\.bun/[^/]+/node_modules/)?(?:(jest-)?react-native|@react-native(-community)?|@react-native-picker/.*|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|standard-navigation|lucide-react-native|react-native-svg|@orpc/.*|@supabase/.*|@tanstack/.*|tamagui|@tamagui/.*|@pekulo/.*)))",
    ],
  };
  ```

  Update `apps/mobile/jest.setup.ts` to append the deterministic in-memory `expo-secure-store` mock at the bottom:

  ```ts
  // apps/mobile/jest.setup.ts
  // Mock Worklets + Reanimated v4 for Jest unit/navigation tests without a native runtime.
  // `initializers.native.ts` calls `JSReanimated.setCSSEventHandler`, which is unimplemented
  // in Reanimated 4.7.1's JS mock — stubbing `src/initializers` lets `react-native-reanimated/mock`
  // load cleanly both here and inside `expo-router/testing-library/mocks`.
  jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
  jest.mock("react-native-reanimated/src/initializers", () => ({
    initializeReanimatedModule: () => {},
  }));

  jest.mock("react-native-reanimated", () => {
    const Reanimated = require("react-native-reanimated/mock");
    Reanimated.default.call = () => {};
    return Reanimated;
  });

  // Ensure expo-font resolves immediately in tests.
  jest.mock("expo-font", () => ({
    useFonts: jest.fn(() => [true, null]),
    isLoaded: () => true,
    loadAsync: jest.fn().mockResolvedValue(undefined),
  }));

  jest.mock("expo-splash-screen", () => ({
    preventAutoHideAsync: jest.fn().mockResolvedValue(true),
    hideAsync: jest.fn().mockResolvedValue(true),
  }));

  jest.mock("expo-secure-store", () => {
    const store = new Map<string, string>();
    return {
      __esModule: true,
      __store: store,
      getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
      setItemAsync: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      deleteItemAsync: jest.fn(async (key: string) => {
        store.delete(key);
      }),
    };
  });

  jest.mock("@react-native-community/datetimepicker", () => {
    const React = require("react") as typeof import("react");
    const { View, Pressable, Text } = require("react-native") as typeof import("react-native");

    const DateTimePickerAndroid = {
      open: jest.fn(),
      dismiss: jest.fn().mockResolvedValue(true),
    };

    function MockDateTimePicker({
      value,
      onChange,
      onValueChange,
      onDismiss,
      disabled,
      testID,
      accessibilityLabel,
    }: {
      value: Date;
      onChange?: (
        event: { type: string; nativeEvent: { timestamp: number; utcOffset: number } },
        date?: Date,
      ) => void;
      onValueChange?: (
        event: { nativeEvent: { timestamp: number; utcOffset: number } },
        date: Date,
      ) => void;
      onDismiss?: () => void;
      disabled?: boolean;
      testID?: string;
      accessibilityLabel?: string;
    }) {
      const tid = testID ?? "native-datetimepicker";
      const nextDate = new Date(value.getTime() + 24 * 60 * 60 * 1000);
      return React.createElement(
        View,
        null,
        React.createElement(
          Pressable,
          {
            testID: tid,
            disabled,
            accessibilityLabel,
            onPress: () => {
              if (disabled) return;
              const nativeEvent = { timestamp: nextDate.getTime(), utcOffset: 0 };
              if (onValueChange) {
                onValueChange({ nativeEvent }, nextDate);
              } else {
                onChange?.({ type: "set", nativeEvent }, nextDate);
              }
            },
          },
          React.createElement(Text, null, value.toISOString()),
        ),
        React.createElement(
          Pressable,
          {
            testID: `${tid}-dismiss`,
            disabled,
            onPress: () => {
              if (disabled) return;
              if (onDismiss) {
                onDismiss();
              } else {
                onChange?.(
                  { type: "dismissed", nativeEvent: { timestamp: value.getTime(), utcOffset: 0 } },
                  value,
                );
              }
            },
          },
          React.createElement(Text, null, "Annuler"),
        ),
      );
    }

    return {
      __esModule: true,
      default: MockDateTimePicker,
      DateTimePickerAndroid,
    };
  });

  jest.mock("@react-native-picker/picker", () => {
    const React = require("react") as typeof import("react");
    const { View, Pressable, Text } = require("react-native") as typeof import("react-native");
    function MockPicker({
      children,
      selectedValue,
      onValueChange,
      enabled = true,
      testID,
      accessibilityLabel,
    }: {
      children?: React.ReactNode;
      selectedValue?: string;
      onValueChange?: (value: string, index: number) => void;
      enabled?: boolean;
      testID?: string;
      accessibilityLabel?: string;
    }) {
      return React.createElement(
        View,
        {
          testID: testID ?? "native-picker",
          accessibilityLabel,
          accessibilityState: { disabled: !enabled },
          accessibilityValue: { text: selectedValue },
        },
        React.Children.map(children, (child, index) => {
          if (!React.isValidElement(child)) return child;
          const itemProps = child.props as { label?: string; value?: string };
          return React.createElement(
            Pressable,
            {
              key: itemProps.value ?? index,
              disabled: !enabled,
              onPress: () => {
                if (!enabled) return;
                if (itemProps.value !== undefined) {
                  onValueChange?.(itemProps.value, index);
                }
              },
            },
            React.createElement(Text, null, itemProps.label ?? String(itemProps.value ?? "")),
          );
        }),
      );
    }
    MockPicker.Item = function MockPickerItem() {
      return null;
    };
    return { Picker: MockPicker };
  });
  ```

  Run: `bun install && bun --filter='@pekulo/mobile' run test && bun --filter='@pekulo/mobile' run typecheck`
  Expected: `bun install` resolves cleanly; `Test Suites: 3 passed, 3 total`, `Tests: 13 passed, 13 total`, and `typecheck` exits 0.
  Commit: `git add apps/mobile/package.json apps/mobile/app.json apps/mobile/jest.config.js apps/mobile/jest.setup.ts bun.lock && git commit -m "chore(#155): add Supabase Auth, SecureStore, oRPC, and React Query dependencies in apps/mobile"`

- [x] **T2 — Implement chunked `expo-secure-store` storage adapter and mobile Supabase Auth client** [AC: AC-1]

  Create `apps/mobile/lib/supabase/secure-storage.ts`:

  ```ts
  // apps/mobile/lib/supabase/secure-storage.ts
  // Chunked expo-secure-store adapter for @supabase/supabase-js Auth.
  // iOS Keychain / expo-secure-store enforces a 2048-byte limit per entry, while
  // Supabase session JSON (access_token + refresh_token + user metadata) often
  // exceeds 2 KB. Values > CHUNK_SIZE (1800 chars) are split across
  // `${key}__chunk_0..N-1` with a manifest `{"__chunked":true,"count":N}` at `key`.

  import * as SecureStore from "expo-secure-store";

  export const CHUNK_SIZE = 1800;

  export interface SecureStoreDriver {
    getItemAsync: (key: string) => Promise<string | null>;
    setItemAsync: (key: string, value: string) => Promise<void>;
    deleteItemAsync: (key: string) => Promise<void>;
  }

  interface ChunkManifest {
    __chunked: true;
    count: number;
  }

  function isChunkManifest(raw: string): ChunkManifest | null {
    if (!raw.startsWith('{"__chunked":true,')) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<ChunkManifest>;
      if (
        parsed.__chunked === true &&
        typeof parsed.count === "number" &&
        Number.isInteger(parsed.count) &&
        parsed.count > 0
      ) {
        return { __chunked: true, count: parsed.count };
      }
      return null;
    } catch {
      return null;
    }
  }

  function chunkKey(baseKey: string, index: number): string {
    return `${baseKey}__chunk_${index}`;
  }

  export function createChunkedSecureStorage(driver: SecureStoreDriver = SecureStore) {
    async function clearExistingChunks(key: string): Promise<void> {
      const existing = await driver.getItemAsync(key);
      if (!existing) return;
      const manifest = isChunkManifest(existing);
      if (!manifest) return;
      await Promise.all(
        Array.from({ length: manifest.count }, (_, idx) =>
          driver.deleteItemAsync(chunkKey(key, idx)),
        ),
      );
    }

    return {
      async getItem(key: string): Promise<string | null> {
        const raw = await driver.getItemAsync(key);
        if (raw === null) return null;
        const manifest = isChunkManifest(raw);
        if (!manifest) return raw;

        const parts = await Promise.all(
          Array.from({ length: manifest.count }, (_, idx) =>
            driver.getItemAsync(chunkKey(key, idx)),
          ),
        );
        if (parts.some((p) => p === null)) {
          return null;
        }
        return parts.join("");
      },

      async setItem(key: string, value: string): Promise<void> {
        await clearExistingChunks(key);

        if (value.length <= CHUNK_SIZE) {
          await driver.setItemAsync(key, value);
          return;
        }

        const chunks: string[] = [];
        for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
          chunks.push(value.slice(offset, offset + CHUNK_SIZE));
        }

        await Promise.all(
          chunks.map((chunk, idx) => driver.setItemAsync(chunkKey(key, idx), chunk)),
        );
        const manifest: ChunkManifest = { __chunked: true, count: chunks.length };
        await driver.setItemAsync(key, JSON.stringify(manifest));
      },

      async removeItem(key: string): Promise<void> {
        await clearExistingChunks(key);
        await driver.deleteItemAsync(key);
      },
    };
  }

  export const chunkedSecureStorage = createChunkedSecureStorage();
  ```

  Create `apps/mobile/lib/supabase/client.ts`:

  ```ts
  // apps/mobile/lib/supabase/client.ts
  // React Native Supabase Auth client backed by chunked expo-secure-store.
  // Safe when EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are unset
  // (local preview / CI test mode): `isSupabaseConfigured()` returns false so
  // AuthProvider can degrade cleanly without network calls unless mocked.

  import { createClient, type SupabaseClient } from "@supabase/supabase-js";

  import { chunkedSecureStorage } from "./secure-storage";

  const FALLBACK_SUPABASE_URL = "https://placeholder.supabase.co";
  const FALLBACK_SUPABASE_ANON_KEY = "placeholder-anon-key";

  export function isSupabaseConfigured(env: Record<string, string | undefined> = process.env): boolean {
    const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
    const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
    return Boolean(url && key);
  }

  export function getSupabaseConfig(env: Record<string, string | undefined> = process.env): {
    url: string;
    anonKey: string;
    configured: boolean;
  } {
    const configured = isSupabaseConfigured(env);
    return {
      url: env.EXPO_PUBLIC_SUPABASE_URL?.trim() || FALLBACK_SUPABASE_URL,
      anonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || FALLBACK_SUPABASE_ANON_KEY,
      configured,
    };
  }

  const initialConfig = getSupabaseConfig();

  export const supabase: SupabaseClient = createClient(initialConfig.url, initialConfig.anonKey, {
    auth: {
      storage: chunkedSecureStorage,
      autoRefreshToken: initialConfig.configured,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  export async function getSupabaseAccessToken(): Promise<string | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;
    return data.session.access_token ?? null;
  }
  ```

  Run: `bun --filter='@pekulo/mobile' run typecheck && bun --filter='@pekulo/mobile' run lint`
  Expected: `typecheck` exits 0 and `lint` exits 0 with 0 errors.
  Commit: `git add apps/mobile/lib/supabase/secure-storage.ts apps/mobile/lib/supabase/client.ts && git commit -m "feat(#155): add chunked expo-secure-store adapter and mobile Supabase Auth client"`

- [x] **T3 — Implement mobile `@pekulo/contracts` oRPC link and per-module typed clients** [AC: AC-2]

  Create `apps/mobile/lib/orpc/client.ts`:

  ```ts
  // apps/mobile/lib/orpc/client.ts
  // Mobile oRPC HTTP link to apps/api (/rpc/v1/*). Forwards the active Supabase
  // session JWT as `Authorization: Bearer <access_token>` on every procedure call.

  import { RPCLink } from "@orpc/client/fetch";

  import { getSupabaseAccessToken } from "../supabase/client";

  const DEFAULT_API_BASE_URL = "http://127.0.0.1:3001";

  export type AccessTokenResolver = () => Promise<string | null> | string | null;

  let activeTokenResolver: AccessTokenResolver = getSupabaseAccessToken;

  export function setAccessTokenResolver(resolver: AccessTokenResolver): void {
    activeTokenResolver = resolver;
  }

  export function resetAccessTokenResolver(): void {
    activeTokenResolver = getSupabaseAccessToken;
  }

  export async function getAccessToken(): Promise<string | null> {
    return await activeTokenResolver();
  }

  export function getApiBaseUrl(env: Record<string, string | undefined> = process.env): string {
    const raw = env.EXPO_PUBLIC_API_BASE_URL?.trim();
    const base = raw && raw.length > 0 ? raw : DEFAULT_API_BASE_URL;
    return base.replace(/\/+$/, "");
  }

  export interface CreateMobileOrpcLinkOptions {
    baseUrl?: () => string;
    tokenResolver?: AccessTokenResolver;
    fetch?: typeof globalThis.fetch;
  }

  export function createMobileOrpcLink(options: CreateMobileOrpcLinkOptions = {}): RPCLink<object> {
    const resolveBaseUrl = options.baseUrl ?? (() => getApiBaseUrl());
    const resolveToken = options.tokenResolver ?? getAccessToken;

    return new RPCLink({
      url: () => `${resolveBaseUrl()}/rpc/v1`,
      fetch: options.fetch,
      headers: async () => {
        const token = await resolveToken();
        if (!token) return {};
        return {
          Authorization: `Bearer ${token}`,
        };
      },
    });
  }

  export const orpcLink = createMobileOrpcLink();
  ```

  Create `apps/mobile/lib/orpc/modules.ts`:

  ```ts
  // apps/mobile/lib/orpc/modules.ts
  // Per-module typed oRPC clients for apps/mobile. Mirrors apps/web/src/lib/orpc/modules.ts
  // (R5 — only modules mounted in apps/api/src/bootstrap/runtime-dependencies.ts)
  // without the web-only `import "server-only"` guard.

  import { createORPCClient } from "@orpc/client";
  import type { ContractRouterClient } from "@orpc/contract";
  import {
    accountsContract,
    bankAggregatorContract,
    compassContract,
    dashboardContract,
    holdingsContract,
    hypothesisContract,
    llmContract,
    milestonesContract,
    monthlyContract,
    realestateContract,
    settingsContract,
    transactionsContract,
  } from "@pekulo/contracts";
  import type { RPCLink } from "@orpc/client/fetch";

  import { orpcLink } from "./client";

  export function createMobileOrpcClients(link: RPCLink<object> = orpcLink) {
    return {
      compassClient: createORPCClient(link, {
        path: ["compass"],
      }) as ContractRouterClient<typeof compassContract>,
      milestonesClient: createORPCClient(link, {
        path: ["milestones"],
      }) as ContractRouterClient<typeof milestonesContract>,
      accountsClient: createORPCClient(link, {
        path: ["accounts"],
      }) as ContractRouterClient<typeof accountsContract>,
      holdingsClient: createORPCClient(link, {
        path: ["holdings"],
      }) as ContractRouterClient<typeof holdingsContract>,
      hypothesisClient: createORPCClient(link, {
        path: ["hypothesis"],
      }) as ContractRouterClient<typeof hypothesisContract>,
      realestateClient: createORPCClient(link, {
        path: ["realestate"],
      }) as ContractRouterClient<typeof realestateContract>,
      transactionsClient: createORPCClient(link, {
        path: ["transactions"],
      }) as ContractRouterClient<typeof transactionsContract>,
      monthlyClient: createORPCClient(link, {
        path: ["monthly"],
      }) as ContractRouterClient<typeof monthlyContract>,
      bankAggregatorClient: createORPCClient(link, {
        path: ["bankaggregator"],
      }) as ContractRouterClient<typeof bankAggregatorContract>,
      llmClient: createORPCClient(link, {
        path: ["llm"],
      }) as ContractRouterClient<typeof llmContract>,
      dashboardClient: createORPCClient(link, {
        path: ["dashboard"],
      }) as ContractRouterClient<typeof dashboardContract>,
      settingsClient: createORPCClient(link, {
        path: ["settings"],
      }) as ContractRouterClient<typeof settingsContract>,
    };
  }

  const defaultClients = createMobileOrpcClients();

  export const compassClient = defaultClients.compassClient;
  export const milestonesClient = defaultClients.milestonesClient;
  export const accountsClient = defaultClients.accountsClient;
  export const holdingsClient = defaultClients.holdingsClient;
  export const hypothesisClient = defaultClients.hypothesisClient;
  export const realestateClient = defaultClients.realestateClient;
  export const transactionsClient = defaultClients.transactionsClient;
  export const monthlyClient = defaultClients.monthlyClient;
  export const bankAggregatorClient = defaultClients.bankAggregatorClient;
  export const llmClient = defaultClients.llmClient;
  export const dashboardClient = defaultClients.dashboardClient;
  export const settingsClient = defaultClients.settingsClient;
  ```

  Run: `bun --filter='@pekulo/mobile' run typecheck && bun --filter='@pekulo/mobile' run lint`
  Expected: `typecheck` exits 0 and `lint` exits 0 with 0 errors.
  Commit: `git add apps/mobile/lib/orpc/client.ts apps/mobile/lib/orpc/modules.ts && git commit -m "feat(#155): wire typed @pekulo/contracts oRPC link and module clients in apps/mobile"`

- [x] **T4 — Add `AuthProvider`, `/login` screen, and wire `QueryClientProvider` + auth routing in `apps/mobile/app/_layout.tsx`** [AC: AC-1, AC-3]

  Create `apps/mobile/lib/auth/auth-context.tsx`:

  ```tsx
  // apps/mobile/lib/auth/auth-context.tsx
  // Mobile authentication context wrapping Supabase Auth + React Query cache purge.
  // When `requireAuth` is true (or EXPO_PUBLIC_SUPABASE_URL/ANON_KEY are configured),
  // unauthenticated users are directed to `/login`. When unconfigured in local/CI
  // preview mode and no initialSession is provided, the app runs in preview fallback
  // mode while still allowing explicit sign-in via `/login`.

  import type { Session } from "@supabase/supabase-js";
  import { QueryClient, useQueryClient } from "@tanstack/react-query";
  import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
  } from "react";

  import { setAccessTokenResolver } from "../orpc/client";
  import { isSupabaseConfigured, supabase } from "../supabase/client";

  export function createMobileQueryClient(): QueryClient {
    return new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 30_000,
          gcTime: 5 * 60_000,
        },
        mutations: {
          retry: false,
        },
      },
    });
  }

  export interface SignInResult {
    ok: boolean;
    errorMessage?: string;
  }

  export interface AuthContextValue {
    session: Session | null;
    userEmail: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    requireAuth: boolean;
    signInWithPassword: (email: string, password: string) => Promise<SignInResult>;
    signOut: () => Promise<void>;
  }

  const AuthContext = createContext<AuthContextValue>({
    session: null,
    userEmail: null,
    isAuthenticated: false,
    isLoading: false,
    requireAuth: false,
    signInWithPassword: async () => ({ ok: false, errorMessage: "AuthProvider non initialisé" }),
    signOut: async () => {},
  });

  export interface AuthProviderProps {
    children: ReactNode;
    initialSession?: Session | null;
    requireAuth?: boolean;
  }

  export function AuthProvider({
    children,
    initialSession = null,
    requireAuth,
  }: AuthProviderProps) {
    const queryClient = useQueryClient();
    const configured = isSupabaseConfigured();
    const enforceAuth = requireAuth ?? configured;

    const [session, setSession] = useState<Session | null>(initialSession);
    const [isLoading, setIsLoading] = useState<boolean>(configured && initialSession === null);

    useEffect(() => {
      setAccessTokenResolver(async () => session?.access_token ?? null);
    }, [session]);

    useEffect(() => {
      if (!configured && initialSession === null) {
        setIsLoading(false);
        return;
      }

      let active = true;

      if (initialSession === null) {
        void supabase.auth
          .getSession()
          .then(({ data }) => {
            if (!active) return;
            setSession(data.session ?? null);
            setIsLoading(false);
          })
          .catch(() => {
            if (!active) return;
            setIsLoading(false);
          });
      }

      const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        if (!nextSession) {
          queryClient.clear();
        }
      });

      return () => {
        active = false;
        listener.subscription.unsubscribe();
      };
    }, [configured, initialSession, queryClient]);

    const signInWithPassword = useCallback(
      async (email: string, password: string): Promise<SignInResult> => {
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !trimmedEmail.includes("@")) {
          return { ok: false, errorMessage: "Veuillez saisir une adresse e-mail valide." };
        }
        if (password.length < 12) {
          return {
            ok: false,
            errorMessage: "Le mot de passe doit contenir au moins 12 caractères.",
          };
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error || !data.session) {
          return {
            ok: false,
            errorMessage: error?.message ?? "Identifiants invalides.",
          };
        }
        setSession(data.session);
        await queryClient.invalidateQueries();
        return { ok: true };
      },
      [queryClient],
    );

    const signOut = useCallback(async (): Promise<void> => {
      await supabase.auth.signOut().catch(() => {});
      setSession(null);
      queryClient.clear();
    }, [queryClient]);

    const value = useMemo<AuthContextValue>(
      () => ({
        session,
        userEmail: session?.user?.email ?? null,
        isAuthenticated: Boolean(session?.access_token),
        isLoading,
        requireAuth: enforceAuth,
        signInWithPassword,
        signOut,
      }),
      [session, isLoading, enforceAuth, signInWithPassword, signOut],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }

  export function useAuth(): AuthContextValue {
    return useContext(AuthContext);
  }
  ```

  Create `apps/mobile/app/login.tsx`:

  ```tsx
  // apps/mobile/app/login.tsx
  // Mobile sign-in screen (FR-46, NFR-11 12-char password policy). Consumes
  // @pekulo/ui native form primitives (PekuloInput, PekuloLabel, PekuloSubmitButton)
  // and `useAuth().signInWithPassword`.

  import { PekuloInput, PekuloLabel, PekuloSubmitButton } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";
  import { useRouter } from "expo-router";
  import { useState } from "react";

  import { ScreenShell } from "../components/screen-shell";
  import { useAuth } from "../lib/auth/auth-context";

  export default function LoginScreen() {
    const { signInWithPassword } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit() {
      setErrorMessage(null);
      setIsSubmitting(true);
      try {
        const result = await signInWithPassword(email, password);
        if (!result.ok) {
          setErrorMessage(result.errorMessage ?? "Impossible de se connecter.");
          return;
        }
        router.replace("/");
      } finally {
        setIsSubmitting(false);
      }
    }

    return (
      <ScreenShell
        title="Connexion"
        subtitle="Connectez-vous à votre compte Pekulo pour synchroniser votre cap"
      >
        <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
          <View gap="$2">
            <PekuloLabel htmlFor="login-email">Adresse e-mail</PekuloLabel>
            <PekuloInput
              id="login-email"
              testID="login-email-input"
              aria-label="Adresse e-mail"
              type="email"
              placeholder="alex@pekulo.app"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </View>

          <View gap="$2">
            <PekuloLabel htmlFor="login-password">Mot de passe</PekuloLabel>
            <PekuloInput
              id="login-password"
              testID="login-password-input"
              aria-label="Mot de passe"
              type="password"
              placeholder="12 caractères minimum"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </View>

          {errorMessage !== null && (
            <Text color="$danger" fontSize="$bodySm" testID="login-error-msg">
              {errorMessage}
            </Text>
          )}

          <PekuloSubmitButton
            testID="login-submit-btn"
            loading={isSubmitting}
            loadingLabel="Connexion…"
            fullWidth
            onPress={() => {
              void handleSubmit();
            }}
          >
            Se connecter
          </PekuloSubmitButton>
        </View>
      </ScreenShell>
    );
  }
  ```

  Replace `apps/mobile/app/_layout.tsx` with:

  ```tsx
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
  ```

  Run: `bun --filter='@pekulo/mobile' run typecheck && bun --filter='@pekulo/mobile' run lint && bun --filter='@pekulo/mobile' run test`
  Expected: `typecheck` exits 0, `lint` exits 0, and all 3 existing Jest suites (`13 passed`) pass.
  Commit: `git add apps/mobile/lib/auth/auth-context.tsx apps/mobile/app/login.tsx apps/mobile/app/_layout.tsx && git commit -m "feat(#155): add AuthProvider, /login screen, and QueryClientProvider in apps/mobile"`

- [x] **T5 — Implement React Query hooks orchestrating `@pekulo/contracts` oRPC reads and mutations** [AC: AC-2, AC-3, AC-4]

  Create `apps/mobile/lib/hooks/use-mobile-queries.ts`:

  ```ts
  // apps/mobile/lib/hooks/use-mobile-queries.ts
  // Custom React Query hooks for apps/mobile (ADR-0010 boundary: screens never
  // call oRPC clients directly). When authenticated, fetches live data from
  // `@pekulo/contracts` module clients (`dashboardClient`, `compassClient`,
  // `milestonesClient`, `accountsClient`, `holdingsClient`, `realestateClient`,
  // `transactionsClient`, `monthlyClient`, `settingsClient`). When running in
  // unauthenticated local/CI preview mode, returns deterministic baseline data.

  import type {
    AccountCardItem,
    Activity,
    CompositionItem,
    HoldingCardItem,
    HoldingKind,
    LlmRouteBadge,
    MilestoneCardItem,
    MonthlyDisplayRow,
    PropertyCardItem,
    Suggestion,
  } from "@pekulo/types";
  import {
    formatMonthLabel,
    TRANSACTION_CATEGORY_LABELS,
    type LangPref,
    type SuggestableTransactionCategory,
    type ThemePref,
    type TransactionCategory,
  } from "@pekulo/validators";
  import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

  import { useAuth } from "../auth/auth-context";
  import {
    accountsClient,
    compassClient,
    dashboardClient,
    holdingsClient,
    milestonesClient,
    monthlyClient,
    realestateClient,
    settingsClient,
    transactionsClient,
  } from "../orpc/modules";

  export const mobileQueryKeys = {
    cap: () => ["mobile", "cap"] as const,
    transactions: () => ["mobile", "transactions"] as const,
    monthly: () => ["mobile", "monthly"] as const,
    portfolio: () => ["mobile", "portfolio"] as const,
    realestate: () => ["mobile", "realestate"] as const,
    settings: () => ["mobile", "settings"] as const,
  };

  const eur0 = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  export interface MobileCapViewData {
    totalEur: number;
    aheadEur: number;
    targetCapital: number;
    targetYear: number;
    requiredYearlyEur: number;
    progressLabel: string;
    nextMilestoneLabel: string;
    composition: CompositionItem[];
    milestones: MilestoneCardItem[];
    recentActivity: Activity[];
    accounts: AccountCardItem[];
  }

  const PREVIEW_CAP_DATA: MobileCapViewData = {
    totalEur: 180400,
    aheadEur: 2781,
    targetCapital: 800000,
    targetYear: 2055,
    requiredYearlyEur: 20653,
    progressLabel: "22,6 %",
    nextMilestoneLabel: "100 k€ · 2032",
    composition: [
      { label: "Liquide", amount: 24500, pct: 0.14, sub: "Livrets & comptes" },
      { label: "Placements", amount: 85900, pct: 0.48, sub: "PEA, CTO & crypto" },
      { label: "Immobilier", amount: 70000, pct: 0.38, sub: "Équité nette" },
    ],
    milestones: [
      {
        id: "mst_preview_1",
        label: "Palier 100 k€",
        targetEur: 100000,
        targetYear: 2032,
        progressPct: 1,
        deltaEur: 10400,
        status: "ahead",
      },
      {
        id: "mst_preview_2",
        label: "Palier 300 k€",
        targetEur: 300000,
        targetYear: 2042,
        progressPct: 0.37,
        deltaEur: 2781,
        status: "on-track",
      },
    ],
    recentActivity: [
      {
        label: "Virement programmé PEA",
        account: "Trade Republic",
        category: "Transfert",
        direction: "in",
        amountEur: 600,
      },
      {
        label: "Courses Carrefour",
        account: "Société Générale",
        category: "Courses",
        direction: "out",
        amountEur: 84,
      },
    ],
    accounts: [
      { label: "Livret A", type: "livret", balanceEur: 22950 },
      { label: "Compte courant", type: "banque", balanceEur: 1550 },
    ],
  };

  function formatCompactMilestone(targetCapital: number, targetYear: number): string {
    if (targetCapital >= 1000 && targetCapital % 1000 === 0) {
      return `${Math.round(targetCapital / 1000)} k€ · ${targetYear}`;
    }
    return `${eur0.format(targetCapital)} · ${targetYear}`;
  }

  export function useMobileCapData() {
    const { isAuthenticated } = useAuth();

    return useQuery<MobileCapViewData>({
      queryKey: [...mobileQueryKeys.cap(), isAuthenticated],
      queryFn: async () => {
        if (!isAuthenticated) {
          return PREVIEW_CAP_DATA;
        }

        const [overview, compass, milestonesList, accountsList] = await Promise.all([
          dashboardClient.getOverview(),
          compassClient.getCompass(),
          milestonesClient.list(),
          accountsClient.list(),
        ]);

        const currentInvestableWealth =
          overview.compass?.currentWealth ?? Math.max(0, overview.totalWealthEur);
        const statuses =
          milestonesList.length > 0
            ? await milestonesClient.getStatuses({
                currentWealth: Math.max(0, currentInvestableWealth),
              })
            : [];
        const statusById = new Map(statuses.map((s) => [s.id, s]));

        const currentYear = new Date().getUTCFullYear();
        const horizonYears = compass?.horizonYears ?? 30;
        const targetYear = currentYear + horizonYears;
        const targetCapital = compass?.objectif ?? overview.compass?.objectif ?? 800000;
        const remaining = Math.max(0, targetCapital - overview.totalWealthEur);
        const requiredYearlyEur = Math.round(remaining / Math.max(1, horizonYears));

        const percentNum =
          overview.compass?.percent ??
          (targetCapital > 0 ? (overview.totalWealthEur / targetCapital) * 100 : 0);
        const progressLabel = `${percentNum.toFixed(1).replace(".", ",")} %`;

        const milestones: MilestoneCardItem[] = milestonesList.map((m) => {
          const st = statusById.get(m.id);
          const progressPct =
            m.targetCapital > 0 ? Math.max(0, Math.min(1, currentInvestableWealth / m.targetCapital)) : 0;
          return {
            id: m.id,
            label: m.label ?? `Palier ${m.targetYear}`,
            targetEur: m.targetCapital,
            targetYear: m.targetYear,
            progressPct,
            deltaEur: st ? -st.delta : 0,
            status: st?.status ?? "on-track",
          };
        });

        const nextMilestone = milestonesList[0];
        const nextMilestoneLabel = nextMilestone
          ? formatCompactMilestone(nextMilestone.targetCapital, nextMilestone.targetYear)
          : "Aucun palier";

        const totalPositive = Math.max(
          1,
          overview.composition.liquideEur +
            overview.composition.placementsEur +
            Math.max(0, overview.composition.immobilierEur),
        );

        const composition: CompositionItem[] = [
          {
            label: "Liquide",
            amount: overview.composition.liquideEur,
            pct: Math.max(0, overview.composition.liquideEur) / totalPositive,
            sub: "Livrets & comptes",
          },
          {
            label: "Placements",
            amount: overview.composition.placementsEur,
            pct: Math.max(0, overview.composition.placementsEur) / totalPositive,
            sub: "PEA, CTO & crypto",
          },
          {
            label: "Immobilier",
            amount: overview.composition.immobilierEur,
            pct: Math.max(0, overview.composition.immobilierEur) / totalPositive,
            sub: "Équité nette",
          },
        ];

        const recentActivity: Activity[] = overview.recentActivity.map((act) => ({
          label: act.label,
          account: act.account,
          category:
            TRANSACTION_CATEGORY_LABELS[act.category as TransactionCategory] ?? act.category,
          direction: act.direction,
          amountEur: act.amountEur,
          logoUrl: act.logoUrl ?? null,
        }));

        const accounts: AccountCardItem[] = accountsList.map((acc) => ({
          label: acc.label,
          type: acc.type,
          balanceEur: acc.cashBalance,
        }));

        const firstDelta = statuses[0] ? -statuses[0].delta : 0;

        return {
          totalEur: overview.totalWealthEur,
          aheadEur: Math.round(firstDelta),
          targetCapital,
          targetYear,
          requiredYearlyEur,
          progressLabel,
          nextMilestoneLabel,
          composition,
          milestones,
          recentActivity,
          accounts,
        };
      },
    });
  }

  export interface MobilePendingSuggestionItem {
    id: string;
    rawCategory: SuggestableTransactionCategory;
    suggestion: Suggestion;
  }

  export interface MobileTransactionsViewData {
    monthLabel: string;
    netFormatted: string;
    netTone?: "gain" | "loss";
    incomeFormatted: string;
    spendingFormatted: string;
    pendingSuggestions: MobilePendingSuggestionItem[];
    recentTransactions: Activity[];
  }

  const PREVIEW_TRANSACTIONS_DATA: MobileTransactionsViewData = {
    monthLabel: "2026-05",
    netFormatted: "+1 050 €",
    netTone: "gain",
    incomeFormatted: "+3 200 €",
    spendingFormatted: "−2 150 €",
    pendingSuggestions: [],
    recentTransactions: [
      {
        label: "Salaire Mai",
        account: "Société Générale",
        category: "Salaire",
        direction: "in",
        amountEur: 3200,
      },
      {
        label: "Courses Carrefour",
        account: "Société Générale",
        category: "Courses",
        direction: "out",
        amountEur: 120,
      },
    ],
  };

  function mapLlmRouteToBadge(route: string | null | undefined): LlmRouteBadge {
    if (route === "foundation_models" || route === "ios") return "ios";
    if (route === "third_party" || route === "cloud") return "cloud";
    return "ollama";
  }

  function formatSignedEur(amount: number): string {
    const sign = amount >= 0 ? "+" : "−";
    return `${sign}${eur0.format(Math.abs(amount))}`;
  }

  export function useMobileTransactionsData() {
    const { isAuthenticated } = useAuth();

    return useQuery<MobileTransactionsViewData>({
      queryKey: [...mobileQueryKeys.transactions(), isAuthenticated],
      queryFn: async () => {
        if (!isAuthenticated) {
          return PREVIEW_TRANSACTIONS_DATA;
        }

        const [summary, pending, list, accounts] = await Promise.all([
          transactionsClient.monthSummary({}),
          transactionsClient.listPendingSuggestions({ page: 1, pageSize: 10 }),
          transactionsClient.listTransactions({ limit: 20 }),
          accountsClient.list(),
        ]);

        const accountLabelById = new Map(accounts.map((a) => [a.id, a.label]));

        const pendingSuggestions: MobilePendingSuggestionItem[] = pending.items
          .filter((tx) => Boolean(tx.suggestedCategory))
          .map((tx) => {
            const rawCat = (tx.suggestedCategory ?? "courses") as SuggestableTransactionCategory;
            return {
              id: tx.id,
              rawCategory: rawCat,
              suggestion: {
                label: tx.label,
                account: accountLabelById.get(tx.accountId) ?? "Compte",
                dateLabel: tx.occurredOn,
                direction: tx.type === "inflow" ? "in" : "out",
                amountEur: tx.amount,
                suggestedCategory:
                  TRANSACTION_CATEGORY_LABELS[rawCat as TransactionCategory] ?? rawCat,
                confidence: tx.suggestedConfidence ?? 0.9,
                route: mapLlmRouteToBadge(tx.suggestedRoute),
                logoUrl: tx.logoUrl ?? null,
              },
            };
          });

        const recentTransactions: Activity[] = list.items.map((tx) => ({
          label: tx.label,
          account: accountLabelById.get(tx.accountId) ?? "Compte",
          category: TRANSACTION_CATEGORY_LABELS[tx.category] ?? tx.category,
          direction: tx.type === "inflow" ? "in" : "out",
          amountEur: tx.amount,
          logoUrl: tx.logoUrl ?? null,
        }));

        return {
          monthLabel: summary.month,
          netFormatted: formatSignedEur(summary.netChangeEur),
          netTone: summary.netChangeEur >= 0 ? "gain" : "loss",
          incomeFormatted: `+${eur0.format(summary.incomeEur)}`,
          spendingFormatted: `−${eur0.format(summary.spendingEur)}`,
          pendingSuggestions,
          recentTransactions,
        };
      },
    });
  }

  export function useConfirmMobileSuggestion() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (input: { id: string; category: SuggestableTransactionCategory }) => {
        return await transactionsClient.confirmCategorisation(input);
      },
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: mobileQueryKeys.transactions() }),
          queryClient.invalidateQueries({ queryKey: mobileQueryKeys.cap() }),
        ]);
      },
    });
  }

  export interface MobileMonthlyViewData {
    currentNetFormatted: string;
    currentNetTone?: "gain" | "loss";
    currentIncomeFormatted: string;
    currentSpendingFormatted: string;
    months: MonthlyDisplayRow[];
  }

  const PREVIEW_MONTHLY_DATA: MobileMonthlyViewData = {
    currentNetFormatted: "+1 240 €",
    currentNetTone: "gain",
    currentIncomeFormatted: "+3 400 €",
    currentSpendingFormatted: "−2 160 €",
    months: [
      {
        monthLabel: "mai 2026",
        incomeEur: 3400,
        spendingEur: 2160,
        netEur: 1240,
        closed: false,
      },
      {
        monthLabel: "avr. 2026",
        incomeEur: 3200,
        spendingEur: 1950,
        netEur: 1250,
        closed: true,
      },
    ],
  };

  export function useMobileMonthlyData() {
    const { isAuthenticated } = useAuth();

    return useQuery<MobileMonthlyViewData>({
      queryKey: [...mobileQueryKeys.monthly(), isAuthenticated],
      queryFn: async () => {
        if (!isAuthenticated) {
          return PREVIEW_MONTHLY_DATA;
        }

        const response = await monthlyClient.listMonthly({ limit: 12 });
        const months: MonthlyDisplayRow[] = response.items.map((item) => ({
          monthLabel: formatMonthLabel(item.record.year, item.record.monthNum),
          incomeEur: item.record.incomeEur,
          spendingEur: item.record.spendingEur,
          netEur: item.record.netChangeEur,
          closed: item.record.signedOffAt !== null,
        }));

        const current = months[0];
        const netEur = current?.netEur ?? 0;

        return {
          currentNetFormatted: formatSignedEur(netEur),
          currentNetTone: netEur >= 0 ? "gain" : "loss",
          currentIncomeFormatted: `+${eur0.format(current?.incomeEur ?? 0)}`,
          currentSpendingFormatted: `−${eur0.format(current?.spendingEur ?? 0)}`,
          months,
        };
      },
    });
  }

  export interface MobilePortfolioClassSummary {
    label: string;
    amountEur: number;
    pct: number;
  }

  export interface MobilePortfolioViewData {
    totalValueFormatted: string;
    pnlFormatted: string;
    pnlTone?: "gain" | "loss";
    classes: MobilePortfolioClassSummary[];
    holdings: HoldingCardItem[];
  }

  const PREVIEW_PORTFOLIO_DATA: MobilePortfolioViewData = {
    totalValueFormatted: "85 900 €",
    pnlFormatted: "+12 450 €",
    pnlTone: "gain",
    classes: [
      { label: "ETF", amountEur: 62000, pct: 0.72 },
      { label: "Actions", amountEur: 14900, pct: 0.17 },
      { label: "Crypto", amountEur: 9000, pct: 0.11 },
    ],
    holdings: [
      {
        ticker: "CW8.PA",
        label: "Amundi MSCI World",
        account: "PEA",
        kind: "etf",
        quantity: 120,
        pricePerUnit: 516.67,
        marketValueEur: 62000,
        pnlEur: 9800,
        pnlPct: 18.8,
      },
    ],
  };

  export function useMobilePortfolioData() {
    const { isAuthenticated } = useAuth();

    return useQuery<MobilePortfolioViewData>({
      queryKey: [...mobileQueryKeys.portfolio(), isAuthenticated],
      queryFn: async () => {
        if (!isAuthenticated) {
          return PREVIEW_PORTFOLIO_DATA;
        }

        const [holdingsList, accountsList] = await Promise.all([
          holdingsClient.list({ includeClosed: false }),
          accountsClient.list(),
        ]);

        const accountLabelById = new Map(accountsList.map((a) => [a.id, a.label]));

        let totalMarketValue = 0;
        let totalCost = 0;
        const byKind: Record<HoldingKind, number> = {
          etf: 0,
          action: 0,
          crypto: 0,
          autre: 0,
        };

        const holdings: HoldingCardItem[] = holdingsList.map((h) => {
          const unitPrice = h.lastPrice > 0 ? h.lastPrice : h.avgCost;
          const marketValueEur = h.quantity * unitPrice;
          const costEur = h.quantity * h.avgCost;
          const pnlEur = marketValueEur - costEur;
          const pnlPct = h.avgCost > 0 ? ((unitPrice - h.avgCost) / h.avgCost) * 100 : 0;

          totalMarketValue += marketValueEur;
          totalCost += costEur;
          byKind[h.kind] += marketValueEur;

          return {
            ticker: h.ticker ?? h.label.slice(0, 8).toUpperCase(),
            label: h.label,
            account: accountLabelById.get(h.accountId) ?? "Portefeuille",
            kind: h.kind,
            quantity: h.quantity,
            pricePerUnit: unitPrice,
            marketValueEur,
            pnlEur,
            pnlPct,
          };
        });

        const totalPnl = totalMarketValue - totalCost;
        const safeTotal = Math.max(1, totalMarketValue);

        const classes: MobilePortfolioClassSummary[] = [
          { label: "ETF", amountEur: byKind.etf, pct: byKind.etf / safeTotal },
          { label: "Actions", amountEur: byKind.action, pct: byKind.action / safeTotal },
          { label: "Crypto", amountEur: byKind.crypto, pct: byKind.crypto / safeTotal },
        ];

        return {
          totalValueFormatted: eur0.format(totalMarketValue),
          pnlFormatted: formatSignedEur(totalPnl),
          pnlTone: totalPnl >= 0 ? "gain" : "loss",
          classes,
          holdings,
        };
      },
    });
  }

  export interface MobileRealEstateViewData {
    totalEquityFormatted: string;
    totalValuationFormatted: string;
    totalDebtFormatted: string;
    properties: PropertyCardItem[];
  }

  const PREVIEW_REALESTATE_DATA: MobileRealEstateViewData = {
    totalEquityFormatted: "70 000 €",
    totalValuationFormatted: "250 000 €",
    totalDebtFormatted: "180 000 €",
    properties: [
      {
        label: "Appartement Lyon 7e",
        valuationEur: 250000,
        debtRemainingEur: 180000,
        monthlyPaymentEur: 890,
        yearsRemaining: 18,
        repaidPct: 0.28,
      },
    ],
  };

  export function useMobileRealEstateData() {
    const { isAuthenticated } = useAuth();

    return useQuery<MobileRealEstateViewData>({
      queryKey: [...mobileQueryKeys.realestate(), isAuthenticated],
      queryFn: async () => {
        if (!isAuthenticated) {
          return PREVIEW_REALESTATE_DATA;
        }

        const [propertiesList, derivesList, totalEquity] = await Promise.all([
          realestateClient.listProperties(),
          realestateClient.listPropertyDerives(),
          realestateClient.getTotalEquity(),
        ]);

        const deriveById = new Map(derivesList.map((d) => [d.propertyId, d]));

        let totalValuation = 0;
        let totalDebt = 0;

        const properties: PropertyCardItem[] = propertiesList.map((prop) => {
          const derive = deriveById.get(prop.id);
          const netEquity = derive?.netEquityEur ?? prop.currentValuation;
          const debtRemainingEur = Math.max(0, prop.currentValuation - netEquity);
          const repaidPct =
            prop.currentValuation > 0
              ? Math.max(0, Math.min(1, netEquity / prop.currentValuation))
              : 1;

          totalValuation += prop.currentValuation;
          totalDebt += debtRemainingEur;

          return {
            label: prop.label,
            valuationEur: prop.currentValuation,
            debtRemainingEur,
            monthlyPaymentEur: 0,
            yearsRemaining: 0,
            repaidPct,
          };
        });

        return {
          totalEquityFormatted: eur0.format(totalEquity.totalEquityEur),
          totalValuationFormatted: eur0.format(totalValuation),
          totalDebtFormatted: eur0.format(totalDebt),
          properties,
        };
      },
    });
  }

  export interface MobileSettingsData {
    theme: ThemePref;
    lang: LangPref;
  }

  const PREVIEW_SETTINGS_DATA: MobileSettingsData = {
    theme: "system",
    lang: "fr",
  };

  export function useMobileSettingsData() {
    const { isAuthenticated } = useAuth();
    const queryClient = useQueryClient();

    const query = useQuery<MobileSettingsData>({
      queryKey: [...mobileQueryKeys.settings(), isAuthenticated],
      queryFn: async () => {
        if (!isAuthenticated) {
          return PREVIEW_SETTINGS_DATA;
        }
        return await settingsClient.get();
      },
    });

    const updateThemeMutation = useMutation({
      mutationFn: async (theme: ThemePref) => {
        if (!isAuthenticated) {
          return { ...(query.data ?? PREVIEW_SETTINGS_DATA), theme };
        }
        return await settingsClient.updateTheme({ theme });
      },
      onSuccess: (updated) => {
        queryClient.setQueryData([...mobileQueryKeys.settings(), isAuthenticated], updated);
      },
    });

    const updateLangMutation = useMutation({
      mutationFn: async (lang: LangPref) => {
        if (!isAuthenticated) {
          return { ...(query.data ?? PREVIEW_SETTINGS_DATA), lang };
        }
        return await settingsClient.updateLang({ lang });
      },
      onSuccess: (updated) => {
        queryClient.setQueryData([...mobileQueryKeys.settings(), isAuthenticated], updated);
      },
    });

    return {
      prefs: query.data ?? PREVIEW_SETTINGS_DATA,
      isLoading: query.isLoading,
      updateTheme: updateThemeMutation.mutateAsync,
      updateLang: updateLangMutation.mutateAsync,
    };
  }
  ```

  Run: `bun --filter='@pekulo/mobile' run typecheck && bun --filter='@pekulo/mobile' run lint`
  Expected: `typecheck` exits 0 and `lint` exits 0 with 0 errors.
  Commit: `git add apps/mobile/lib/hooks/use-mobile-queries.ts && git commit -m "feat(#155): add React Query oRPC hooks for Cap, Transactions, Mensuel, Portefeuille, Immobilier, and Paramètres"`

- [x] **T6 — Wire Cap, Transactions, Mensuel, Portefeuille, Immobilier, and Paramètres screens to live oRPC hooks and `@pekulo/ui` components** [AC: AC-3, AC-4]

  Replace `apps/mobile/app/(tabs)/(cap)/index.tsx` with:

  ```tsx
  // apps/mobile/app/(tabs)/(cap)/index.tsx
  // Cap & Patrimoine root screen ("/"). Consumes `useMobileCapData()` (live oRPC
  // `dashboard.getOverview`, `compass.getCompass`, `milestones.list/getStatuses`,
  // `accounts.list`, with deterministic preview fallback) and renders @pekulo/ui
  // native components (`PekuloTopTabToggle`, `PekuloHero`, `PekuloStat`,
  // `PekuloCompositionRow`, `PekuloMilestoneRow`, `PekuloActivityRow`,
  // `PekuloAccountRow`).

  import {
    PekuloAccountRow,
    PekuloActivityRow,
    PekuloCompositionRow,
    PekuloHero,
    PekuloMilestoneRow,
    PekuloStat,
    PekuloTopTabToggle,
    Section,
    type PekuloTopTab,
  } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";
  import { Link } from "expo-router";
  import { useState } from "react";
  import { Pressable } from "react-native";

  import { ScreenShell } from "../../../components/screen-shell";
  import { useMobileCapData } from "../../../lib/hooks/use-mobile-queries";

  function SettingsAvatarLink() {
    return (
      <Link href="/parametres" asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ouvrir les paramètres"
          hitSlop={8}
          testID="open-settings-btn"
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
              A
            </Text>
          </View>
        </Pressable>
      </Link>
    );
  }

  export default function CapScreen() {
    const [topTab, setTopTab] = useState<PekuloTopTab>("cap");
    const { data } = useMobileCapData();

    const viewData = data ?? {
      totalEur: 180400,
      aheadEur: 2781,
      targetCapital: 800000,
      targetYear: 2055,
      requiredYearlyEur: 20653,
      progressLabel: "22,6 %",
      nextMilestoneLabel: "100 k€ · 2032",
      composition: [],
      milestones: [],
      recentActivity: [],
      accounts: [],
    };

    return (
      <ScreenShell
        title="Cap"
        subtitle="Trajectoire vers votre objectif patrimonial"
        headerRight={<SettingsAvatarLink />}
      >
        <PekuloTopTabToggle topTab={topTab} onChange={setTopTab} />

        {topTab === "cap" ? (
          <View gap="$5">
            <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$5">
              <PekuloHero
                variant="card"
                totalEur={viewData.totalEur}
                aheadEur={viewData.aheadEur}
                targetCapital={viewData.targetCapital}
                targetYear={viewData.targetYear}
                requiredYearlyEur={viewData.requiredYearlyEur}
              />
              <View flexDirection="row" gap="$4">
                <View flex={1}>
                  <PekuloStat label="Avancement" value={viewData.progressLabel} />
                </View>
                <View flex={1}>
                  <PekuloStat label="Prochain palier" value={viewData.nextMilestoneLabel} />
                </View>
              </View>
            </View>

            {viewData.milestones.length > 0 && (
              <Section title="Paliers" ariaLabel="Paliers du cap">
                {viewData.milestones.map((milestone) => (
                  <PekuloMilestoneRow
                    key={milestone.id ?? `${milestone.label}-${milestone.targetYear}`}
                    milestone={milestone}
                  />
                ))}
              </Section>
            )}

            {viewData.composition.length > 0 && (
              <Section title="Composition" ariaLabel="Composition du patrimoine">
                {viewData.composition.map((item) => (
                  <PekuloCompositionRow
                    key={item.label}
                    label={item.label}
                    amount={item.amount}
                    pct={item.pct}
                    sub={item.sub}
                  />
                ))}
              </Section>
            )}

            {viewData.recentActivity.length > 0 && (
              <Section title="Activité récente" ariaLabel="Activité récente">
                {viewData.recentActivity.map((tx, idx) => (
                  <PekuloActivityRow key={`${tx.label}-${tx.amountEur}-${idx}`} tx={tx} />
                ))}
              </Section>
            )}
          </View>
        ) : (
          <View gap="$5">
            <Section title="Comptes" ariaLabel="Comptes bancaires et livrets">
              {viewData.accounts.map((acc) => (
                <PekuloAccountRow
                  key={`${acc.label}-${acc.type}`}
                  label={acc.label}
                  type={acc.type}
                  balanceEur={acc.balanceEur}
                />
              ))}
            </Section>

            {viewData.composition.length > 0 && (
              <Section title="Composition" ariaLabel="Composition du patrimoine">
                {viewData.composition.map((item) => (
                  <PekuloCompositionRow
                    key={item.label}
                    label={item.label}
                    amount={item.amount}
                    pct={item.pct}
                    sub={item.sub}
                  />
                ))}
              </Section>
            )}
          </View>
        )}
      </ScreenShell>
    );
  }
  ```

  Replace `apps/mobile/app/(tabs)/transactions.tsx` with:

  ```tsx
  // apps/mobile/app/(tabs)/transactions.tsx
  // Mobile Transactions screen: renders monthly flow stats (`Solde du mois`,
  // `Entrées`, `Sorties`), pending AI categorisation suggestions with 1-tap
  // confirm via `useConfirmMobileSuggestion()`, and recent transactions.

  import {
    PekuloActivityRow,
    PekuloStat,
    PekuloSuggestionRow,
    Section,
  } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";

  import { ScreenShell } from "../../components/screen-shell";
  import {
    useConfirmMobileSuggestion,
    useMobileTransactionsData,
  } from "../../lib/hooks/use-mobile-queries";

  export default function TransactionsScreen() {
    const { data } = useMobileTransactionsData();
    const confirmMutation = useConfirmMobileSuggestion();

    const viewData = data ?? {
      monthLabel: "2026-05",
      netFormatted: "+1 050 €",
      netTone: "gain" as const,
      incomeFormatted: "+3 200 €",
      spendingFormatted: "−2 150 €",
      pendingSuggestions: [],
      recentTransactions: [],
    };

    return (
      <ScreenShell title="Transactions" subtitle="Flux mensuels et catégorisation IA">
        <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
          <PekuloStat
            label="Solde du mois"
            value={viewData.netFormatted}
            tone={viewData.netTone}
          />
          <View flexDirection="row" gap="$4">
            <View flex={1}>
              <PekuloStat label="Entrées" value={viewData.incomeFormatted} tone="gain" />
            </View>
            <View flex={1}>
              <PekuloStat label="Sorties" value={viewData.spendingFormatted} />
            </View>
          </View>
        </View>

        {viewData.pendingSuggestions.length > 0 && (
          <Section title="Suggestions IA" ariaLabel="Suggestions IA à confirmer">
            {viewData.pendingSuggestions.map((item) => (
              <PekuloSuggestionRow
                key={item.id}
                tx={item.suggestion}
                disabled={confirmMutation.isPending}
                onConfirm={() => {
                  confirmMutation.mutate({
                    id: item.id,
                    category: item.rawCategory,
                  });
                }}
              />
            ))}
          </Section>
        )}

        <Section title="Récentes" ariaLabel="Transactions récentes">
          {viewData.recentTransactions.length > 0 ? (
            viewData.recentTransactions.map((tx, idx) => (
              <PekuloActivityRow key={`${tx.label}-${tx.amountEur}-${idx}`} tx={tx} />
            ))
          ) : (
            <Text color="$colorSecondary" fontSize="$bodySm">
              Aucune transaction enregistrée sur la période.
            </Text>
          )}
        </Section>
      </ScreenShell>
    );
  }
  ```

  Replace `apps/mobile/app/(tabs)/mensuel.tsx` with:

  ```tsx
  // apps/mobile/app/(tabs)/mensuel.tsx
  // Mobile Mensuel screen: renders current month savings (`Épargne nette`,
  // `Entrées`, `Sorties`) and monthly history rows (`PekuloMonthlyRow`) from
  // `useMobileMonthlyData()`.

  import { PekuloMonthlyRow, PekuloStat, Section } from "@pekulo/ui";
  import { View } from "@pekulo/ui/client";

  import { ScreenShell } from "../../components/screen-shell";
  import { useMobileMonthlyData } from "../../lib/hooks/use-mobile-queries";

  export default function MensuelScreen() {
    const { data } = useMobileMonthlyData();

    const viewData = data ?? {
      currentNetFormatted: "+1 240 €",
      currentNetTone: "gain" as const,
      currentIncomeFormatted: "+3 400 €",
      currentSpendingFormatted: "−2 160 €",
      months: [],
    };

    return (
      <ScreenShell title="Mensuel" subtitle="Bilan et clôture du mois en cours">
        <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
          <PekuloStat
            label="Épargne nette"
            value={viewData.currentNetFormatted}
            tone={viewData.currentNetTone}
          />
          <View flexDirection="row" gap="$4">
            <View flex={1}>
              <PekuloStat label="Entrées" value={viewData.currentIncomeFormatted} tone="gain" />
            </View>
            <View flex={1}>
              <PekuloStat label="Sorties" value={viewData.currentSpendingFormatted} />
            </View>
          </View>
        </View>

        {viewData.months.length > 0 && (
          <Section title="Historique" ariaLabel="Historique mensuel">
            {viewData.months.map((month) => (
              <PekuloMonthlyRow key={month.monthLabel} month={month} />
            ))}
          </Section>
        )}
      </ScreenShell>
    );
  }
  ```

  Replace `apps/mobile/app/(tabs)/portefeuille.tsx` with:

  ```tsx
  // apps/mobile/app/(tabs)/portefeuille.tsx
  // Mobile Portefeuille screen: renders total value, unrealised PnL
  // (`Plus-value latente`), asset-class breakdown (`PekuloClassRow`), and
  // holding lines (`PekuloHoldingRow`) from `useMobilePortfolioData()`.

  import { PekuloClassRow, PekuloHoldingRow, PekuloStat, Section } from "@pekulo/ui";
  import { View } from "@pekulo/ui/client";

  import { ScreenShell } from "../../components/screen-shell";
  import { useMobilePortfolioData } from "../../lib/hooks/use-mobile-queries";

  export default function PortefeuilleScreen() {
    const { data } = useMobilePortfolioData();

    const viewData = data ?? {
      totalValueFormatted: "85 900 €",
      pnlFormatted: "+12 450 €",
      pnlTone: "gain" as const,
      classes: [],
      holdings: [],
    };

    return (
      <ScreenShell title="Portefeuille" subtitle="ETF, actions et crypto">
        <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
          <PekuloStat label="Valeur portefeuille" value={viewData.totalValueFormatted} />
          <PekuloStat
            label="Plus-value latente"
            value={viewData.pnlFormatted}
            tone={viewData.pnlTone}
          />
        </View>

        {viewData.classes.length > 0 && (
          <Section title="Répartition" ariaLabel="Répartition du portefeuille">
            {viewData.classes.map((cls) => (
              <PekuloClassRow
                key={cls.label}
                label={cls.label}
                amountEur={cls.amountEur}
                pct={cls.pct}
              />
            ))}
          </Section>
        )}

        {viewData.holdings.length > 0 && (
          <Section title="Lignes" ariaLabel="Lignes du portefeuille">
            {viewData.holdings.map((holding) => (
              <PekuloHoldingRow key={`${holding.ticker}-${holding.account}`} holding={holding} />
            ))}
          </Section>
        )}
      </ScreenShell>
    );
  }
  ```

  Replace `apps/mobile/app/(tabs)/immobilier.tsx` with:

  ```tsx
  // apps/mobile/app/(tabs)/immobilier.tsx
  // Mobile Immobilier screen: renders total net equity (`Équité nette`),
  // valuation, remaining debt, and per-property `PekuloPropertyCard` items
  // from `useMobileRealEstateData()`.

  import { PekuloPropertyCard, PekuloStat } from "@pekulo/ui";
  import { View } from "@pekulo/ui/client";

  import { ScreenShell } from "../../components/screen-shell";
  import { useMobileRealEstateData } from "../../lib/hooks/use-mobile-queries";

  export default function ImmobilierScreen() {
    const { data } = useMobileRealEstateData();

    const viewData = data ?? {
      totalEquityFormatted: "70 000 €",
      totalValuationFormatted: "250 000 €",
      totalDebtFormatted: "180 000 €",
      properties: [],
    };

    return (
      <ScreenShell title="Immobilier" subtitle="Biens, crédits et équité nette">
        <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
          <PekuloStat label="Équité nette" value={viewData.totalEquityFormatted} />
          <View flexDirection="row" gap="$4">
            <View flex={1}>
              <PekuloStat label="Valorisation" value={viewData.totalValuationFormatted} />
            </View>
            <View flex={1}>
              <PekuloStat label="Dette restante" value={viewData.totalDebtFormatted} />
            </View>
          </View>
        </View>

        {viewData.properties.map((property) => (
          <PekuloPropertyCard key={property.label} property={property} />
        ))}
      </ScreenShell>
    );
  }
  ```

  Replace `apps/mobile/app/parametres.tsx` with:

  ```tsx
  // apps/mobile/app/parametres.tsx
  // Mobile Paramètres modal: displays account identity, sign-in / sign-out action,
  // theme & language segmented controls synced with `useThemeSetting()` and
  // `settingsClient` (`useMobileSettingsData()`), plus Design System status.

  import {
    PekuloButton,
    PekuloSegmentedControl,
    PekuloSettingRow,
    PekuloStat,
    Section,
    useThemeSetting,
  } from "@pekulo/ui";
  import { View } from "@pekulo/ui/client";
  import type { LangPref, ThemePref } from "@pekulo/validators";
  import { useRouter } from "expo-router";
  import { Globe, Monitor, Moon, Sun } from "lucide-react-native";

  import { ScreenShell } from "../components/screen-shell";
  import { useAuth } from "../lib/auth/auth-context";
  import { useMobileSettingsData } from "../lib/hooks/use-mobile-queries";

  function toTamaguiThemeChoice(pref: ThemePref): "pekulo-dark" | "pekulo-light" | "system" {
    if (pref === "dark") return "pekulo-dark";
    if (pref === "light") return "pekulo-light";
    return "system";
  }

  export default function ParametresScreen() {
    const { isAuthenticated, userEmail, signOut } = useAuth();
    const { prefs, updateTheme, updateLang } = useMobileSettingsData();
    const themeSetting = useThemeSetting();
    const router = useRouter();

    async function handleThemeChange(nextTheme: ThemePref) {
      themeSetting.set(toTamaguiThemeChoice(nextTheme));
      await updateTheme(nextTheme);
    }

    async function handleLangChange(nextLang: LangPref) {
      await updateLang(nextLang);
    }

    async function handleAuthAction() {
      if (isAuthenticated) {
        await signOut();
        router.replace("/login");
      } else {
        router.push("/login");
      }
    }

    return (
      <ScreenShell title="Paramètres" subtitle="Apparence, compte et préférences">
        <Section title="Compte" ariaLabel="Compte utilisateur">
          <PekuloSettingRow
            label="Session"
            value={userEmail ?? "Mode aperçu"}
            sub={isAuthenticated ? "Synchronisé via Supabase" : "Non connecté"}
            action={
              <PekuloButton
                testID="settings-auth-action-btn"
                onPress={() => {
                  void handleAuthAction();
                }}
              >
                {isAuthenticated ? "Se déconnecter" : "Se connecter"}
              </PekuloButton>
            }
          />
        </Section>

        <Section title="Apparence" ariaLabel="Apparence et langue">
          <View gap="$4">
            <PekuloSegmentedControl<ThemePref>
              ariaLabel="Thème de l'application"
              value={prefs.theme}
              onChange={(val) => {
                void handleThemeChange(val);
              }}
              options={[
                { value: "system", label: "Système", icon: Monitor },
                { value: "dark", label: "Sombre", icon: Moon },
                { value: "light", label: "Clair", icon: Sun },
              ]}
            />
            <PekuloSegmentedControl<LangPref>
              ariaLabel="Langue de l'application"
              value={prefs.lang}
              onChange={(val) => {
                void handleLangChange(val);
              }}
              options={[
                { value: "fr", label: "Français", icon: Globe },
                { value: "en", label: "English", icon: Globe },
              ]}
            />
          </View>
        </Section>

        <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
          <PekuloStat label="Design System" value="Pekulo Tamagui v2" />
        </View>
      </ScreenShell>
    );
  }
  ```

  Run: `bun --filter='@pekulo/mobile' run typecheck && bun --filter='@pekulo/mobile' run lint && bun --filter='@pekulo/mobile' run test`
  Expected: `typecheck` exits 0, `lint` exits 0, and all 3 existing Jest suites (`13 passed`) pass with zero regressions.
  Commit: `git add "apps/mobile/app/(tabs)/(cap)/index.tsx" "apps/mobile/app/(tabs)/transactions.tsx" "apps/mobile/app/(tabs)/mensuel.tsx" "apps/mobile/app/(tabs)/portefeuille.tsx" "apps/mobile/app/(tabs)/immobilier.tsx" apps/mobile/app/parametres.tsx && git commit -m "feat(#155): wire Cap, Transactions, Mensuel, Portefeuille, Immobilier, and Paramètres to live oRPC hooks"`

- [x] **T7 — Add comprehensive Jest suite for chunked `expo-secure-store`, oRPC Bearer forwarding, Auth `/login` lifecycle, and live oRPC screen rendering** [AC: AC-1, AC-2, AC-3, AC-4, AC-5]

  Create `apps/mobile/__tests__/auth-and-orpc.test.tsx`:

  ```tsx
  import { PekuloRootProvider } from "@pekulo/ui";
  import type { Session } from "@supabase/supabase-js";
  import { QueryClientProvider } from "@tanstack/react-query";
  import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
  import * as SecureStore from "expo-secure-store";
  import type { ReactNode } from "react";

  import CapScreen from "../app/(tabs)/(cap)/index";
  import ImmobilierScreen from "../app/(tabs)/immobilier";
  import MensuelScreen from "../app/(tabs)/mensuel";
  import PortefeuilleScreen from "../app/(tabs)/portefeuille";
  import TransactionsScreen from "../app/(tabs)/transactions";
  import LoginScreen from "../app/login";
  import ParametresScreen from "../app/parametres";
  import { AuthProvider, createMobileQueryClient, useAuth } from "../lib/auth/auth-context";
  import { createMobileOrpcLink } from "../lib/orpc/client";
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
  import { supabase } from "../lib/supabase/client";
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

  function renderWithLiveProviders(ui: ReactNode, session: Session | null = FAKE_SESSION) {
    const queryClient = createMobileQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <PekuloRootProvider theme="pekulo-dark">
          <AuthProvider initialSession={session} requireAuth={session !== null}>
            {ui}
          </AuthProvider>
        </PekuloRootProvider>
      </QueryClientProvider>,
    );
  }

  describe("10-4 mobile Supabase Auth (expo-secure-store) and @pekulo/contracts oRPC", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      const internalStore = (SecureStore as unknown as { __store?: Map<string, string> }).__store;
      internalStore?.clear();
    });

    it("persists and reassembles both small (<1800B) and large (>2048B) session payloads in expo-secure-store (AC-1)", async () => {
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

      // Overwriting with a short value purges old chunks
      await storage.setItem("sb-session-large", '{"token":"now-short"}');
      expect(await SecureStore.getItemAsync("sb-session-large__chunk_0")).toBeNull();
      expect(await storage.getItem("sb-session-large")).toBe('{"token":"now-short"}');

      // removeItem purges manifest and chunks
      await storage.setItem("sb-session-remove", largePayload);
      await storage.removeItem("sb-session-remove");
      expect(await storage.getItem("sb-session-remove")).toBeNull();
      expect(await SecureStore.getItemAsync("sb-session-remove__chunk_0")).toBeNull();
    });

    it("forwards Authorization: Bearer <access_token> to /rpc/v1/<module>/<procedure> on @pekulo/contracts calls (AC-2)", async () => {
      let capturedUrl = "";
      let capturedAuthHeader: string | null = null;

      const customFetch: typeof globalThis.fetch = jest.fn(async (input, init) => {
        capturedUrl =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const headers = new Headers(init?.headers);
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
      });

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
    });

    it("validates credentials on /login, signs in via Supabase Auth, and signs out cleanly (AC-1, AC-3)", async () => {
      const signInSpy = jest.spyOn(supabase.auth, "signInWithPassword");
      const signOutSpy = jest.spyOn(supabase.auth, "signOut").mockResolvedValue({ error: null });

      function AuthStatusProbe() {
        const { userEmail, isAuthenticated } = useAuth();
        return (
          <>
            <LoginScreen />
            {isAuthenticated && < ParametresScreen />}
            {userEmail && <></>}
          </>
        );
      }

      await renderWithLiveProviders(<AuthStatusProbe />, null);

      // 1. Rejects short password (< 12 chars) before hitting Supabase
      await fireEvent.changeText(screen.getByTestId("login-email-input"), "alex@pekulo.app");
      await fireEvent.changeText(screen.getByTestId("login-password-input"), "short123");
      await fireEvent.press(screen.getByTestId("login-submit-btn"));

      expect(
        screen.getByText("Le mot de passe doit contenir au moins 12 caractères."),
      ).toBeTruthy();
      expect(signInSpy).not.toHaveBeenCalled();

      // 2. Valid 12+ char password calls supabase.auth.signInWithPassword and redirects to "/"
      signInSpy.mockResolvedValueOnce({
        data: { session: FAKE_SESSION, user: FAKE_SESSION.user },
        error: null,
      });
      jest.spyOn(settingsClient, "get").mockResolvedValue({ theme: "dark", lang: "fr" });

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
      });

      // 3. Authenticated Paramètres screen shows email and signs out on press
      await waitFor(() => {
        expect(screen.getByText("alex@pekulo.app")).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId("settings-auth-action-btn"));
      await waitFor(() => {
        expect(signOutSpy).toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith("/login");
      });

      signInSpy.mockRestore();
      signOutSpy.mockRestore();
    });

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
      const confirmSpy = jest
        .spyOn(transactionsClient, "confirmCategorisation")
        .mockResolvedValue({
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

      // 6. Paramètres screen theme switch via settingsClient.updateTheme
      jest.spyOn(settingsClient, "get").mockResolvedValue({ theme: "dark", lang: "fr" });
      const updateThemeSpy = jest
        .spyOn(settingsClient, "updateTheme")
        .mockResolvedValue({ theme: "light", lang: "fr" });

      const settingsView = await renderWithLiveProviders(<ParametresScreen />);
      await waitFor(() => {
        expect(screen.getByText("alex@pekulo.app")).toBeTruthy();
      });

      await fireEvent.press(screen.getByText("Clair"));
      await waitFor(() => {
        expect(updateThemeSpy).toHaveBeenCalledWith({ theme: "light" });
      });
      await settingsView.unmount();
    });
  });
  ```

  Run: `bun --filter='@pekulo/mobile' run test __tests__/auth-and-orpc.test.tsx`
  Expected: `PASS __tests__/auth-and-orpc.test.tsx`, `Tests: 4 passed, 4 total`, exit 0.
  Commit: `git add apps/mobile/__tests__/auth-and-orpc.test.tsx && git commit -m "test(#155): add Jest suite for chunked SecureStore, oRPC Bearer headers, /login, and live domain screens"`

- [x] **T8 — Full monorepo quality sweep (`format`, `format:check`, `lint`, `typecheck`, `test`, `tamagui-css-fresh`)** [AC: AC-5]

  Run every check from repo root in order (Lesson 2026-06-01 + Lesson 2026-05-04 + Lesson 2026-05-19):

  ```bash
  cd "$(git rev-parse --show-toplevel)"
  bun run format
  bun run format:check
  bun run lint
  bun run typecheck
  bun --filter='@pekulo/mobile' run test
  bun --filter='@pekulo/ui' run test
  bun --filter='@pekulo/web' run test
  bun run generate:tamagui-css && git diff --exit-code packages/ui/public/tamagui.generated.css
  ```

  Expected: every command exits 0; `packages/ui/public/tamagui.generated.css` has zero diff; `@pekulo/mobile` Jest 30 (`4 passed` suites, `17 passed` tests), `@pekulo/ui` Vitest, and `@pekulo/web` Vitest all pass cleanly.
  Commit: `git add -u && git commit -m "chore(#155): format and verify full 10-4 mobile auth and oRPC sweep"` (only if formatting touched tracked files; otherwise confirm clean working tree).

- [x] **T9 — Mutation hooks for every web interaction, with preview-mode guard** [AC: AC-6]
  `apps/mobile/lib/hooks/use-mobile-mutations.ts`: one hook per domain (transactions, milestones, accounts, holdings, realestate, monthly, compass, llm opt-in, account deletion) calling the exact contract procedures listed in the web inventory, invalidating the affected `mobileQueryKeys`, and throwing `PreviewModeError` without a remote call when unauthenticated. Read hooks expose entity ids and raw values needed by edit forms; Transactions accepts a `month` key.
- [x] **T10 — Native form-sheet infrastructure** [AC: AC-6]
  Shared form primitives (`components/form/*`): labelled text / amount fields (French decimal parsing), native compact `DateTimePicker`, `ActionSheetIOS`-backed select, switch row, header Cancel/Save buttons, zod error surfacing, `useRowActions` action sheet and destructive `Alert` confirmations, preview sign-in prompt. Sheets live under `app/sheets/*` and are presented as iOS `formSheet`.
- [ ] **T11 — Transactions & Cap/Patrimoine interactions** [AC: AC-6]
  Create/edit/delete transaction, month navigation, AI category override; add/delete milestone; create/edit/balance/delete account; header "+" entry points.
- [ ] **T12 — Mensuel, Portefeuille & Immobilier interactions** [AC: AC-6]
  Sign-off sheet gated by the close window + reopen confirmation; add holding, record lot, close holding; create property, record valuation, valuation history, attach/update mortgage and rental, delete property.
- [ ] **T13 — Paramètres interactions** [AC: AC-6]
  Compass objective/horizon sheet, third-party AI opt-in switch, account deletion with typed-email confirmation then sign-out.
- [ ] **T14 — Tests, quality sweep and Simulator visual pass** [AC: AC-5, AC-6]
  Jest coverage for every mutation hook and the key sheet flows; typecheck, oxlint, oxfmt; AXe-driven iOS Simulator walkthrough of each new interaction.

## Dev Notes

### Existing code at write time (Step-0 verbatim quotes)

Every modified existing file is quoted verbatim from the working tree at story-write time:

**1. `apps/mobile/package.json:1-61` (current):**

```json
{
  "name": "@pekulo/mobile",
  "version": "0.1.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start --dev-client",
    "dev:go": "expo start --go",
    "ios": "expo run:ios",
    "ios:device": "expo run:ios --device",
    "android": "expo run:android",
    "prebuild": "expo prebuild",
    "typecheck": "tsc --noEmit",
    "lint": "bunx oxlint app components __tests__",
    "test": "jest"
  },
  "dependencies": {
    "@expo-google-fonts/geist": "^0.4.2",
    "@expo-google-fonts/geist-mono": "^0.4.3",
    "@pekulo/types": "workspace:*",
    "@pekulo/ui": "workspace:*",
    "@react-native-community/datetimepicker": "9.2.1",
    "@react-native-picker/picker": "2.11.4",
    "@react-navigation/native": "^7.1.6",
    "expo": "~58.0.25",
    "expo-constants": "~58.0.16",
    "expo-dev-client": "~58.0.20",
    "expo-font": "~58.0.12",
    "expo-linking": "~58.0.17",
    "expo-router": "~58.0.31",
    "expo-splash-screen": "~58.0.14",
    "expo-status-bar": "~58.0.5",
    "expo-symbols": "~58.0.5",
    "expo-system-ui": "~58.0.7",
    "lucide-react-native": "^1.73.0",
    "react": "19.3.0",
    "react-native": "0.88.1",
    "react-native-gesture-handler": "~3.3.0",
    "react-native-reanimated": "4.7.1",
    "react-native-safe-area-context": "~5.11.1",
    "react-native-screens": "~4.30.1",
    "react-native-svg": "15.16.0",
    "react-native-worklets": "0.13.0",
    "tamagui": "2.3.1"
  },
  "devDependencies": {
    "@babel/core": "^7.29.7",
    "@pekulo/tsconfig": "workspace:*",
    "@tamagui/babel-plugin": "2.3.1",
    "@tamagui/metro-plugin": "2.3.1",
    "@testing-library/react-native": "^14.1.0",
    "@types/jest": "30.0.0",
    "@types/react": "~19.3.0",
    "babel-plugin-transform-inline-environment-variables": "^0.4.4",
    "jest": "~30.5.2",
    "jest-expo": "~58.0.14",
    "react-test-renderer": "19.3.0",
    "test-renderer": "^1.3.1",
    "typescript": "^6.0.3"
  }
}
```

**2. `apps/mobile/app.json:1-40` (current):**

```json
{
  "expo": {
    "name": "Pekulo",
    "slug": "pekulo",
    "version": "0.1.0",
    "scheme": "pekulo",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "backgroundColor": "#000000",
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "app.pekulo.mobile"
    },
    "android": {
      "package": "app.pekulo.mobile",
      "softwareKeyboardLayoutMode": "resize",
      "adaptiveIcon": {
        "backgroundColor": "#000000"
      }
    },
    "plugins": [
      "expo-router",
      "expo-dev-client",
      "expo-font",
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#000000",
          "dark": {
            "backgroundColor": "#000000"
          }
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    }
  }
}
```

**3. `apps/mobile/jest.config.js:1-39` & `apps/mobile/jest.setup.ts:1-28` (current):**

```js
const path = require("node:path");

const babelRuntimeDir = path.dirname(
  require.resolve("@babel/runtime/package.json", {
    paths: [require.resolve("react-native/package.json")],
  }),
);
const reactNativeEntry = require.resolve("react-native");
const reanimatedEntry = require.resolve("react-native-reanimated");
const workletsEntry = require.resolve("react-native-worklets");
const svgEntry = require.resolve("react-native-svg");
const lucideNativeEntry = require.resolve("lucide-react-native");
const dateTimePickerEntry = require.resolve("@react-native-community/datetimepicker");
const pickerEntry = require.resolve("@react-native-picker/picker");

/** @type {import("jest").Config} */
module.exports = {
  preset: "jest-expo",
  testTimeout: 20000,
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["<rootDir>/__tests__/**/*.test.{ts,tsx}"],
  moduleNameMapper: {
    "^@babel/runtime/(.*)$": `${babelRuntimeDir}/$1`,
    "^react-native$": reactNativeEntry,
    "^react-native-reanimated$": reanimatedEntry,
    "^react-native-worklets$": workletsEntry,
    "^react-native-svg$": svgEntry,
    "^lucide-react-native$": lucideNativeEntry,
    "^@react-native-community/datetimepicker$": dateTimePickerEntry,
    "^@react-native-picker/picker$": pickerEntry,
    "^@pekulo/ui$": "<rootDir>/../../packages/ui/src/index.native.ts",
    "^@pekulo/ui/client$": "<rootDir>/../../packages/ui/src/client.ts",
    "^@pekulo/ui/tamagui-config$": "<rootDir>/../../packages/ui/src/config/tamagui.ts",
    "^@/(.*)$": "<rootDir>/$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((?:\\.bun/[^/]+/node_modules/)?(?:(jest-)?react-native|@react-native(-community)?|@react-native-picker/.*|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|standard-navigation|lucide-react-native|react-native-svg|tamagui|@tamagui/.*|@pekulo/.*)))",
  ],
};
```

```ts
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated/src/initializers", () => ({
  initializeReanimatedModule: () => {},
}));

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Ensure expo-font resolves immediately in tests.
jest.mock("expo-font", () => ({
  useFonts: jest.fn(() => [true, null]),
  isLoaded: () => true,
  loadAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(true),
  hideAsync: jest.fn().mockResolvedValue(true),
}));
```

**4. `apps/mobile/app/_layout.tsx:41-100` (current):**

```tsx
function RootNavigator() {
  const { resolvedTheme } = useThemeSetting();
  const isLight = resolvedTheme === "pekulo-light";

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
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
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
    <PekuloRootProvider>
      <RootNavigator />
    </PekuloRootProvider>
  );
}
```

**5. `apps/mobile/app/(tabs)/(cap)/index.tsx:39-66` (current):**

```tsx
export default function CapScreen() {
  return (
    <ScreenShell
      title="Cap"
      subtitle="Trajectoire vers votre objectif patrimonial"
      headerRight={<SettingsAvatarLink />}
    >
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$5">
        <PekuloHero
          variant="card"
          totalEur={180400}
          aheadEur={2781}
          targetCapital={800000}
          targetYear={2055}
          requiredYearlyEur={20653}
        />
        <View flexDirection="row" gap="$4">
          <View flex={1}>
            <PekuloStat label="Avancement" value="22,6 %" />
          </View>
          <View flex={1}>
            <PekuloStat label="Prochain palier" value="100 k€ · 2032" />
          </View>
        </View>
      </View>
    </ScreenShell>
  );
}
```

**6. `apps/mobile/app/(tabs)/transactions.tsx:1-17` (current):**

```tsx
import { PekuloStat } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";

import { ScreenShell } from "../../components/screen-shell";

export default function TransactionsScreen() {
  return (
    <ScreenShell title="Transactions" subtitle="Flux mensuels et catégorisation IA">
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
        <PekuloStat label="Solde du mois" value="+1 050 €" tone="gain" />
        <Text color="$colorSecondary" fontSize="$bodySm">
          Les transactions synchronisées et suggestions IA seront branchées dans la story 10-4.
        </Text>
      </View>
    </ScreenShell>
  );
}
```

**7. `apps/mobile/app/(tabs)/mensuel.tsx:1-17` (current):**

```tsx
import { PekuloStat } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";

import { ScreenShell } from "../../components/screen-shell";

export default function MensuelScreen() {
  return (
    <ScreenShell title="Mensuel" subtitle="Bilan et clôture du mois en cours">
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
        <PekuloStat label="Épargne nette" value="+1 240 €" tone="gain" />
        <Text color="$colorSecondary" fontSize="$bodySm">
          Le suivi mensuel et la clôture seront branchés dans la story 10-4.
        </Text>
      </View>
    </ScreenShell>
  );
}
```

**8. `apps/mobile/app/(tabs)/portefeuille.tsx:1-17` (current):**

```tsx
import { PekuloStat } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";

import { ScreenShell } from "../../components/screen-shell";

export default function PortefeuilleScreen() {
  return (
    <ScreenShell title="Portefeuille" subtitle="ETF, actions et crypto">
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
        <PekuloStat label="Plus-value latente" value="+12 450 €" tone="gain" />
        <Text color="$colorSecondary" fontSize="$bodySm">
          Les lignes, lots et cotations multi-devises seront branchés dans la story 10-4.
        </Text>
      </View>
    </ScreenShell>
  );
}
```

**9. `apps/mobile/app/(tabs)/immobilier.tsx:1-17` (current):**

```tsx
import { PekuloStat } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";

import { ScreenShell } from "../../components/screen-shell";

export default function ImmobilierScreen() {
  return (
    <ScreenShell title="Immobilier" subtitle="Biens, crédits et équité nette">
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
        <PekuloStat label="Équité nette" value="70 000 €" />
        <Text color="$colorSecondary" fontSize="$bodySm">
          Le suivi immobilier et le cash-flow locatif seront branchés dans la story 10-4.
        </Text>
      </View>
    </ScreenShell>
  );
}
```

**10. `apps/mobile/app/parametres.tsx:1-18` (current):**

```tsx
import { PekuloStat } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";

import { ScreenShell } from "../components/screen-shell";

export default function ParametresScreen() {
  return (
    <ScreenShell title="Paramètres" subtitle="Apparence, compte et préférences">
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
        <PekuloStat label="Design System" value="Pekulo Tamagui v2" />
        <Text color="$colorSecondary" fontSize="$bodySm">
          La session Supabase, le thème persisté et les préférences seront branchés dans la story
          10-4.
        </Text>
      </View>
    </ScreenShell>
  );
}
```

### File structure design (3-bullet decision template per file)

- **`apps/mobile/package.json`**
  - Single responsibility: Declare `@orpc/client`, `@orpc/contract`, `@pekulo/contracts`, `@pekulo/validators`, `@supabase/supabase-js`, `@tanstack/react-query`, and `expo-secure-store` (`~58.0.3`), and expand `"lint"` to include `lib/`.
  - Inputs + outputs: Workspace manifest consumed by Bun, Metro, TypeScript, and Jest.
- **`apps/mobile/app.json`**
  - Single responsibility: Register the `expo-secure-store` config plugin for Expo CNG / Dev Build.
  - Inputs + outputs: Adds `"expo-secure-store"` to `expo.plugins`.
- **`apps/mobile/jest.config.js` & `apps/mobile/jest.setup.ts`**
  - Single responsibility: Map Bun `.bun/` paths for `expo-secure-store`, `@pekulo/contracts`, `@pekulo/validators`, `@pekulo/types`, `@pekulo/zod`, and provide an in-memory `expo-secure-store` mock for Jest.
  - Inputs + outputs: Consumed by `bun --filter='@pekulo/mobile' run test`.
- **`apps/mobile/lib/supabase/secure-storage.ts`**
  - Single responsibility: Implement a chunked `expo-secure-store` storage adapter (`1800`-char chunks) that transparently stores and reassembles Supabase session payloads exceeding iOS Keychain's 2048-byte limit.
  - Inputs + outputs: Consumes `expo-secure-store`; exports `CHUNK_SIZE`, `createChunkedSecureStorage`, and `chunkedSecureStorage`.
- **`apps/mobile/lib/supabase/client.ts`**
  - Single responsibility: Initialize the React Native Supabase client using `chunkedSecureStorage` and expose session/token accessors.
  - Inputs + outputs: Consumes `@supabase/supabase-js` + `./secure-storage`; exports `supabase`, `isSupabaseConfigured`, `getSupabaseConfig`, `getSupabaseAccessToken`.
- **`apps/mobile/lib/orpc/client.ts`**
  - Single responsibility: Configure the mobile `RPCLink` targeting `${EXPO_PUBLIC_API_BASE_URL}/rpc/v1` and injecting `Authorization: Bearer <access_token>` on every request.
  - Inputs + outputs: Consumes `@orpc/client/fetch` + token resolver; exports `getApiBaseUrl`, `setAccessTokenResolver`, `resetAccessTokenResolver`, `getAccessToken`, `createMobileOrpcLink`, `orpcLink`.
- **`apps/mobile/lib/orpc/modules.ts`**
  - Single responsibility: Instantiate per-module typed oRPC clients from `@pekulo/contracts` bound to `orpcLink` with explicit `{ path: [moduleKey] }`.
  - Inputs + outputs: Consumes `@orpc/client`, `@orpc/contract`, `@pekulo/contracts`, `./client`; exports `createMobileOrpcClients` and the 12 mounted module clients.
- **`apps/mobile/lib/auth/auth-context.tsx`**
  - Single responsibility: Provide React auth state (`session`, `userEmail`, `isAuthenticated`, `isLoading`, `requireAuth`, `signInWithPassword`, `signOut`), sync the oRPC token resolver, and purge React Query cache on sign-out.
  - Inputs + outputs: Consumes `../supabase/client`, `../orpc/client`, `@tanstack/react-query`; exports `AuthProvider`, `useAuth`, `createMobileQueryClient`.
- **`apps/mobile/lib/hooks/use-mobile-queries.ts`**
  - Single responsibility: Encapsulate all mobile React Query reads and mutations against `@pekulo/contracts` oRPC clients with deterministic preview fallbacks when unauthenticated in preview mode.
  - Inputs + outputs: Consumes `@tanstack/react-query`, `../orpc/modules`, `../auth/auth-context`; exports `mobileQueryKeys`, `useMobileCapData`, `useMobileTransactionsData`, `useConfirmMobileSuggestion`, `useMobileMonthlyData`, `useMobilePortfolioData`, `useMobileRealEstateData`, `useMobileSettingsData`.
- **`apps/mobile/app/login.tsx`**
  - Single responsibility: Render the mobile email + password sign-in screen using `@pekulo/ui` primitives (`PekuloInput`, `PekuloLabel`, `PekuloSubmitButton`) and `useAuth().signInWithPassword`.
  - Inputs + outputs: Consumes `useAuth()`, `expo-router`, `@pekulo/ui`; renders `/login`.
- **`apps/mobile/app/_layout.tsx`**
  - Single responsibility: Mount `QueryClientProvider` + `AuthProvider`, enforce optional auth redirect to `/login`, and register the `login` Stack screen alongside `(tabs)` and `parametres`.
  - Inputs + outputs: Root Expo Router layout component.
- **`apps/mobile/app/(tabs)/(cap)/index.tsx`**
  - Single responsibility: Render the `Cap` and `Patrimoine` views with live oRPC data from `useMobileCapData()`, unboxed `PekuloHero`, compact KPI tiles with `PekuloDonut`, pull-to-refresh, and loading/error/empty states.
  - Inputs + outputs: Consumes `useMobileCapData()`; renders Cap tab screen.
- **`apps/mobile/components/screen-shell.tsx`, `apps/mobile/components/screen-states.tsx`, & `apps/mobile/components/tab-stack-layout.tsx`**
  - Single responsibility: Provide first-child native `<ScrollView>` with `contentInsetAdjustmentBehavior="automatic"` and `RefreshControl`, honest loading skeletons (`ScreenLoadingSkeleton`) and retryable error states (`ScreenErrorState`), and shared native iOS Large Title `<Stack>` headers with a 44×44pt settings button (`SettingsHeaderButton`).
  - Inputs + outputs: Consumed by all five tabs, `/login`, and `/parametres`.
- **`apps/mobile/app/(tabs)/transactions/{_layout,index}.tsx`**
  - Single responsibility: Render monthly transaction stats, native iOS `Stack.SearchBar` filtering, pending AI suggestions (with 1-tap `confirmCategorisation` + toast feedback), and recent transactions from `useMobileTransactionsData()`.
  - Inputs + outputs: Consumes `useMobileTransactionsData()` + `useConfirmMobileSuggestion()`; renders Transactions tab stack & screen.
- **`apps/mobile/app/(tabs)/mensuel/{_layout,index}.tsx`**
  - Single responsibility: Render current month aggregates (`Épargne nette`, `Entrées`, `Sorties`) and monthly history rows (`PekuloMonthlyRow`) from `useMobileMonthlyData()` inside a native iOS Large Title Stack.
  - Inputs + outputs: Consumes `useMobileMonthlyData()`; renders Mensuel tab stack & screen.
- **`apps/mobile/app/(tabs)/portefeuille/{_layout,index}.tsx`**
  - Single responsibility: Render live portfolio total, unrealised PnL (`Plus-value latente`), asset-class breakdown (`PekuloClassRow`), and holding rows (`PekuloHoldingRow`) from `useMobilePortfolioData()` inside a native iOS Large Title Stack.
  - Inputs + outputs: Consumes `useMobilePortfolioData()`; renders Portefeuille tab stack & screen.
- **`apps/mobile/app/(tabs)/immobilier/{_layout,index}.tsx`**
  - Single responsibility: Render total net equity (`Équité nette`), total valuation, remaining debt, and per-property `PekuloPropertyCard` items from `useMobileRealEstateData()` inside a native iOS Large Title Stack.
  - Inputs + outputs: Consumes `useMobileRealEstateData()`; renders Immobilier tab stack & screen.
- **`apps/mobile/app/parametres.tsx`**
  - Single responsibility: Render user account status, native iOS destructive sign-out confirmation (`Alert.alert`), live theme & language `PekuloSegmentedControl` synced with `useThemeSetting()` and `settingsClient` (with error toast feedback) inside a native iOS `formSheet`.
  - Inputs + outputs: Consumes `useAuth()` + `useMobileSettingsData()`; renders Paramètres formSheet screen.
- **`apps/mobile/__tests__/auth-and-orpc.test.tsx`**
  - Single responsibility: Verify chunked `expo-secure-store` (< 2 KB and > 2 KB payloads + cleanup), `RPCLink` Bearer token forwarding to `/rpc/v1/<module>/<procedure>`, `/login` validation & sign-in/sign-out lifecycle (including native `Alert.alert` sign-out confirmation), honest loading/error/retry states, and live oRPC data rendering + mutations across all 5 tabs and `Paramètres`.
  - Inputs + outputs: Jest + RNTL test suite run by `bun --filter='@pekulo/mobile' run test`.

### Architecture & Lessons Applied

- **Chunked `expo-secure-store` (iOS 2048-byte limit):** `expo-secure-store` enforces a 2048-byte limit per item on iOS, which a raw Supabase session JSON frequently exceeds. `apps/mobile/lib/supabase/secure-storage.ts` splits strings > 1800 characters into indexed chunks (`${key}__chunk_0..N-1`) and writes a compact JSON manifest at `key`, keeping the adapter 100% self-contained in `expo-secure-store` with zero extra native dependencies.
- **Contract-first oRPC + explicit module path (`ADR-0009`, `R5`, `apps/web/src/lib/orpc/modules.ts`):** `apps/api` mounts every module router under `/rpc/v1/<moduleKey>/<procedure>`. Each `createORPCClient(link, { path: [moduleKey] })` in `apps/mobile/lib/orpc/modules.ts` passes `{ path: [moduleKey] }` explicitly and exports only the 12 modules mounted in `apps/api/src/bootstrap/runtime-dependencies.ts`.
- **Component → Hook → Client orchestration boundary (`ADR-0010`):** Screens in `apps/mobile/app/**` never import from `lib/orpc/modules.ts` directly; all reads and mutations flow through `apps/mobile/lib/hooks/use-mobile-queries.ts`.
- **TR-strict palette & `docs/ux-preview/src/App.tsx` parity (Lessons `2026-05-07` & `2026-05-17`):** `$accent` / `tone="gain"` / `tone="loss"` are reserved strictly for ± monetary deltas (`Solde du mois`, `Épargne nette`, `Plus-value latente`, `Entrées`); non-monetary figures (`Avancement %`, `Prochain palier`, `Valeur portefeuille`, `Équité nette`, `Valorisation`, `Dette restante`) omit `tone` and render in neutral `$color`. Account list lives under the `Patrimoine` top-tab on `Cap` (`PekuloTopTabToggle`), never inside `Paramètres` (Lesson `2026-05-17`).
- **Workspace filter & manual typecheck gates (Lessons `2026-05-19` & `2026-06-01`):** Always use `bun --filter='@pekulo/mobile'`, `bun --filter='@pekulo/ui'`, and `bun --filter='@pekulo/web'`. Run `bun run typecheck` manually before every commit.
- **Commit prefix:** `feat(#155): …` / `chore(#155): …` / `test(#155): …`. Final PR body: `Closes #155`.

## File List

**Modified:**

- `apps/mobile/__tests__/cap-screen.test.tsx`
- `apps/mobile/__tests__/navigation-tabs.test.tsx`
- `apps/mobile/package.json`
- `apps/mobile/app.json`
- `apps/mobile/jest.config.js`
- `apps/mobile/jest.setup.ts`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/(tabs)/(cap)/index.tsx`
- `apps/mobile/app/parametres.tsx`
- `apps/mobile/components/screen-shell.tsx`
- `bun.lock`
- `docs/state.yaml`

**Moved (flat tab routes converted to native iOS Large Title Stacks, preserving identical URLs):**

- `apps/mobile/app/(tabs)/transactions.tsx` → `apps/mobile/app/(tabs)/transactions/{_layout,index}.tsx`
- `apps/mobile/app/(tabs)/mensuel.tsx` → `apps/mobile/app/(tabs)/mensuel/{_layout,index}.tsx`
- `apps/mobile/app/(tabs)/portefeuille.tsx` → `apps/mobile/app/(tabs)/portefeuille/{_layout,index}.tsx`
- `apps/mobile/app/(tabs)/immobilier.tsx` → `apps/mobile/app/(tabs)/immobilier/{_layout,index}.tsx`

**Created:**

- `apps/mobile/components/screen-states.tsx`
- `apps/mobile/components/tab-stack-layout.tsx`
- `apps/mobile/app/(tabs)/transactions/_layout.tsx`
- `apps/mobile/app/(tabs)/transactions/index.tsx`
- `apps/mobile/app/(tabs)/mensuel/_layout.tsx`
- `apps/mobile/app/(tabs)/mensuel/index.tsx`
- `apps/mobile/app/(tabs)/portefeuille/_layout.tsx`
- `apps/mobile/app/(tabs)/portefeuille/index.tsx`
- `apps/mobile/app/(tabs)/immobilier/_layout.tsx`
- `apps/mobile/app/(tabs)/immobilier/index.tsx`
- `apps/mobile/lib/supabase/secure-storage.ts`
- `apps/mobile/lib/supabase/client.ts`
- `apps/mobile/lib/orpc/client.ts`
- `apps/mobile/lib/orpc/modules.ts`
- `apps/mobile/lib/auth/auth-context.tsx`
- `apps/mobile/lib/hooks/use-mobile-queries.ts`
- `apps/mobile/app/login.tsx`
- `apps/mobile/__tests__/auth-and-orpc.test.tsx`
- `docs/stories/10-4-mobile-auth-and-orpc.md`

## Dev Agent Record

- **Model:** Gemini 4 Neon (High)
- **Started:** 2026-11-19T01:51:40Z
- **Completed:** 2026-11-19T04:40:00Z

### Scope override (2026-11-21)

The user directed that full web-interaction parity be implemented inside this story rather than a new one (branch `feature/155-10-4-mobile-auth-and-orpc`). Added AC-6 and tasks T9–T14. Out of scope on mobile, matching contract limits: bank-aggregator OAuth connect (Bridge redirect), CSV import, dashboard widget layout editing (no widget grid on mobile), and data export (REST `GET /v1/export`, outside `@pekulo/contracts`).

### Summary

Implemented chunked `expo-secure-store` session persistence, mobile Supabase Auth (`AuthProvider` + `/login` + root navigation route gating), typed `@pekulo/contracts` oRPC clients with Bearer JWT forwarding, React Query orchestration hooks (`use-mobile-queries.ts`), live wiring across all five tabs (`Cap`/`Patrimoine`, `Transactions` with 1-tap AI suggestion confirmation, `Mensuel`, `Portefeuille`, `Immobilier`) and `Paramètres`, plus a native iOS UI/UX polish pass (first-child `<ScrollView>` with `contentInsetAdjustmentBehavior="automatic"`, per-tab native iOS Large Title Stacks, native `Stack.SearchBar` on Transactions, native `formSheet` presentation on Paramètres, native `Alert.alert` destructive sign-out confirmation, pull-to-refresh, toast feedback, and honest loading/error/empty states) with zero web snapshot or Tamagui CSS regressions.

### Files changed

- `apps/mobile/__tests__/auth-and-orpc.test.tsx`
- `apps/mobile/__tests__/cap-screen.test.tsx`
- `apps/mobile/__tests__/navigation-tabs.test.tsx`
- `apps/mobile/app.json`
- `apps/mobile/app/(tabs)/(cap)/index.tsx`
- `apps/mobile/app/(tabs)/immobilier/_layout.tsx`
- `apps/mobile/app/(tabs)/immobilier/index.tsx`
- `apps/mobile/app/(tabs)/mensuel/_layout.tsx`
- `apps/mobile/app/(tabs)/mensuel/index.tsx`
- `apps/mobile/app/(tabs)/portefeuille/_layout.tsx`
- `apps/mobile/app/(tabs)/portefeuille/index.tsx`
- `apps/mobile/app/(tabs)/transactions/_layout.tsx`
- `apps/mobile/app/(tabs)/transactions/index.tsx`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/login.tsx`
- `apps/mobile/app/parametres.tsx`
- `apps/mobile/components/screen-shell.tsx`
- `apps/mobile/components/screen-states.tsx`
- `apps/mobile/components/tab-stack-layout.tsx`
- `apps/mobile/jest.config.js`
- `apps/mobile/jest.setup.ts`
- `apps/mobile/lib/auth/auth-context.tsx`
- `apps/mobile/lib/hooks/use-mobile-queries.ts`
- `apps/mobile/lib/orpc/client.ts`
- `apps/mobile/lib/orpc/modules.ts`
- `apps/mobile/lib/supabase/client.ts`
- `apps/mobile/lib/supabase/secure-storage.ts`
- `apps/mobile/package.json`
- `bun.lock`
- `docs/state.yaml`
- `docs/stories/10-4-mobile-auth-and-orpc.md`

### Deviations

- **Jest `.mjs` transform (`apps/mobile/jest.config.js`):** Extended `jest-expo`'s default `\\.[jt]sx?$` transform to `\\.m?[jt]sx?$` and allowed `@standard-schema/.*` + `zod` in `transformIgnorePatterns`, because `@orpc/client@1.14.1` ships `.mjs` ESM entrypoints that Jest CommonJS mode otherwise rejects with `createRequireEsmError`.
- **Direct `process.env.EXPO_PUBLIC_*` reads (`apps/mobile/lib/supabase/client.ts`, `apps/mobile/lib/orpc/client.ts`):** Read `process.env.EXPO_PUBLIC_SUPABASE_URL`, `process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `process.env.EXPO_PUBLIC_API_BASE_URL` via direct member expressions when no `env` override is passed so `babel-preset-expo` statically inlines them in Hermes native bundles.
- **`AuthProvider` & `QueryClient` hardening (`apps/mobile/lib/auth/auth-context.tsx`):**
  - Short-circuited `supabase.auth.onAuthStateChange` whenever `!configured` so placeholder Supabase's async `INITIAL_SESSION: null` never clobbers an injected `initialSession` in tests/preview mode.
  - Updated `setAccessTokenResolver` immediately before `queryClient.invalidateQueries()` on sign-in (and reset on unmount/sign-out) to eliminate a refetch race before React commits `useEffect`.
  - Used `gcTime: Infinity` under `NODE_ENV === "test"` on queries and mutations so TanStack Query v5's `MutationCache` GC timers do not leave open handles in Jest.
- **Negative-balance clamping & progress ratio (`apps/mobile/lib/hooks/use-mobile-queries.ts`):** Clamped all three composition terms (`liquideEur`, `placementsEur`, `immobilierEur`) with `Math.max(0, ...)` when summing `totalPositive` so composition percentages stay bounded in `[0, 1]` even with an overdrawn cash account; exposed `progressRatio` on `MobileCapViewData` for `PekuloDonut`.
- **Native iOS UI/UX polish (`apps/mobile/components/{screen-shell,screen-states,tab-stack-layout}.tsx`, `apps/mobile/app/**`):**
  - Made `<ScrollView contentInsetAdjustmentBehavior="automatic" automaticallyAdjustKeyboardInsets>` the direct root child in `ScreenShell` (with Android-only manual SafeAreaInsets to avoid double insets on iOS) and added pull-to-refresh (`RefreshControl`).
  - Converted the 4 flat tab files (`transactions.tsx`, `mensuel.tsx`, `portefeuille.tsx`, `immobilier.tsx`) into folder Stacks (`<tab>/{_layout,index}.tsx`) preserving identical URLs to unlock native iOS translucent Large Titles, native `Stack.SearchBar` on `Transactions`, and a 44×44pt HIG settings button.
  - Presented `parametres` as a native iOS `formSheet` (`sheetGrabberVisible`, `sheetAllowedDetents: [0.85, 1.0]`), held `SplashScreen` until both fonts and auth resolve, added native `Alert.alert` destructive sign-out confirmation, `useToast()` feedback, and honest `ScreenLoadingSkeleton` / `ScreenErrorState` states across all 5 tabs.
  - Removed duplicate inline `"Cap"` title above `PekuloTopTabToggle` to match `docs/ux-preview/src/App.tsx` 1:1.
- **Existing test updates (`apps/mobile/__tests__/{cap-screen,navigation-tabs,auth-and-orpc}.test.tsx`):** Wrapped `<CapScreen />` renders with `<QueryClientProvider>`, updated `navigation-tabs.test.tsx` to use `router.navigate` + `toHavePathname` for nested Stack tabs (Expo Router 58 injects `?__internal_expo_router_no_animation=true`), and added native `Alert.alert` sign-out and loading/error/retry test coverage (`20 passed` across 4 suites).
- **oRPC test harness fixes (`apps/mobile/__tests__/auth-and-orpc.test.tsx`):** Read headers from `input instanceof Request ? input.headers : new Headers(init?.headers)` in the AC-2 fetch spy and mocked default oRPC module singletons while preserving real `createMobileOrpcClients` for AC-2 wire tests.
- **Visual verification (`AGENTS.md` / Step 5):** React Grab MCP (`mcp__react-grab-mcp__get_element_context`) is unavailable in this environment; live iOS Simulator visual verification requires rebuilding the native Dev Build (`cd apps/mobile && bun run prebuild && bun run ios`) so `ExpoSecureStore` is linked in `apps/mobile/ios/Podfile.lock`.

### Test output

- `bun run format:check` — exit 0
- `bun run lint` — exit 0 (`0 warnings, 0 errors` in `@pekulo/mobile`)
- `bun run typecheck` — exit 0 (`10 successful, 10 total`)
- `bun --filter='@pekulo/mobile' run test` — exit 0 (`Test Suites: 4 passed, 4 total`, `Tests: 20 passed, 20 total`)
- `bun --filter='@pekulo/ui' run test` — exit 0 (`Test Files: 159 passed (159)`, `Tests: 342 passed | 1 skipped (343)`)
- `bun --filter='@pekulo/web' run test` — exit 0 (`Test Files: 125 passed (125)`, `Tests: 435 passed (435)`)
- `bun run generate:tamagui-css && git diff --exit-code packages/ui/public/tamagui.generated.css` — exit 0 (zero diff)
