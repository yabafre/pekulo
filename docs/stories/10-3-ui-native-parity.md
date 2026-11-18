# Story: 10-3-ui-native-parity — Port remaining web-coupled `@pekulo/ui` files to cross-platform React Native

**Epic:** Epic 10 — Design system parity (V1.5)
**Status:** review
**Ticket:** #154
**Branch:** feature/154-10-3-ui-native-parity
**Complexity:** L
**Covered FRs:** FR-55, FR-56 (native DS component parity)

## User Story

**As a** Pekulo developer, **I want** all remaining `@pekulo/ui` primitives and `Pekulo*` components (`lucide-react-native`, `react-native-svg` for `PekuloDonut`/charts, native `@react-native-community/datetimepicker` and `@react-native-picker/picker` pickers, `@tamagui/sheet` drawer, native toast viewport, and removal of `var(--)` / `<style>` / HTML tags on the React Native path) ported to React Native and re-exported from `packages/ui/src/index.native.ts`, **so that** `apps/mobile` consumes the complete Pekulo Design System without web-DOM forks or web snapshot regressions.

## Acceptance Criteria

- **AC-1 (100% barrel parity & mechanical coverage gate)** — **Given** the complete `@pekulo/ui` public barrel surface (`provider`, `toast`, `tokens`, `themes`, `animations`, all 33 primitives, and all 42 components), **When** the design-system coverage suite runs, **Then** it excludes React Native sibling variants from web primitive enumeration AND asserts that every public module and symbol exposed on web is also exported by the React Native barrel entrypoint.
- **AC-2 (Zero web snapshot & CSS regression)** — **Given** the existing `@pekulo/ui` visual snapshots, accessibility specs, `@pekulo/web` test suite, and generated Tamagui stylesheet artifact, **When** the web unit, visual snapshot, accessibility, web application, and CSS generation checks run, **Then** every check exits 0 with zero snapshot diffs and zero generated CSS diffs.
- **AC-3 (Native SVG charts & Lucide icons with theme tokens)** — **Given** `PekuloDonut`, `PekuloTrajectoryChart`, `PekuloProjectionChart`, `CategoryIcon`, `TransactionLogo`, and every icon-bearing component or primitive, **When** rendered inside `PekuloRootProvider` in both `pekulo-dark` and `pekulo-light` themes under React Native Jest, **Then** colors resolve from Tamagui theme tokens (`donutTrack`, `donutFill`, `chartActual`, `chartPlan`, `color`, `colorSecondary`, `colorTertiary`, `success`, `danger`) without CSS custom properties, `currentColor`, HTML `<svg>`, or HTML `<img>`.
- **AC-4 (Native form controls, pickers, overlays, navigation & interactive flows)** — **Given** `PekuloButton`, `PekuloButtonGroup`, `PekuloSubmitButton`, `PekuloInput`, `PekuloTextarea`, `PekuloLabel`, `PekuloProgress`, `PekuloEmpty`, `PekuloCard`, `PekuloSwitch`, `PekuloCheckbox`, `PekuloNativeCheckbox`, `PekuloSelect`, `PekuloNativeSelect`, `PekuloPopover`, `PekuloDialogCloseX`, `PekuloDrawer`, `PekuloBreadcrumb`, `PekuloCalendar`, `PekuloDatePicker`, `PekuloResizable`, `PekuloSpinner`, `PekuloSkeleton`, `PekuloStaggerList`, `PekuloErrorBoundary`, `PekuloSegmentedControl`, `PekuloPagination`, `PekuloSuggestionRow`, `PekuloMobileBottomNav`, `PekuloNavRail`, and `PekuloToastViewport`, **When** mounted and interacted with in Jest (`@testing-library/react-native`), **Then** each renders without native view/DOM errors and honours its core interactions (press, text input, password reveal, toggle/checkbox, native picker selection, date selection, segmented switch, pagination, toast display).
- **AC-5 (Full monorepo quality gates)** — **Given** all workspace packages and apps, **When** `bun run typecheck`, `bun run lint`, `bun run format:check`, `bun --filter='@pekulo/mobile' run test`, and `bun --filter='@pekulo/ui' run test` run, **Then** every command exits 0.

## Tasks

Task order is load-bearing: **install native dependencies and configure Jest mocks (T1)** and **shared hooks/toast/state primitives (T2)** first so charts (T3), icon components (T4–T5), primitives (T6–T8), barrel/meta-test (T9), and parity suites (T10–T11) compile and execute cleanly at every slice. Follow every command literally.

- [x] **T1 — Add native UI dependencies (`react-native-svg`, `lucide-react-native`, `@react-native-community/datetimepicker`, `@react-native-picker/picker`) and update Jest configuration** [AC: AC-3, AC-4, AC-5]

  Update `apps/mobile/package.json` `"dependencies"` (keeping alphabetical order and Expo SDK 58 pinned versions from `bundledNativeModules.json`):

  ```json
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
  ```

  Update `packages/ui/package.json` `"devDependencies"`, `"peerDependencies"`, and add `"peerDependenciesMeta"` so `@pekulo/ui`'s `.native.tsx` modules resolve `lucide-react-native`, `react-native-svg`, `@react-native-community/datetimepicker`, and `@react-native-picker/picker` under Bun's isolated `.bun/` linker without forcing `apps/web` to depend on them at runtime:

  ```json
    "devDependencies": {
      "@pekulo/tsconfig": "workspace:*",
      "@react-native-community/datetimepicker": "9.2.1",
      "@react-native-picker/picker": "2.11.4",
      "@tamagui/cli": "2.3.1",
      "@testing-library/jest-dom": "^6.0.0",
      "@testing-library/react": "^16.0.0",
      "@types/bun": "^1.3.0",
      "@types/node": "^20",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      "@vitest/coverage-v8": "^3.2.6",
      "happy-dom": "^20.0.0",
      "lucide-react-native": "^1.73.0",
      "react": "19.3.0",
      "react-dom": "19.3.0",
      "react-native-svg": "15.16.0",
      "typescript": "^6.0.3",
      "vitest": "^3.2.6",
      "vitest-axe": "^0.1.0"
    },
    "peerDependencies": {
      "@react-native-community/datetimepicker": "9.2.1",
      "@react-native-picker/picker": "2.11.4",
      "lucide-react-native": "^1.73.0",
      "react": "19.3.0",
      "react-dom": "19.3.0",
      "react-native-svg": "15.16.0"
    },
    "peerDependenciesMeta": {
      "@react-native-community/datetimepicker": {
        "optional": true
      },
      "@react-native-picker/picker": {
        "optional": true
      },
      "lucide-react-native": {
        "optional": true
      },
      "react-native-svg": {
        "optional": true
      }
    }
  ```

  Update `apps/mobile/jest.config.js` so `react-native-svg`, `lucide-react-native`, `@react-native-community/datetimepicker`, and `@react-native-picker/picker` resolve cleanly through Bun's `.bun/` store and Babel transform patterns:

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

  Update `apps/mobile/jest.setup.ts` to add clean JS test mocks for `@react-native-community/datetimepicker` and `@react-native-picker/picker`:

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

  jest.mock("@react-native-community/datetimepicker", () => {
    const React = require("react");
    const { Pressable, Text } = require("react-native");
    return function MockDateTimePicker({
      value,
      onChange,
      testID,
      accessibilityLabel,
    }: {
      value: Date;
      onChange?: (event: { type: string; nativeEvent: { timestamp: number } }, date?: Date) => void;
      testID?: string;
      accessibilityLabel?: string;
    }) {
      return React.createElement(
        Pressable,
        {
          testID: testID ?? "native-datetimepicker",
          accessibilityLabel,
          onPress: () =>
            onChange?.({ type: "set", nativeEvent: { timestamp: value.getTime() } }, value),
        },
        React.createElement(Text, null, value.toISOString()),
      );
    };
  });

  jest.mock("@react-native-picker/picker", () => {
    const React = require("react");
    const { View, Pressable, Text } = require("react-native");
    function MockPicker({
      children,
      selectedValue,
      onValueChange,
      testID,
      accessibilityLabel,
    }: {
      children?: React.ReactNode;
      selectedValue?: string;
      onValueChange?: (value: string, index: number) => void;
      testID?: string;
      accessibilityLabel?: string;
    }) {
      return React.createElement(
        View,
        { testID: testID ?? "native-picker", accessibilityLabel, accessibilityValue: { text: selectedValue } },
        React.Children.map(children, (child, index) => {
          if (!React.isValidElement(child)) return child;
          const itemProps = child.props as { label?: string; value?: string };
          return React.createElement(
            Pressable,
            {
              key: itemProps.value ?? index,
              onPress: () => {
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

  Run: `bun install && bun --filter='@pekulo/mobile' run test && bun --filter='@pekulo/ui' run typecheck`
  Expected: `bun install` resolves cleanly with zero peer conflicts; `@pekulo/mobile` Jest baseline (`8 passed`) and `@pekulo/ui` `typecheck` exit 0.
  Commit: `git add apps/mobile/package.json packages/ui/package.json apps/mobile/jest.config.js apps/mobile/jest.setup.ts bun.lock && git commit -m "chore(#154): add native UI dependencies and Jest mocks for Expo SDK 58"`

- [x] **T2 — Make `use-stagger.ts` RN-safe and add native `toast`, `provider`, `PekuloSpinner`, `PekuloSkeleton`, `PekuloStaggerList`, and `PekuloErrorBoundary`** [AC: AC-2, AC-4]

  Update `packages/ui/src/animations/use-stagger.ts` to guard `typeof window.matchMedia === "function"` (matching `use-count-up.ts`, zero web DOM change):

  ```ts
  "use client";

  // packages/ui/src/animations/use-stagger.ts
  // Computes per-item delays for a staggered list animation. Returns
  // [0, delayMs, 2·delayMs, ...] under normal motion ; [0, 0, ...] under
  // prefers-reduced-motion: reduce.
  //
  // The component consuming this hook applies the delays via Tamagui's
  // `enterStyle` + `animation` props (animations-css driver).

  import { useMemo, useSyncExternalStore } from "react";

  function getReducedMotion(): boolean {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function subscribeReducedMotion(cb: () => void): () => void {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }

  export function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(
      subscribeReducedMotion,
      getReducedMotion,
      () => false /* SSR-safe default */,
    );
  }

  export function useStagger(itemCount: number, delayMs = 40): number[] {
    const reduced = usePrefersReducedMotion();
    return useMemo(() => {
      if (reduced) return Array.from({ length: itemCount }, () => 0);
      return Array.from({ length: itemCount }, (_, i) => i * delayMs);
    }, [itemCount, delayMs, reduced]);
  }
  ```

  Create `packages/ui/src/toast/index.native.tsx`:

  ```tsx
  // packages/ui/src/toast/index.native.tsx
  // React Native toast provider, hook, and viewport (uses position="absolute"
  // instead of web CSS position="fixed").

  import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
  import { Text, View } from "tamagui";

  export type ToastIntent = "success" | "info" | "warning" | "danger";

  export interface ToastEntry {
    id: number;
    title: string;
    description?: string;
    intent: ToastIntent;
    durationMs: number;
  }

  interface ToastContextValue {
    show: (e: Omit<ToastEntry, "id" | "durationMs"> & { durationMs?: number }) => void;
    entries: ToastEntry[];
  }

  const ToastContext = createContext<ToastContextValue | null>(null);

  let toastSeq = 0;

  export function ToastProvider({ children }: { children: ReactNode }) {
    const [entries, setEntries] = useState<ToastEntry[]>([]);

    const show = useCallback<ToastContextValue["show"]>((e) => {
      const id = ++toastSeq;
      const entry: ToastEntry = {
        id,
        intent: e.intent,
        title: e.title,
        description: e.description,
        durationMs: e.durationMs ?? 4000,
      };
      setEntries((prev) => [...prev, entry]);
      setTimeout(() => {
        setEntries((prev) => prev.filter((x) => x.id !== id));
      }, entry.durationMs);
    }, []);

    const value = useMemo<ToastContextValue>(() => ({ show, entries }), [show, entries]);
    return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
  }

  export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) {
      throw new Error(
        "useToast must be used inside <ToastProvider> (mounted by PekuloRootProvider).",
      );
    }
    const { show } = ctx;
    return useMemo(
      () => ({
        success: (title: string, description?: string, durationMs?: number) =>
          show({ intent: "success", title, description, durationMs }),
        info: (title: string, description?: string, durationMs?: number) =>
          show({ intent: "info", title, description, durationMs }),
        warning: (title: string, description?: string, durationMs?: number) =>
          show({ intent: "warning", title, description, durationMs }),
        danger: (title: string, description?: string, durationMs?: number) =>
          show({ intent: "danger", title, description, durationMs }),
      }),
      [show],
    );
  }

  function intentColor(intent: ToastIntent): string {
    return intent === "success"
      ? "$success"
      : intent === "danger"
        ? "$danger"
        : intent === "warning"
          ? "$warning"
          : "$info";
  }

  export function PekuloToast({ entry }: { entry: ToastEntry }) {
    return (
      <View
        backgroundColor="$backgroundElevated"
        borderRadius="$lg"
        padding="$3"
        role="alert"
        accessibilityLiveRegion="polite"
      >
        <View flexDirection="row" alignItems="flex-start" gap="$2">
          <View
            width={6}
            height={6}
            borderRadius="$full"
            marginTop={6}
            backgroundColor={intentColor(entry.intent) as never}
          />
          <View flex={1}>
            <Text color="$color" fontSize="$caption" fontWeight="600">
              {entry.title}
            </Text>
            {entry.description && (
              <Text color="$colorSecondary" fontSize="$xs" marginTop={2}>
                {entry.description}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  }

  export function PekuloToastViewport() {
    const ctx = useContext(ToastContext);
    if (!ctx || ctx.entries.length === 0) return null;
    return (
      <View
        position="absolute"
        bottom="$6"
        left="$4"
        right="$4"
        flexDirection="column"
        gap="$2"
        zIndex={1000}
        pointerEvents="box-none"
      >
        {ctx.entries.map((e) => (
          <PekuloToast key={e.id} entry={e} />
        ))}
      </View>
    );
  }
  ```

  Update `packages/ui/src/provider/index.native.tsx` to provide `useThemeSetting` and mount `ToastProvider` + `PekuloToastViewport`:

  ```tsx
  // packages/ui/src/provider/index.native.tsx
  // Native root provider for @pekulo/ui consumers (apps/mobile).
  // Mounts TamaguiProvider with Pekulo themes (`pekulo-dark` / `pekulo-light`)
  // driven by OS color scheme or an explicit theme override, plus ToastProvider
  // and runtime theme switching context (`useThemeSetting`).

  import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
  import { useColorScheme } from "react-native";
  import { TamaguiProvider, Theme } from "tamagui";

  import { config } from "../config/tamagui";
  import { PekuloToastViewport, ToastProvider } from "../toast/index.native";

  export interface PekuloRootProviderProps {
    children: ReactNode;
    /** Optional explicit theme override; defaults to OS color scheme ("pekulo-dark" fallback). */
    theme?: "pekulo-dark" | "pekulo-light" | "system";
  }

  export interface NativeThemeSetting {
    current: "pekulo-dark" | "pekulo-light" | "system";
    resolvedTheme: "pekulo-dark" | "pekulo-light";
    themes: Array<"pekulo-dark" | "pekulo-light">;
    set: (next: "pekulo-dark" | "pekulo-light" | "system") => void;
  }

  const NativeThemeContext = createContext<NativeThemeSetting>({
    current: "system",
    resolvedTheme: "pekulo-dark",
    themes: ["pekulo-dark", "pekulo-light"],
    set: () => {},
  });

  export function useThemeSetting(): NativeThemeSetting {
    return useContext(NativeThemeContext);
  }

  export function PekuloRootProvider({ children, theme = "system" }: PekuloRootProviderProps) {
    const colorScheme = useColorScheme();
    const [override, setOverride] = useState<"pekulo-dark" | "pekulo-light" | "system" | null>(null);
    const activeChoice = override ?? theme;
    const resolvedTheme: "pekulo-dark" | "pekulo-light" =
      activeChoice === "system"
        ? colorScheme === "light"
          ? "pekulo-light"
          : "pekulo-dark"
        : activeChoice;

    const setting = useMemo<NativeThemeSetting>(
      () => ({
        current: activeChoice,
        resolvedTheme,
        themes: ["pekulo-dark", "pekulo-light"],
        set: setOverride,
      }),
      [activeChoice, resolvedTheme],
    );

    return (
      <NativeThemeContext.Provider value={setting}>
        <TamaguiProvider config={config} defaultTheme={resolvedTheme}>
          <Theme name={resolvedTheme}>
            <ToastProvider>
              {children}
              <PekuloToastViewport />
            </ToastProvider>
          </Theme>
        </TamaguiProvider>
      </NativeThemeContext.Provider>
    );
  }
  ```

  Create `packages/ui/src/primitives/PekuloSpinner.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloSpinner.native.tsx
  // Native loading spinner using lucide-react-native Loader2 + Animated rotation.

  import { Loader2 } from "lucide-react-native";
  import { useEffect, useRef } from "react";
  import { Animated, Easing } from "react-native";
  import { View, useTheme } from "tamagui";

  export interface PekuloSpinnerProps {
    size?: number;
    color?: string;
    ariaLabel?: string;
  }

  export function PekuloSpinner({ size = 16, color, ariaLabel = "Chargement" }: PekuloSpinnerProps) {
    const theme = useTheme();
    const spin = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      const loop = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }, [spin]);

    const rotate = spin.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });

    const resolvedColor = color && !color.startsWith("var(") ? color : theme.color.val;

    return (
      <View
        alignItems="center"
        justifyContent="center"
        accessibilityRole={ariaLabel.length > 0 ? "progressbar" : undefined}
        accessibilityLabel={ariaLabel.length > 0 ? ariaLabel : undefined}
        accessibilityElementsHidden={ariaLabel.length === 0}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Loader2 size={size} color={resolvedColor} />
        </Animated.View>
      </View>
    );
  }
  ```

  Create `packages/ui/src/components/PekuloSkeleton/PekuloSkeleton.native.tsx`:

  ```tsx
  // packages/ui/src/components/PekuloSkeleton/PekuloSkeleton.native.tsx
  // Native skeleton placeholder with Animated opacity pulse (no <style> keyframes).

  import { useEffect, useRef } from "react";
  import { Animated } from "react-native";
  import { View, useTheme } from "tamagui";

  export interface PekuloSkeletonProps {
    lines?: number;
    height?: number;
    block?: boolean;
    width?: number | `${number}%`;
  }

  export function PekuloSkeleton({ lines = 1, height = 16, block, width }: PekuloSkeletonProps) {
    const theme = useTheme();
    const opacity = useRef(new Animated.Value(0.6)).current;

    useEffect(() => {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.3, duration: 750, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 750, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }, [opacity]);

    if (block) {
      return (
        <Animated.View
          accessibilityElementsHidden
          style={{
            width: width ?? "100%",
            height,
            borderRadius: 8,
            backgroundColor: theme.backgroundMuted.val,
            opacity,
          }}
        />
      );
    }

    return (
      <View flexDirection="column" gap={6} accessibilityElementsHidden>
        {Array.from({ length: lines }, (_, i) => (
          <Animated.View
            key={i}
            style={{
              height,
              width: width ?? `${100 - i * 12}%`,
              borderRadius: 6,
              backgroundColor: theme.backgroundMuted.val,
              opacity,
            }}
          />
        ))}
      </View>
    );
  }
  ```

  Create `packages/ui/src/components/PekuloStaggerList/PekuloStaggerList.native.tsx`:

  ```tsx
  // packages/ui/src/components/PekuloStaggerList/PekuloStaggerList.native.tsx
  // Native stagger container using Tamagui View (omits web <ul>/<li> and CSS animationDelay).

  import { Children, type ReactNode } from "react";
  import { View } from "tamagui";
  import { useStagger } from "../../animations/use-stagger";

  export interface PekuloStaggerListProps {
    children: ReactNode;
    delayMs?: number;
    className?: string;
    ariaLabel?: string;
  }

  export function PekuloStaggerList({
    children,
    delayMs = 40,
    ariaLabel,
  }: PekuloStaggerListProps) {
    const items = Children.toArray(children);
    useStagger(items.length, delayMs);
    return (
      <View aria-label={ariaLabel} flexDirection="column">
        {items.map((child, i) => (
          <View key={i}>{child}</View>
        ))}
      </View>
    );
  }
  ```

  Create `packages/ui/src/components/PekuloErrorBoundary/PekuloErrorBoundary.native.tsx`:

  ```tsx
  // packages/ui/src/components/PekuloErrorBoundary/PekuloErrorBoundary.native.tsx
  // Native error boundary using flex={1} instead of web CSS minHeight: "100dvh".

  import { Component, type ErrorInfo, type ReactNode } from "react";
  import { Text, View } from "tamagui";

  export interface PekuloErrorBoundaryProps {
    fallback?: ReactNode;
    fullScreen?: boolean;
    onError?: (error: Error, info: ErrorInfo) => void;
    children: ReactNode;
  }

  interface State {
    hasError: boolean;
    error: Error | null;
  }

  export class PekuloErrorBoundary extends Component<PekuloErrorBoundaryProps, State> {
    override state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
      return { hasError: true, error };
    }

    override componentDidCatch(error: Error, info: ErrorInfo): void {
      this.props.onError?.(error, info);
    }

    override render() {
      if (this.state.hasError) {
        if (this.props.fallback) return this.props.fallback;
        const card = (
          <View
            backgroundColor="$backgroundCard"
            borderRadius="$lg"
            padding="$5"
            role="alert"
            accessibilityLiveRegion="polite"
          >
            <Text color="$danger" fontSize="$bodySm" fontWeight="600">
              Une erreur s'est produite.
            </Text>
            <Text color="$colorSecondary" fontSize="$caption" marginTop="$1">
              {this.state.error?.message ?? "Détails indisponibles."}
            </Text>
          </View>
        );
        if (this.props.fullScreen) {
          return (
            <View
              backgroundColor="$background"
              flex={1}
              alignItems="center"
              justifyContent="center"
              padding="$5"
            >
              {card}
            </View>
          );
        }
        return card;
      }
      return this.props.children;
    }
  }
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck && bun --filter='@pekulo/ui' run test:visual`
  Expected: `typecheck` exits 0; all existing web snapshots pass unchanged.
  Commit: `git add packages/ui/src/animations/use-stagger.ts packages/ui/src/toast/index.native.tsx packages/ui/src/provider/index.native.tsx packages/ui/src/primitives/PekuloSpinner.native.tsx packages/ui/src/components/PekuloSkeleton/PekuloSkeleton.native.tsx packages/ui/src/components/PekuloStaggerList/PekuloStaggerList.native.tsx packages/ui/src/components/PekuloErrorBoundary/PekuloErrorBoundary.native.tsx && git commit -m "feat(#154): add native toast, provider theme setting, spinner, skeleton, stagger list, and error boundary"`

- [x] **T3 — Port SVG charts & donut (`PekuloDonut`, `PekuloTrajectoryChart`, `PekuloProjectionChart`) to `react-native-svg` + `useTheme()`** [AC: AC-2, AC-3]

  Create `packages/ui/src/components/PekuloDonut/PekuloDonut.native.tsx`:

  ```tsx
  // packages/ui/src/components/PekuloDonut/PekuloDonut.native.tsx
  // Native TR-style ring chart rendered with react-native-svg + Tamagui useTheme().

  import Svg, { Circle } from "react-native-svg";
  import { Text, View, useTheme } from "tamagui";
  import { useCountUp } from "../../animations/use-count-up";

  export interface PekuloDonutProps {
    pct: number;
    size?: number;
    stroke?: number;
    centered?: boolean;
    ariaLabel?: string;
  }

  export function PekuloDonut({ pct, size = 96, stroke = 8, centered, ariaLabel }: PekuloDonutProps) {
    const theme = useTheme();
    const clamped = Math.max(0, Math.min(1, pct));
    const animated = useCountUp(clamped, { durationMs: 900, fromZero: true });
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - animated);
    const labelPct = Math.round(animated * 100);

    return (
      <View
        width={size}
        height={size}
        alignItems="center"
        justifyContent="center"
        position="relative"
        accessibilityRole={ariaLabel ? "image" : undefined}
        accessibilityLabel={ariaLabel}
        accessibilityElementsHidden={!ariaLabel}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={theme.donutTrack.val}
            strokeWidth={stroke}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={theme.donutFill.val}
            strokeWidth={stroke}
            strokeDasharray={`${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        {centered && (
          <View position="absolute" alignItems="center" justifyContent="center">
            <Text color="$color" fontSize={size * 0.34} fontWeight="600">
              {labelPct}%
            </Text>
          </View>
        )}
      </View>
    );
  }
  ```

  Create `packages/ui/src/components/PekuloTrajectoryChart/PekuloTrajectoryChart.native.tsx`:

  ```tsx
  // packages/ui/src/components/PekuloTrajectoryChart/PekuloTrajectoryChart.native.tsx
  // Native trajectory SVG chart (actual solid + plan dashed) using react-native-svg + useTheme().

  import Svg, { Path } from "react-native-svg";
  import { View, useTheme } from "tamagui";

  export interface PekuloTrajectoryChartProps {
    months: number[];
    actual: number[];
    plan: number[];
    tall?: boolean;
    inCard?: boolean;
  }

  export function PekuloTrajectoryChart({
    months,
    actual,
    plan,
    tall,
    inCard,
  }: PekuloTrajectoryChartProps) {
    const theme = useTheme();
    const width = 600;
    const height = tall ? 220 : 180;
    const padding = 8;
    const all = [...actual, ...plan];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const range = Math.max(max - min, 1);
    const xStep = (width - 2 * padding) / Math.max(months.length - 1, 1);
    const toY = (v: number) => padding + (height - 2 * padding) * (1 - (v - min) / range);
    const toPath = (data: number[]) =>
      data.map((v, i) => `${i === 0 ? "M" : "L"} ${padding + i * xStep} ${toY(v)}`).join(" ");

    const inner = (
      <View
        width="100%"
        height={height}
        accessibilityRole="image"
        accessibilityLabel="Trajectoire patrimoine"
      >
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <Path
            d={toPath(plan)}
            stroke={theme.chartPlan.val}
            strokeWidth={2}
            strokeDasharray={[4, 4]}
            fill="none"
          />
          <Path d={toPath(actual)} stroke={theme.chartActual.val} strokeWidth={2} fill="none" />
        </Svg>
      </View>
    );

    if (inCard) {
      return (
        <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5">
          {inner}
        </View>
      );
    }
    return inner;
  }
  ```

  Create `packages/ui/src/components/PekuloProjectionChart/PekuloProjectionChart.native.tsx`:

  ```tsx
  // packages/ui/src/components/PekuloProjectionChart/PekuloProjectionChart.native.tsx
  // Native hypothesis projection vs cap-required SVG chart using react-native-svg + useTheme().

  import Svg, { Circle, Path } from "react-native-svg";
  import { Text, View, useTheme } from "tamagui";

  export interface PekuloProjectionChartProps {
    years: number[];
    actual: number[];
    required: number[];
    nowMarker?: { year: number; value: number };
    capMarker?: { year: number; value: number };
    ariaLabel?: string;
  }

  export function PekuloProjectionChart({
    years,
    actual,
    required,
    nowMarker,
    capMarker,
    ariaLabel = "Projection par rapport au cap requis",
  }: PekuloProjectionChartProps) {
    const theme = useTheme();
    const width = 600;
    const height = 220;
    const padding = 12;
    const all = [
      ...actual,
      ...required,
      ...(nowMarker ? [nowMarker.value] : []),
      ...(capMarker ? [capMarker.value] : []),
    ];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const range = Math.max(max - min, 1);
    const xStep = (width - 2 * padding) / Math.max(years.length - 1, 1);
    const toX = (i: number) => padding + i * xStep;
    const toY = (v: number) => padding + (height - 2 * padding) * (1 - (v - min) / range);
    const toPath = (d: number[]) =>
      d.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ");
    const idxOf = (y: number) => Math.max(0, years.indexOf(y));

    return (
      <View flexDirection="column">
        <View height={height} accessibilityRole="image" accessibilityLabel={ariaLabel}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
            <Path
              d={toPath(required)}
              stroke={theme.chartPlan.val}
              strokeWidth={2}
              strokeDasharray={[4, 4]}
              fill="none"
            />
            <Path d={toPath(actual)} stroke={theme.chartActual.val} strokeWidth={2} fill="none" />
            {nowMarker && (
              <Circle
                cx={toX(idxOf(nowMarker.year))}
                cy={toY(nowMarker.value)}
                r={5}
                fill={theme.chartActual.val}
              />
            )}
            {capMarker && (
              <Circle
                cx={toX(idxOf(capMarker.year))}
                cy={toY(capMarker.value)}
                r={5}
                fill="none"
                stroke={theme.chartActual.val}
                strokeWidth={2}
              />
            )}
          </Svg>
        </View>
        <View flexDirection="row" justifyContent="space-between" marginTop="$1">
          <Text color="$colorTertiary" fontSize="$11">
            {years[0]}
          </Text>
          <Text color="$colorTertiary" fontSize="$11">
            {years[years.length - 1]}
          </Text>
        </View>
      </View>
    );
  }
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck && bun --filter='@pekulo/ui' run test:visual`
  Expected: `typecheck` exits 0; web chart/donut snapshots pass unchanged.
  Commit: `git add packages/ui/src/components/PekuloDonut/PekuloDonut.native.tsx packages/ui/src/components/PekuloTrajectoryChart/PekuloTrajectoryChart.native.tsx packages/ui/src/components/PekuloProjectionChart/PekuloProjectionChart.native.tsx && git commit -m "feat(#154): add react-native-svg native implementations for donut and charts"`

- [x] **T4 — Port icon-bearing & media domain components (`CategoryIcon`, `TransactionLogo`, `HeaderAction`, `PekuloActivityRow`, `PekuloMilestoneRow`, `PekuloMonthlyRow`, `PekuloContextualAddButton`, `PekuloEmptyState`)** [AC: AC-2, AC-3]

  Create `packages/ui/src/components/CategoryIcon/CategoryIcon.native.tsx`:

  ```tsx
  // packages/ui/src/components/CategoryIcon/CategoryIcon.native.tsx
  import type { ComponentType } from "react";
  import {
    ArrowLeftRight,
    Banknote,
    Gift,
    HeartPulse,
    House,
    Landmark,
    Laptop,
    Martini,
    MonitorSmartphone,
    Plane,
    ReceiptText,
    RefreshCw,
    ShoppingCart,
    Tag,
    TramFront,
    TriangleAlert,
    Utensils,
  } from "lucide-react-native";
  import { useTheme } from "tamagui";

  type IconProps = {
    size?: number;
    color?: string;
    strokeWidth?: number;
  };
  type IconComponent = ComponentType<IconProps>;

  export const CATEGORY_ICONS: Record<string, IconComponent> = {
    salaire: Banknote,
    freelance: Laptop,
    remote: MonitorSmartphone,
    bonus: Gift,
    loyer: House,
    courses: ShoppingCart,
    transport: TramFront,
    sorties: Martini,
    voyage: Plane,
    sante: HeartPulse,
    imprevu: TriangleAlert,
    autre: Tag,
    transfer: ArrowLeftRight,
    factures: ReceiptText,
    restauration: Utensils,
    abonnements: RefreshCw,
    retrait: Landmark,
  };

  export interface CategoryIconProps {
    category: string;
    size?: number;
    color?: string;
  }

  export function CategoryIcon({ category, size = 14, color }: CategoryIconProps) {
    const theme = useTheme();
    const Icon = CATEGORY_ICONS[category] ?? Tag;
    const resolvedColor = color && !color.startsWith("var(") ? color : theme.colorTertiary.val;
    return <Icon size={size} color={resolvedColor} />;
  }
  ```

  Create `packages/ui/src/components/TransactionLogo/TransactionLogo.native.tsx`:

  ```tsx
  // packages/ui/src/components/TransactionLogo/TransactionLogo.native.tsx
  import { useEffect, useState } from "react";
  import { Image } from "react-native";
  import { View } from "tamagui";
  import { CategoryIcon } from "../CategoryIcon/CategoryIcon.native";

  export interface TransactionLogoProps {
    src?: string | null;
    category: string;
    size?: number;
  }

  export function TransactionLogo({ src, category, size = 28 }: TransactionLogoProps) {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [src]);
    const showImg = Boolean(src) && !failed;

    return (
      <View
        width={size}
        height={size}
        borderRadius="$full"
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
        backgroundColor="$backgroundMuted"
        accessibilityElementsHidden
      >
        {showImg && src ? (
          <Image
            source={{ uri: src }}
            style={{ width: size, height: size }}
            resizeMode="contain"
            onError={() => setFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <CategoryIcon category={category} size={Math.round(size * 0.6)} />
        )}
      </View>
    );
  }
  ```

  Create `packages/ui/src/primitives/HeaderAction.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/HeaderAction.native.tsx
  import type { ComponentType } from "react";
  import { Text, View, styled, useTheme } from "tamagui";

  type LucideIcon = ComponentType<{ size?: number; color?: string }>;

  export interface HeaderActionProps {
    icon?: LucideIcon;
    iconRight?: LucideIcon;
    label: string;
    onPress?: () => void;
    disabled?: boolean;
  }

  const PillButton = styled(View, {
    name: "HeaderActionPill",
    role: "button",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: "$8",
    paddingHorizontal: "$3",
    borderRadius: "$full",
    backgroundColor: "$backgroundMuted",
    pressStyle: {
      backgroundColor: "$backgroundElevated",
      scale: 0.97,
    },
    disabledStyle: {
      opacity: 0.5,
    },
  });

  export function HeaderAction({
    icon: Icon,
    iconRight: IconRight,
    label,
    onPress,
    disabled,
  }: HeaderActionProps) {
    const theme = useTheme();
    const handleClick = () => {
      if (disabled) return;
      onPress?.();
    };

    return (
      <PillButton onPress={handleClick} disabled={disabled} aria-disabled={disabled || undefined}>
        {Icon && <Icon size={14} color={theme.color.val} />}
        <Text color="$color" fontSize="$caption" fontWeight="500">
          {label}
        </Text>
        {IconRight && <IconRight size={14} color={theme.color.val} />}
      </PillButton>
    );
  }
  ```

  Create `packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.native.tsx`:

  ```tsx
  // packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.native.tsx
  import type { ReactNode } from "react";
  import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react-native";
  import { Text, View, useTheme } from "tamagui";
  import type { Activity } from "@pekulo/types";

  const eur0 = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  export interface PekuloActivityRowProps {
    tx: Activity;
    categoryPrefix?: ReactNode;
    logo?: ReactNode;
    aiApplied?: boolean;
  }

  export function PekuloActivityRow({ tx, categoryPrefix, logo, aiApplied }: PekuloActivityRowProps) {
    const theme = useTheme();
    const isInflow = tx.direction === "in";
    const Arrow = isInflow ? ArrowDownRight : ArrowUpRight;
    const arrowColor = isInflow ? theme.success.val : theme.colorTertiary.val;
    const amountColor = isInflow ? "$success" : "$color";
    const sign = isInflow ? "+" : "−";

    return (
      <View flexDirection="row" alignItems="center" gap="$3" paddingVertical="$3">
        {logo}
        <Arrow size={18} color={arrowColor} />
        <View flex={1} minWidth={0}>
          <Text color="$color" fontSize="$bodySm" fontWeight="500" numberOfLines={1}>
            {tx.label}
          </Text>
          <View flexDirection="row" alignItems="center" minWidth={0}>
            <Text color="$colorTertiary" fontSize="$xs" flexShrink={1} minWidth={0} numberOfLines={1}>
              {tx.account} ·{" "}
            </Text>
            {categoryPrefix}
            <Text color="$colorTertiary" fontSize="$xs" flexShrink={0} numberOfLines={1}>
              {tx.category}
            </Text>
            {aiApplied ? (
              <View flexDirection="row" alignItems="center" marginLeft="$1" gap={4} flexShrink={0}>
                <Sparkles size={11} color={theme.colorTertiary.val} />
                <Text color="$colorTertiary" fontSize="$xs">
                  IA
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Text color={amountColor} fontSize="$bodySm" fontWeight="500" flexShrink={0}>
          {sign}
          {eur0.format(tx.amountEur)}
        </Text>
      </View>
    );
  }
  ```

  Create `packages/ui/src/components/PekuloMilestoneRow/PekuloMilestoneRow.native.tsx`:

  ```tsx
  // packages/ui/src/components/PekuloMilestoneRow/PekuloMilestoneRow.native.tsx
  import { Trash2 } from "lucide-react-native";
  import { Text, View, styled, useTheme } from "tamagui";
  import type { MilestoneCardItem, MilestoneStatus } from "@pekulo/types";
  import { PekuloDonut } from "../PekuloDonut/PekuloDonut.native";

  export interface PekuloMilestoneRowProps {
    milestone: MilestoneCardItem;
    onDelete?: (id: string) => void;
    isDeleting?: boolean;
  }

  const eur0 = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  const STATUS_LABEL: Record<MilestoneStatus, string> = {
    ahead: "en avance",
    "on-track": "sur la trajectoire",
    behind: "en retard",
  };

  const DeletePill = styled(View, {
    name: "PekuloMilestoneDelete",
    role: "button",
    width: 32,
    height: 32,
    borderRadius: "$full",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    pressStyle: { backgroundColor: "$backgroundMuted" },
    variants: {
      disabled: {
        true: { opacity: 0.5 },
      },
    } as const,
  });

  export function PekuloMilestoneRow({ milestone, onDelete, isDeleting }: PekuloMilestoneRowProps) {
    const theme = useTheme();
    const { id, label, targetEur, targetYear, progressPct, deltaEur, status } = milestone;
    const tone =
      status === "ahead" ? "$success" : status === "behind" ? "$danger" : "$colorSecondary";
    const sign = deltaEur >= 0 ? "+" : "−";
    const canDelete = onDelete && id;

    return (
      <View flexDirection="row" alignItems="center" gap="$4" paddingVertical="$3">
        <PekuloDonut pct={progressPct} size={36} stroke={3} />
        <View flex={1}>
          <Text color="$color" fontSize="$bodySm" fontWeight="500">
            {label}
          </Text>
          <Text color="$colorTertiary" fontSize="$xs">
            {eur0.format(targetEur)} · {targetYear}
          </Text>
        </View>
        <View alignItems="flex-end">
          <Text color={tone as never} fontSize="$bodySm" fontWeight="500">
            {sign}
            {eur0.format(Math.abs(deltaEur))}
          </Text>
          <Text color="$colorTertiary" fontSize="$xs">
            {STATUS_LABEL[status]}
          </Text>
        </View>
        {canDelete && (
          <DeletePill
            disabled={isDeleting}
            aria-disabled={isDeleting}
            aria-label={`Supprimer le palier ${label}`}
            onPress={() => {
              if (!isDeleting) onDelete(id);
            }}
          >
            <Trash2 size={16} color={theme.colorSecondary.val} />
          </DeletePill>
        )}
      </View>
    );
  }
  ```

  Create `packages/ui/src/components/PekuloMonthlyRow/PekuloMonthlyRow.native.tsx`:

  ```tsx
  // packages/ui/src/components/PekuloMonthlyRow/PekuloMonthlyRow.native.tsx
  import { Check } from "lucide-react-native";
  import { Text, View, useTheme } from "tamagui";
  import type { MonthlyDisplayRow } from "@pekulo/types";

  const eur0 = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  export interface PekuloMonthlyRowProps {
    month: MonthlyDisplayRow;
  }

  export function PekuloMonthlyRow({ month }: PekuloMonthlyRowProps) {
    const theme = useTheme();
    const sign = month.netEur >= 0 ? "+" : "−";
    const tone = month.netEur >= 0 ? "$success" : "$danger";
    return (
      <View flexDirection="row" alignItems="center" gap="$3" paddingVertical="$3">
        <View flex={1}>
          <Text color="$color" fontSize="$bodySm" fontWeight="500" textTransform="capitalize">
            {month.monthLabel}
          </Text>
          <Text color="$colorTertiary" fontSize="$xs">
            +{eur0.format(month.incomeEur)} · −{eur0.format(month.spendingEur)}
          </Text>
        </View>
        <Text color={tone as never} fontSize="$bodySm" fontWeight="500">
          {sign}
          {eur0.format(Math.abs(month.netEur))}
        </Text>
        {month.closed && (
          <View
            flexDirection="row"
            alignItems="center"
            gap="$1"
            paddingHorizontal="$2"
            paddingVertical={3}
            borderRadius="$full"
            backgroundColor="$backgroundMuted"
          >
            <Check size={12} color={theme.colorSecondary.val} />
            <Text color="$colorSecondary" fontSize="$11">
              Clôturé
            </Text>
          </View>
        )}
      </View>
    );
  }
  ```

  Create `packages/ui/src/components/PekuloContextualAddButton/PekuloContextualAddButton.native.tsx`:

  ```tsx
  // packages/ui/src/components/PekuloContextualAddButton/PekuloContextualAddButton.native.tsx
  import { Plus } from "lucide-react-native";
  import { View, styled, useTheme } from "tamagui";

  const FAB = styled(View, {
    name: "PekuloContextualAddFab",
    role: "button",
    width: 44,
    height: 44,
    borderRadius: "$full",
    backgroundColor: "$color",
    alignItems: "center",
    justifyContent: "center",
    pressStyle: { scale: 0.95 },
  });

  export interface PekuloContextualAddButtonProps {
    label: string;
    onPress: () => void;
  }

  export function PekuloContextualAddButton({ label, onPress }: PekuloContextualAddButtonProps) {
    const theme = useTheme();
    return (
      <FAB onPress={onPress} aria-label={label}>
        <Plus size={22} color={theme.background.val} />
      </FAB>
    );
  }
  ```

  Create `packages/ui/src/components/PekuloEmptyState/PekuloEmptyState.native.tsx`:

  ```tsx
  // packages/ui/src/components/PekuloEmptyState/PekuloEmptyState.native.tsx
  import type { ComponentType } from "react";
  import { Text, View, styled, useTheme } from "tamagui";

  type IconComponent = ComponentType<{ size?: number; color?: string }>;

  export interface PekuloEmptyStateProps {
    icon: IconComponent;
    title: string;
    message: string;
    ctaLabel?: string;
    onCta?: () => void;
  }

  const CtaPill = styled(View, {
    name: "PekuloEmptyStateCta",
    role: "button",
    paddingHorizontal: "$4",
    paddingVertical: "$2",
    borderRadius: "$full",
    backgroundColor: "$color",
    pressStyle: { opacity: 0.9 },
  });

  export function PekuloEmptyState({
    icon: Icon,
    title,
    message,
    ctaLabel,
    onCta,
  }: PekuloEmptyStateProps) {
    const theme = useTheme();
    return (
      <View alignItems="center" gap="$3" paddingVertical="$8" paddingHorizontal="$6">
        <View
          width={56}
          height={56}
          borderRadius="$full"
          backgroundColor="$backgroundMuted"
          alignItems="center"
          justifyContent="center"
        >
          <Icon size={24} color={theme.colorSecondary.val} />
        </View>
        <Text color="$color" fontSize="$h3" fontWeight="600" textAlign="center">
          {title}
        </Text>
        <Text color="$colorSecondary" fontSize="$caption" textAlign="center">
          {message}
        </Text>
        {ctaLabel && onCta && (
          <CtaPill onPress={onCta} aria-label={ctaLabel}>
            <Text color="$colorOnAccent" fontSize="$caption" fontWeight="600">
              {ctaLabel}
            </Text>
          </CtaPill>
        )}
      </View>
    );
  }
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck && bun --filter='@pekulo/ui' run test:visual`
  Expected: `typecheck` exits 0; all existing web snapshots pass unchanged.
  Commit: `git add packages/ui/src/components/CategoryIcon/CategoryIcon.native.tsx packages/ui/src/components/TransactionLogo/TransactionLogo.native.tsx packages/ui/src/primitives/HeaderAction.native.tsx packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.native.tsx packages/ui/src/components/PekuloMilestoneRow/PekuloMilestoneRow.native.tsx packages/ui/src/components/PekuloMonthlyRow/PekuloMonthlyRow.native.tsx packages/ui/src/components/PekuloContextualAddButton/PekuloContextualAddButton.native.tsx packages/ui/src/components/PekuloEmptyState/PekuloEmptyState.native.tsx && git commit -m "feat(#154): port icon-bearing and logo domain components to React Native"`

- [x] **T5 — Port `PekuloSegmentedControl`, `PekuloPagination`, `PekuloSuggestionRow`, `PekuloMobileBottomNav`, and `PekuloNavRail` to native** [AC: AC-2, AC-3, AC-4]

  Create `packages/ui/src/components/PekuloSegmentedControl/PekuloSegmentedControl.native.tsx`:

  ```tsx
  // packages/ui/src/components/PekuloSegmentedControl/PekuloSegmentedControl.native.tsx
  import type { ComponentType } from "react";
  import { Text, View, styled, useTheme } from "tamagui";

  type IconComponent = ComponentType<{ size?: number; color?: string }>;

  export interface PekuloSegmentedOption<T extends string> {
    value: T;
    label: string;
    icon: IconComponent;
  }

  export interface PekuloSegmentedControlProps<T extends string> {
    value: T;
    onChange: (v: T) => void;
    options: PekuloSegmentedOption<T>[];
    ariaLabel: string;
  }

  const Segment = styled(View, {
    name: "PekuloSegmentedNative",
    role: "radio",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1,
    height: 36,
    borderRadius: "$md",
    variants: {
      active: {
        true: { backgroundColor: "$backgroundElevated" },
        false: { backgroundColor: "transparent" },
      },
    } as const,
  });

  export function PekuloSegmentedControl<T extends string>({
    value,
    onChange,
    options,
    ariaLabel,
  }: PekuloSegmentedControlProps<T>) {
    const theme = useTheme();
    return (
      <View
        role="radiogroup"
        aria-label={ariaLabel}
        flexDirection="row"
        padding={4}
        backgroundColor="$backgroundMuted"
        borderRadius="$lg"
      >
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = value === opt.value;
          return (
            <Segment
              key={opt.value}
              active={active}
              onPress={() => onChange(opt.value)}
              aria-checked={active}
            >
              <Icon size={14} color={active ? theme.color.val : theme.colorSecondary.val} />
              <Text
                color={(active ? "$color" : "$colorSecondary") as never}
                fontSize="$caption"
                fontWeight="500"
              >
                {opt.label}
              </Text>
            </Segment>
          );
        })}
      </View>
    );
  }
  ```

  Create `packages/ui/src/components/PekuloPagination/PekuloPagination.native.tsx`:

  ```tsx
  // packages/ui/src/components/PekuloPagination/PekuloPagination.native.tsx
  import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react-native";
  import { Text, View, styled, useTheme } from "tamagui";

  const PaginationLink = styled(View, {
    name: "PekuloPaginationLink",
    role: "button",
    minWidth: 32,
    height: 32,
    paddingHorizontal: "$2",
    borderRadius: "$md",
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "$1",
    pressStyle: { backgroundColor: "$backgroundMuted" },
    variants: {
      active: {
        true: { backgroundColor: "$color", pressStyle: { backgroundColor: "$color" } },
      },
      dimmed: {
        true: { opacity: 0.4, pressStyle: { backgroundColor: "transparent" } },
      },
    } as const,
  });

  export interface PekuloPaginationProps {
    page: number;
    pageCount: number;
    onPageChange: (page: number) => void;
    ariaLabel?: string;
    previousLabel?: string;
    nextLabel?: string;
  }

  type PageEntry = { kind: "page"; page: number } | { kind: "gap"; side: "start" | "end" };

  function pageWindow(page: number, pageCount: number): PageEntry[] {
    if (pageCount <= 7) {
      return Array.from({ length: pageCount }, (_, i) => ({ kind: "page", page: i + 1 }));
    }
    const out: PageEntry[] = [{ kind: "page", page: 1 }];
    const start = Math.max(2, page - 1);
    const end = Math.min(pageCount - 1, page + 1);
    if (start > 2) out.push({ kind: "gap", side: "start" });
    for (let p = start; p <= end; p++) out.push({ kind: "page", page: p });
    if (end < pageCount - 1) out.push({ kind: "gap", side: "end" });
    out.push({ kind: "page", page: pageCount });
    return out;
  }

  export function PekuloPagination({
    page,
    pageCount,
    onPageChange,
    ariaLabel = "Pagination",
    previousLabel = "Page précédente",
    nextLabel = "Page suivante",
  }: PekuloPaginationProps) {
    const theme = useTheme();
    if (pageCount <= 1) return null;
    const atStart = page <= 1;
    const atEnd = page >= pageCount;

    return (
      <View
        role="navigation"
        aria-label={ariaLabel}
        flexDirection="row"
        justifyContent="center"
        alignItems="center"
        gap="$1"
        marginTop="$3"
      >
        <PaginationLink
          dimmed={atStart}
          disabled={atStart}
          aria-disabled={atStart}
          aria-label={previousLabel}
          onPress={() => {
            if (!atStart) onPageChange(page - 1);
          }}
        >
          <ChevronLeft size={16} color={theme.colorSecondary.val} />
        </PaginationLink>

        {pageWindow(page, pageCount).map((entry) =>
          entry.kind === "gap" ? (
            <View
              key={`gap-${entry.side}`}
              accessibilityElementsHidden
              minWidth={32}
              height={32}
              alignItems="center"
              justifyContent="center"
            >
              <MoreHorizontal size={16} color={theme.colorSecondary.val} />
            </View>
          ) : (
            <PaginationLink
              key={entry.page}
              active={entry.page === page}
              aria-label={`Page ${entry.page}`}
              aria-selected={entry.page === page}
              onPress={() => onPageChange(entry.page)}
            >
              <Text
                color={entry.page === page ? "$colorOnAccent" : "$color"}
                fontSize="$xs"
                fontWeight={entry.page === page ? "600" : "400"}
              >
                {entry.page}
              </Text>
            </PaginationLink>
          ),
        )}

        <PaginationLink
          dimmed={atEnd}
          disabled={atEnd}
          aria-disabled={atEnd}
          aria-label={nextLabel}
          onPress={() => {
            if (!atEnd) onPageChange(page + 1);
          }}
        >
          <ChevronRight size={16} color={theme.colorSecondary.val} />
        </PaginationLink>
      </View>
    );
  }
  ```

  Create `packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.native.tsx`:

  ```tsx
  // packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.native.tsx
  import type { ReactNode } from "react";
  import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react-native";
  import { Text, View, styled, useTheme } from "tamagui";
  import type { LlmRouteBadge, Suggestion } from "@pekulo/types";

  const eur0 = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  const ROUTE_LABEL: Record<LlmRouteBadge, string> = {
    ios: "iOS",
    ollama: "Ollama",
    cloud: "Cloud",
  };

  const ConfirmPill = styled(View, {
    name: "PekuloSuggestionConfirm",
    role: "button",
    paddingHorizontal: "$3",
    paddingVertical: 6,
    borderRadius: "$full",
    backgroundColor: "$color",
    pressStyle: { opacity: 0.9 },
  });

  const EditPill = styled(View, {
    name: "PekuloSuggestionEdit",
    role: "button",
    paddingHorizontal: "$2",
    paddingVertical: 6,
    borderRadius: "$full",
    backgroundColor: "transparent",
    pressStyle: { backgroundColor: "$backgroundMuted" },
  });

  export interface PekuloSuggestionRowProps {
    tx: Suggestion;
    onConfirm?: () => void;
    onEdit?: () => void;
    disabled?: boolean;
    categoryIcon?: ReactNode;
    logo?: ReactNode;
  }

  export function PekuloSuggestionRow({
    tx,
    onConfirm,
    onEdit,
    disabled,
    categoryIcon,
    logo,
  }: PekuloSuggestionRowProps) {
    const theme = useTheme();
    const Arrow = tx.direction === "in" ? ArrowDownRight : ArrowUpRight;
    const sign = tx.direction === "in" ? "+" : "−";

    return (
      <View flexDirection="column" gap="$2" paddingVertical="$3">
        <View flexDirection="row" alignItems="center" gap="$3">
          {logo}
          <Arrow size={18} color={theme.colorSecondary.val} />
          <View flex={1} minWidth={0}>
            <Text color="$color" fontSize="$bodySm" fontWeight="500" numberOfLines={1}>
              {tx.label}
            </Text>
            <Text color="$colorTertiary" fontSize="$xs" numberOfLines={1}>
              {tx.account} · {tx.dateLabel}
            </Text>
          </View>
          <Text color="$color" fontSize="$bodySm" fontWeight="500" flexShrink={0}>
            {sign}
            {eur0.format(tx.amountEur)}
          </Text>
        </View>
        <View flexDirection="row" alignItems="center" gap="$2" flexWrap="wrap">
          <View
            flexDirection="row"
            alignItems="center"
            gap="$1"
            paddingHorizontal="$2"
            paddingVertical={3}
            borderRadius="$full"
            backgroundColor="$backgroundMuted"
          >
            <Sparkles size={12} color={theme.colorSecondary.val} />
            {categoryIcon}
            <Text color="$colorSecondary" fontSize="$xs">
              {tx.suggestedCategory}
            </Text>
          </View>
          <Text
            color={(tx.confidence < 0.75 ? "$warning" : "$colorTertiary") as never}
            fontSize="$xs"
          >
            {Math.round(tx.confidence * 100)}%
          </Text>
          <Text color="$colorTertiary" fontSize="$xs">
            · {ROUTE_LABEL[tx.route]}
          </Text>
          <View flex={1} />
          <ConfirmPill
            disabled={disabled}
            aria-disabled={disabled}
            aria-label="Confirmer la catégorie"
            opacity={disabled ? 0.5 : 1}
            onPress={() => {
              if (!disabled) onConfirm?.();
            }}
          >
            <Text color="$colorOnAccent" fontSize="$xs" fontWeight="600">
              ✓ Confirmer
            </Text>
          </ConfirmPill>
          <EditPill
            disabled={disabled}
            aria-disabled={disabled}
            aria-label="Modifier la catégorie"
            opacity={disabled ? 0.5 : 1}
            onPress={() => {
              if (!disabled) onEdit?.();
            }}
          >
            <Text color="$colorSecondary" fontSize="$xs">
              Modifier
            </Text>
          </EditPill>
        </View>
      </View>
    );
  }
  ```

  Create `packages/ui/src/components/PekuloNavRail/PekuloNavRail.native.tsx`:

  ```tsx
  // packages/ui/src/components/PekuloNavRail/PekuloNavRail.native.tsx
  import type { ComponentType } from "react";
  import { Building2, Compass, LineChart, Receipt, Settings, Wallet } from "lucide-react-native";
  import { View, styled, useTheme } from "tamagui";

  export type PekuloNavKey =
    | "cap"
    | "transactions"
    | "monthly"
    | "portfolio"
    | "realestate"
    | "settings";

  type IconComponent = ComponentType<{ size?: number; color?: string }>;

  interface NavItem {
    key: PekuloNavKey;
    label: string;
    icon: IconComponent;
  }

  const NAV_ITEMS: NavItem[] = [
    { key: "transactions", label: "Transactions", icon: Receipt },
    { key: "monthly", label: "Mensuel", icon: LineChart },
    { key: "portfolio", label: "Portefeuille", icon: Wallet },
    { key: "realestate", label: "Immobilier", icon: Building2 },
  ];

  const NavButton = styled(View, {
    name: "PekuloNavRailButton",
    role: "button",
    width: 40,
    height: 40,
    borderRadius: "$lg",
    alignItems: "center",
    justifyContent: "center",
    pressStyle: { backgroundColor: "$backgroundMuted" },
    variants: {
      active: {
        true: { backgroundColor: "$backgroundElevated" },
      },
    } as const,
  });

  export interface PekuloNavRailProps {
    activeKey: PekuloNavKey | null;
    onSelect: (key: PekuloNavKey) => void;
  }

  export function PekuloNavRail({ activeKey, onSelect }: PekuloNavRailProps) {
    const theme = useTheme();
    const iconColor = (active: boolean) => (active ? theme.color.val : theme.colorTertiary.val);

    return (
      <View
        aria-label="Navigation principale"
        width={64}
        backgroundColor="$backgroundCard"
        borderRadius="$xl"
        paddingVertical="$4"
        flexDirection="column"
        alignItems="center"
        gap="$1"
      >
        <NavButton
          active={activeKey === "cap"}
          onPress={() => onSelect("cap")}
          aria-label="Pekulo — accueil"
          aria-selected={activeKey === "cap"}
        >
          <Compass size={22} color={iconColor(activeKey === "cap")} />
        </NavButton>
        <View marginVertical="$2" height={1} width={32} backgroundColor="$borderDefault" />
        <View flexDirection="column" gap="$1" flex={1}>
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <NavButton
              key={key}
              active={activeKey === key}
              onPress={() => onSelect(key)}
              aria-label={label}
              aria-selected={activeKey === key}
            >
              <Icon size={18} color={iconColor(activeKey === key)} />
            </NavButton>
          ))}
        </View>
        <NavButton
          active={activeKey === "settings"}
          onPress={() => onSelect("settings")}
          aria-label="Paramètres"
          aria-selected={activeKey === "settings"}
        >
          <Settings size={18} color={iconColor(activeKey === "settings")} />
        </NavButton>
      </View>
    );
  }
  ```

  Create `packages/ui/src/components/PekuloMobileBottomNav/PekuloMobileBottomNav.native.tsx`:

  ```tsx
  // packages/ui/src/components/PekuloMobileBottomNav/PekuloMobileBottomNav.native.tsx
  import type { ComponentType } from "react";
  import { Building2, Compass, LineChart, Receipt, Wallet } from "lucide-react-native";
  import { Text, View, useTheme } from "tamagui";
  import type { PekuloNavKey } from "../PekuloNavRail/PekuloNavRail.native";
  import { pekuloSpacing } from "../../tokens";

  type IconComponent = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

  interface NavItem {
    key: PekuloNavKey;
    label: string;
    icon: IconComponent;
  }

  const NAV_ITEMS: NavItem[] = [
    { key: "cap", label: "Cap", icon: Compass },
    { key: "transactions", label: "Transactions", icon: Receipt },
    { key: "monthly", label: "Mensuel", icon: LineChart },
    { key: "portfolio", label: "Portefeuille", icon: Wallet },
    { key: "realestate", label: "Immobilier", icon: Building2 },
  ];

  export interface PekuloMobileBottomNavProps {
    activeKey: PekuloNavKey | null;
    onSelect: (key: PekuloNavKey) => void;
  }

  export function PekuloMobileBottomNav({ activeKey, onSelect }: PekuloMobileBottomNavProps) {
    const theme = useTheme();
    return (
      <View
        aria-label="Navigation rapide"
        backgroundColor="$background"
        flexDirection="row"
        paddingTop={pekuloSpacing[2]}
        paddingBottom={pekuloSpacing[5]}
        paddingHorizontal={pekuloSpacing[2]}
      >
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const active = activeKey === key;
          return (
            <View
              key={key}
              role="button"
              onPress={() => onSelect(key)}
              aria-label={label}
              aria-selected={active}
              flex={1}
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              gap={4}
              paddingVertical="$2"
              borderRadius="$md"
              backgroundColor="transparent"
            >
              <Icon
                size={20}
                strokeWidth={1.75}
                color={active ? theme.color.val : theme.colorTertiary.val}
              />
              <Text
                fontSize={10}
                lineHeight={12}
                letterSpacing={-0.1}
                color={active ? "$color" : "$colorTertiary"}
                fontWeight="500"
                numberOfLines={1}
                textAlign="center"
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck && bun --filter='@pekulo/ui' run test:visual`
  Expected: `typecheck` exits 0; all existing web snapshots pass unchanged.
  Commit: `git add packages/ui/src/components/PekuloSegmentedControl/PekuloSegmentedControl.native.tsx packages/ui/src/components/PekuloPagination/PekuloPagination.native.tsx packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.native.tsx packages/ui/src/components/PekuloNavRail/PekuloNavRail.native.tsx packages/ui/src/components/PekuloMobileBottomNav/PekuloMobileBottomNav.native.tsx && git commit -m "feat(#154): port segmented control, pagination, suggestion row, and nav components to native"`

- [x] **T6 — Port structural & button primitives (`PekuloButton`, `PekuloButtonGroup`, `PekuloSubmitButton`, `PekuloCard`, `PekuloEmpty`, `PekuloLabel`, `PekuloProgress`)** [AC: AC-2, AC-4]

  Create `packages/ui/src/primitives/PekuloButton.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloButton.native.tsx
  import type { ReactNode } from "react";
  import type { GestureResponderEvent, ViewStyle } from "react-native";
  import { Text, View, useTheme } from "tamagui";
  import { pekuloFontSizes, pekuloFontWeights, pekuloRadius, pekuloSpacing } from "../tokens";
  import { PekuloSpinner } from "./PekuloSpinner.native";

  export type PekuloButtonVariant =
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "destructive"
    | "link";

  export type PekuloButtonSize =
    | "default"
    | "xs"
    | "sm"
    | "lg"
    | "icon"
    | "icon-xs"
    | "icon-sm"
    | "icon-lg";

  export interface PekuloButtonProps {
    variant?: PekuloButtonVariant;
    size?: PekuloButtonSize;
    loading?: boolean;
    loadingLabel?: ReactNode;
    disabled?: boolean;
    children?: ReactNode;
    onPress?: (event: GestureResponderEvent) => void;
    onClick?: (event: GestureResponderEvent) => void;
    accessibilityLabel?: string;
    "aria-label"?: string;
    testID?: string;
    style?: ViewStyle;
    type?: "button" | "submit" | "reset";
  }

  const SIZE_DIMS: Record<
    PekuloButtonSize,
    { height: number; paddingX?: number; iconOnly?: boolean; fontSize: number; gap: number }
  > = {
    default: {
      height: pekuloSpacing[8],
      paddingX: pekuloSpacing[3],
      fontSize: pekuloFontSizes.bodySm,
      gap: 6,
    },
    xs: {
      height: pekuloSpacing[6],
      paddingX: pekuloSpacing[2],
      fontSize: pekuloFontSizes.xs,
      gap: 4,
    },
    sm: { height: 28, paddingX: pekuloSpacing[3], fontSize: pekuloFontSizes.caption, gap: 4 },
    lg: { height: 36, paddingX: pekuloSpacing[3], fontSize: pekuloFontSizes.bodySm, gap: 6 },
    icon: { height: pekuloSpacing[8], iconOnly: true, fontSize: pekuloFontSizes.bodySm, gap: 0 },
    "icon-xs": { height: pekuloSpacing[6], iconOnly: true, fontSize: pekuloFontSizes.xs, gap: 0 },
    "icon-sm": { height: 28, iconOnly: true, fontSize: pekuloFontSizes.caption, gap: 0 },
    "icon-lg": { height: 36, iconOnly: true, fontSize: pekuloFontSizes.bodySm, gap: 0 },
  };

  export function PekuloButton({
    variant = "default",
    size = "default",
    loading = false,
    loadingLabel,
    disabled,
    children,
    onPress,
    onClick,
    accessibilityLabel,
    "aria-label": ariaLabel,
    testID,
    style,
  }: PekuloButtonProps) {
    const theme = useTheme();
    const isDisabled = Boolean(disabled || loading);
    const dims = SIZE_DIMS[size];
    const mergedPress = onPress ?? onClick;

    const bgToken =
      variant === "default"
        ? "$color"
        : variant === "secondary"
          ? "$backgroundMuted"
          : variant === "destructive"
            ? "$danger"
            : "transparent";

    const fgColor =
      variant === "default" || variant === "destructive" ? theme.colorOnAccent.val : theme.color.val;

    const labelNode = loading && loadingLabel !== undefined ? loadingLabel : children;

    return (
      <View
        role="button"
        testID={testID}
        aria-label={accessibilityLabel ?? ariaLabel}
        aria-busy={loading}
        aria-disabled={isDisabled}
        disabled={isDisabled}
        onPress={isDisabled ? undefined : mergedPress}
        flexDirection="row"
        alignItems="center"
        justifyContent="center"
        gap={dims.gap}
        height={dims.height}
        width={dims.iconOnly ? dims.height : undefined}
        paddingHorizontal={dims.iconOnly ? 0 : dims.paddingX}
        borderRadius={size === "xs" || size === "icon-xs" ? pekuloRadius.md : pekuloRadius.lg}
        backgroundColor={bgToken}
        borderWidth={variant === "outline" ? 1 : 0}
        borderColor={variant === "outline" ? "$borderDefault" : "transparent"}
        opacity={isDisabled ? 0.5 : 1}
        pressStyle={isDisabled ? undefined : { opacity: 0.9 }}
        style={style}
      >
        {loading && <PekuloSpinner size={dims.fontSize - 2} color={fgColor} ariaLabel="" />}
        {typeof labelNode === "string" || typeof labelNode === "number" ? (
          <Text
            color={fgColor}
            fontSize={dims.fontSize}
            fontWeight={pekuloFontWeights.medium}
            textDecorationLine={variant === "link" ? "underline" : "none"}
          >
            {labelNode}
          </Text>
        ) : (
          labelNode
        )}
      </View>
    );
  }
  ```

  Create `packages/ui/src/primitives/PekuloButtonGroup.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloButtonGroup.native.tsx
  import type { ReactNode } from "react";
  import { Text, View, type ViewProps } from "tamagui";
  import { pekuloFontSizes, pekuloRadius, pekuloSpacing } from "../tokens";

  export interface PekuloButtonGroupProps extends Omit<ViewProps, "children"> {
    orientation?: "horizontal" | "vertical";
    children?: ReactNode;
  }

  export function PekuloButtonGroup({
    orientation = "horizontal",
    children,
    ...props
  }: PekuloButtonGroupProps) {
    return (
      <View
        role="group"
        flexDirection={orientation === "horizontal" ? "row" : "column"}
        alignItems="stretch"
        alignSelf="flex-start"
        gap="$1"
        {...props}
      >
        {children}
      </View>
    );
  }

  export interface PekuloButtonGroupTextProps extends Omit<ViewProps, "children"> {
    children?: ReactNode;
  }

  export function PekuloButtonGroupText({ children, ...props }: PekuloButtonGroupTextProps) {
    return (
      <View
        flexDirection="row"
        alignItems="center"
        gap="$2"
        paddingHorizontal="$3"
        backgroundColor="$backgroundMuted"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$borderDefault"
        {...props}
      >
        <Text color="$color" fontSize={pekuloFontSizes.bodySm} fontWeight="500">
          {children}
        </Text>
      </View>
    );
  }

  export interface PekuloButtonGroupSeparatorProps extends Omit<ViewProps, "children"> {
    orientation?: "horizontal" | "vertical";
  }

  export function PekuloButtonGroupSeparator({
    orientation = "vertical",
    ...props
  }: PekuloButtonGroupSeparatorProps) {
    return (
      <View
        alignSelf="stretch"
        backgroundColor="$borderDefault"
        width={orientation === "vertical" ? 1 : undefined}
        height={orientation === "horizontal" ? 1 : undefined}
        marginHorizontal={orientation === "vertical" ? pekuloSpacing[1] / 4 : 0}
        marginVertical={orientation === "horizontal" ? pekuloSpacing[1] / 4 : 0}
        borderRadius={pekuloRadius.none}
        {...props}
      />
    );
  }
  ```

  Create `packages/ui/src/primitives/PekuloSubmitButton.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloSubmitButton.native.tsx
  import type { ReactNode } from "react";
  import { pekuloRadius } from "../tokens";
  import {
    PekuloButton,
    type PekuloButtonProps,
    type PekuloButtonVariant,
  } from "./PekuloButton.native";

  export interface PekuloSubmitButtonProps extends Omit<PekuloButtonProps, "variant" | "size"> {
    children: ReactNode;
    loading?: boolean;
    loadingLabel?: ReactNode;
    variant?: "primary" | "danger";
    fullWidth?: boolean;
    type?: "submit" | "button" | "reset";
  }

  const VARIANT_MAP: Record<NonNullable<PekuloSubmitButtonProps["variant"]>, PekuloButtonVariant> = {
    primary: "default",
    danger: "destructive",
  };

  export function PekuloSubmitButton({
    children,
    loading = false,
    loadingLabel,
    variant = "primary",
    fullWidth = true,
    type = "submit",
    style,
    ...props
  }: PekuloSubmitButtonProps) {
    return (
      <PekuloButton
        variant={VARIANT_MAP[variant]}
        size="lg"
        type={type}
        loading={loading}
        loadingLabel={loadingLabel}
        style={{
          height: 44,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          width: fullWidth ? "100%" : undefined,
          borderRadius: pekuloRadius.full,
          ...style,
        }}
        {...props}
      >
        {children}
      </PekuloButton>
    );
  }
  ```

  Create `packages/ui/src/primitives/PekuloCard.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloCard.native.tsx
  // Native PekuloCard replacing CSS Grid in CardHeader / CardAction with RN flexbox.

  import { Children, createContext, isValidElement, useContext, type ReactNode } from "react";
  import { Text, View, type TextProps, type ViewProps } from "tamagui";

  export type PekuloCardSize = "default" | "sm";

  const PekuloCardSizeContext = createContext<PekuloCardSize>("default");

  const PAD: Record<PekuloCardSize, "$3" | "$4"> = {
    default: "$4",
    sm: "$3",
  };

  const GAP: Record<PekuloCardSize, "$3" | "$4"> = {
    default: "$4",
    sm: "$3",
  };

  const TITLE_FONT_SIZE: Record<PekuloCardSize, "$bodySm" | "$body"> = {
    default: "$body",
    sm: "$bodySm",
  };

  export interface PekuloCardProps extends Omit<ViewProps, "children"> {
    size?: PekuloCardSize;
    children?: ReactNode;
  }

  export function PekuloCard({ size = "default", children, ...props }: PekuloCardProps) {
    const hasFooter = Children.toArray(children).some(
      (c) => isValidElement(c) && c.type === PekuloCardFooter,
    );

    return (
      <PekuloCardSizeContext.Provider value={size}>
        <View
          flexDirection="column"
          gap={GAP[size]}
          paddingTop={PAD[size]}
          paddingBottom={hasFooter ? 0 : PAD[size]}
          backgroundColor="$backgroundCard"
          borderRadius="$xl"
          overflow="hidden"
          {...props}
        >
          {children}
        </View>
      </PekuloCardSizeContext.Provider>
    );
  }

  export interface PekuloCardHeaderProps extends Omit<ViewProps, "children"> {
    children?: ReactNode;
  }

  export function PekuloCardHeader({ children, ...props }: PekuloCardHeaderProps) {
    const size = useContext(PekuloCardSizeContext);
    const items = Children.toArray(children);
    const actionChild = items.find((c) => isValidElement(c) && c.type === PekuloCardAction);
    const bodyChildren = items.filter((c) => !(isValidElement(c) && c.type === PekuloCardAction));

    return (
      <View
        flexDirection="row"
        alignItems="flex-start"
        justifyContent="space-between"
        gap="$3"
        paddingHorizontal={PAD[size]}
        {...props}
      >
        <View flex={1} flexDirection="column" gap="$1">
          {bodyChildren}
        </View>
        {actionChild}
      </View>
    );
  }

  export function PekuloCardTitle(props: TextProps) {
    const size = useContext(PekuloCardSizeContext);
    return (
      <Text
        color="$color"
        fontSize={TITLE_FONT_SIZE[size]}
        fontWeight="500"
        lineHeight="$2"
        {...props}
      />
    );
  }

  export function PekuloCardDescription(props: TextProps) {
    return <Text color="$colorTertiary" fontSize="$caption" {...props} />;
  }

  export interface PekuloCardActionProps extends Omit<ViewProps, "children"> {
    children?: ReactNode;
  }

  export function PekuloCardAction({ children, ...props }: PekuloCardActionProps) {
    return (
      <View alignSelf="flex-start" flexShrink={0} {...props}>
        {children}
      </View>
    );
  }

  export interface PekuloCardContentProps extends Omit<ViewProps, "children"> {
    children?: ReactNode;
  }

  export function PekuloCardContent({ children, ...props }: PekuloCardContentProps) {
    const size = useContext(PekuloCardSizeContext);
    return (
      <View paddingHorizontal={PAD[size]} {...props}>
        {children}
      </View>
    );
  }

  export interface PekuloCardFooterProps extends Omit<ViewProps, "children"> {
    children?: ReactNode;
  }

  export function PekuloCardFooter({ children, ...props }: PekuloCardFooterProps) {
    const size = useContext(PekuloCardSizeContext);
    return (
      <View
        flexDirection="row"
        alignItems="center"
        gap="$3"
        padding={PAD[size]}
        borderTopWidth={1}
        borderTopColor="$borderDefault"
        backgroundColor="$backgroundMuted"
        {...props}
      >
        {children}
      </View>
    );
  }
  ```

  Create `packages/ui/src/primitives/PekuloEmpty.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloEmpty.native.tsx
  import type { ReactNode } from "react";
  import { Text, View, type TextProps, type ViewProps } from "tamagui";
  import { pekuloFontSizes, pekuloFontWeights, pekuloSpacing } from "../tokens";

  export interface PekuloEmptyProps extends Omit<ViewProps, "children"> {
    children?: ReactNode;
  }

  export function PekuloEmpty({ children, ...props }: PekuloEmptyProps) {
    return (
      <View
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        gap="$4"
        padding="$6"
        borderRadius="$xl"
        width="100%"
        {...props}
      >
        {children}
      </View>
    );
  }

  export interface PekuloEmptyHeaderProps extends Omit<ViewProps, "children"> {
    children?: ReactNode;
  }

  export function PekuloEmptyHeader({ children, ...props }: PekuloEmptyHeaderProps) {
    return (
      <View flexDirection="column" alignItems="center" gap="$2" maxWidth={400} {...props}>
        {children}
      </View>
    );
  }

  export type PekuloEmptyMediaVariant = "default" | "icon";

  export interface PekuloEmptyMediaProps extends Omit<ViewProps, "children"> {
    variant?: PekuloEmptyMediaVariant;
    children?: ReactNode;
  }

  export function PekuloEmptyMedia({
    variant = "default",
    children,
    ...props
  }: PekuloEmptyMediaProps) {
    if (variant === "icon") {
      return (
        <View
          width={pekuloSpacing[12]}
          height={pekuloSpacing[12]}
          alignItems="center"
          justifyContent="center"
          backgroundColor="$backgroundMuted"
          borderRadius="$full"
          marginBottom="$4"
          {...props}
        >
          {children}
        </View>
      );
    }
    return (
      <View alignItems="center" justifyContent="center" marginBottom="$2" {...props}>
        {children}
      </View>
    );
  }

  export function PekuloEmptyTitle({ children, ...props }: TextProps) {
    return (
      <Text
        color="$color"
        fontSize={pekuloFontSizes.bodySm}
        fontWeight={pekuloFontWeights.medium}
        letterSpacing={-0.1}
        textAlign="center"
        {...props}
      >
        {children}
      </Text>
    );
  }

  export function PekuloEmptyDescription({ children, ...props }: TextProps) {
    return (
      <Text
        color="$colorTertiary"
        fontSize={pekuloFontSizes.bodySm}
        textAlign="center"
        width="100%"
        {...props}
      >
        {children}
      </Text>
    );
  }

  export interface PekuloEmptyContentProps extends Omit<ViewProps, "children"> {
    children?: ReactNode;
  }

  export function PekuloEmptyContent({ children, ...props }: PekuloEmptyContentProps) {
    return (
      <View
        flexDirection="column"
        alignItems="center"
        gap="$3"
        maxWidth={400}
        width="100%"
        {...props}
      >
        {children}
      </View>
    );
  }
  ```

  Create `packages/ui/src/primitives/PekuloLabel.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloLabel.native.tsx
  import { Text, type TextProps } from "tamagui";
  import { pekuloFontSizes, pekuloFontWeights } from "../tokens";

  export interface PekuloLabelProps extends TextProps {
    htmlFor?: string;
  }

  export function PekuloLabel({ children, htmlFor: _htmlFor, ...props }: PekuloLabelProps) {
    return (
      <Text
        fontSize={pekuloFontSizes.bodySm}
        fontWeight={pekuloFontWeights.medium}
        color="$color"
        {...props}
      >
        {children}
      </Text>
    );
  }
  ```

  Create `packages/ui/src/primitives/PekuloProgress.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloProgress.native.tsx
  import type { ReactNode } from "react";
  import type { ViewStyle } from "react-native";
  import { View } from "tamagui";
  import { pekuloRadius } from "../tokens";

  export interface PekuloProgressProps {
    value?: number;
    max?: number;
    height?: number;
    ariaLabel?: string;
    children?: ReactNode;
    style?: ViewStyle;
  }

  function Root({
    value = 0,
    max = 100,
    height = 6,
    ariaLabel = "Progression",
    style,
  }: PekuloProgressProps) {
    const clamped = Math.max(0, Math.min(max, value));
    const pct = max === 0 ? 0 : (clamped / max) * 100;

    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={ariaLabel}
        accessibilityValue={{ min: 0, max, now: Math.round(clamped) }}
        width="100%"
        height={height}
        backgroundColor="$backgroundMuted"
        borderRadius={pekuloRadius.full}
        overflow="hidden"
        style={style}
      >
        <View
          width={`${pct}%`}
          height="100%"
          backgroundColor="$color"
          borderRadius={pekuloRadius.full}
        />
      </View>
    );
  }

  function Indicator() {
    return null;
  }

  export const PekuloProgress = Object.assign(Root, { Indicator });
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck && bun --filter='@pekulo/ui' run test:visual`
  Expected: `typecheck` exits 0; all existing web snapshots pass unchanged.
  Commit: `git add packages/ui/src/primitives/PekuloButton.native.tsx packages/ui/src/primitives/PekuloButtonGroup.native.tsx packages/ui/src/primitives/PekuloSubmitButton.native.tsx packages/ui/src/primitives/PekuloCard.native.tsx packages/ui/src/primitives/PekuloEmpty.native.tsx packages/ui/src/primitives/PekuloLabel.native.tsx packages/ui/src/primitives/PekuloProgress.native.tsx && git commit -m "feat(#154): port button, card, empty, label, and progress primitives to React Native"`

- [x] **T7 — Port form-control primitives (`PekuloInput`, `PekuloTextarea`, `PekuloSwitch`, `PekuloCheckbox`, `PekuloNativeCheckbox`, `PekuloSelect`, `PekuloNativeSelect` via `@react-native-picker/picker`)** [AC: AC-2, AC-3, AC-4]

  Create `packages/ui/src/primitives/PekuloInput.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloInput.native.tsx
  import { Eye, EyeOff } from "lucide-react-native";
  import { forwardRef, useState } from "react";
  import { Pressable, TextInput, type TextInputProps } from "react-native";
  import { View, useTheme } from "tamagui";
  import { pekuloFontSizes, pekuloRadius, pekuloSpacing } from "../tokens";

  type AllowedInputType =
    | "text"
    | "number"
    | "email"
    | "password"
    | "tel"
    | "url"
    | "search"
    | "time"
    | "month"
    | "week"
    | "color"
    | "hidden";

  export interface PekuloInputProps extends Omit<TextInputProps, "editable"> {
    controlSize?: "sm" | "md";
    invalid?: boolean;
    type?: AllowedInputType;
    revealable?: boolean;
    disabled?: boolean;
    "aria-label"?: string;
    onChange?: (event: { target: { value: string } }) => void;
  }

  const SIZE_HEIGHT: Record<NonNullable<PekuloInputProps["controlSize"]>, number> = {
    sm: pekuloSpacing[8],
    md: pekuloSpacing[10],
  };

  const SIZE_PADDING_X: Record<NonNullable<PekuloInputProps["controlSize"]>, number> = {
    sm: pekuloSpacing[2],
    md: pekuloSpacing[3],
  };

  const REVEAL_BTN_WIDTH = 36;

  export const PekuloInput = forwardRef<TextInput, PekuloInputProps>(function PekuloInput(
    {
      controlSize = "md",
      invalid = false,
      type = "text",
      revealable,
      disabled,
      style,
      accessibilityLabel,
      "aria-label": ariaLabel,
      onChangeText,
      onChange,
      ...props
    },
    ref,
  ) {
    const theme = useTheme();
    const [revealed, setRevealed] = useState(false);

    if (type === "hidden") return null;

    const isPassword = type === "password";
    const showRevealToggle = isPassword && (revealable ?? true);
    const paddingRight = showRevealToggle ? REVEAL_BTN_WIDTH : SIZE_PADDING_X[controlSize];

    const keyboardType =
      type === "email"
        ? "email-address"
        : type === "number"
          ? "numeric"
          : type === "tel"
            ? "phone-pad"
            : type === "url"
              ? "url"
              : "default";

    const autoCapitalize =
      type === "email" || type === "password" || type === "url" ? "none" : props.autoCapitalize;

    return (
      <View position="relative" width="100%">
        <TextInput
          ref={ref}
          editable={!disabled}
          secureTextEntry={isPassword && (!showRevealToggle || !revealed)}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          accessibilityLabel={accessibilityLabel ?? ariaLabel}
          placeholderTextColor={theme.colorTertiary.val}
          onChangeText={(text) => {
            onChangeText?.(text);
            onChange?.({ target: { value: text } });
          }}
          style={[
            {
              width: "100%",
              height: SIZE_HEIGHT[controlSize],
              backgroundColor: theme.backgroundMuted.val,
              color: theme.color.val,
              borderRadius: pekuloRadius.lg,
              paddingLeft: SIZE_PADDING_X[controlSize],
              paddingRight,
              fontSize: pekuloFontSizes.bodySm,
              borderWidth: invalid ? 1 : 0,
              borderColor: invalid ? theme.danger.val : "transparent",
              opacity: disabled ? 0.5 : 1,
            },
            style,
          ]}
          {...props}
        />
        {showRevealToggle && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            accessibilityState={{ selected: revealed }}
            onPress={() => setRevealed((v) => !v)}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              height: SIZE_HEIGHT[controlSize],
              width: REVEAL_BTN_WIDTH,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {revealed ? (
              <EyeOff size={16} color={theme.colorTertiary.val} />
            ) : (
              <Eye size={16} color={theme.colorTertiary.val} />
            )}
          </Pressable>
        )}
      </View>
    );
  });
  ```

  Create `packages/ui/src/primitives/PekuloTextarea.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloTextarea.native.tsx
  import { forwardRef } from "react";
  import { TextInput, type TextInputProps } from "react-native";
  import { useTheme } from "tamagui";
  import { pekuloFontSizes, pekuloRadius, pekuloSpacing } from "../tokens";

  export interface PekuloTextareaProps extends Omit<TextInputProps, "editable"> {
    invalid?: boolean;
    disabled?: boolean;
    rows?: number;
    "aria-label"?: string;
    onChange?: (event: { target: { value: string } }) => void;
  }

  export const PekuloTextarea = forwardRef<TextInput, PekuloTextareaProps>(function PekuloTextarea(
    {
      invalid = false,
      disabled,
      rows,
      style,
      accessibilityLabel,
      "aria-label": ariaLabel,
      onChangeText,
      onChange,
      ...props
    },
    ref,
  ) {
    const theme = useTheme();
    const minHeight = rows ? Math.max(pekuloSpacing[20], rows * 22) : pekuloSpacing[20];

    return (
      <TextInput
        ref={ref}
        multiline
        textAlignVertical="top"
        editable={!disabled}
        accessibilityLabel={accessibilityLabel ?? ariaLabel}
        placeholderTextColor={theme.colorTertiary.val}
        onChangeText={(text) => {
          onChangeText?.(text);
          onChange?.({ target: { value: text } });
        }}
        style={[
          {
            width: "100%",
            minHeight,
            backgroundColor: theme.backgroundMuted.val,
            color: theme.color.val,
            borderRadius: pekuloRadius.lg,
            paddingVertical: pekuloSpacing[2],
            paddingHorizontal: pekuloSpacing[3],
            fontSize: pekuloFontSizes.bodySm,
            borderWidth: invalid ? 1 : 0,
            borderColor: invalid ? theme.danger.val : "transparent",
            opacity: disabled ? 0.5 : 1,
          },
          style,
        ]}
        {...props}
      />
    );
  });
  ```

  Create `packages/ui/src/primitives/PekuloSwitch.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloSwitch.native.tsx
  // Native switch wrapping @tamagui/switch without web CSS transition properties.

  import { Switch as TamaSwitch, type SwitchProps } from "@tamagui/switch";

  export function PekuloSwitch({ checked, ...props }: SwitchProps) {
    return (
      <TamaSwitch
        checked={checked}
        width={52}
        height={30}
        padding={3}
        borderWidth={0}
        borderRadius={1000}
        backgroundColor="$backgroundMuted"
        activeStyle={{ backgroundColor: "$color" }}
        {...props}
      >
        <TamaSwitch.Thumb
          width={24}
          height={24}
          borderRadius={1000}
          backgroundColor="$color"
          activeStyle={{ backgroundColor: "$background" }}
        />
      </TamaSwitch>
    );
  }
  ```

  Create `packages/ui/src/primitives/PekuloCheckbox.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloCheckbox.native.tsx
  import { Checkbox as TamaCheckbox, type CheckboxProps } from "@tamagui/checkbox";
  import { Check } from "lucide-react-native";
  import type { ComponentProps } from "react";
  import { useTheme } from "tamagui";

  function Root(props: CheckboxProps) {
    return (
      <TamaCheckbox
        size="$3"
        backgroundColor="$backgroundMuted"
        borderWidth={0}
        {...props}
      />
    );
  }

  function Indicator(props: ComponentProps<typeof TamaCheckbox.Indicator>) {
    const theme = useTheme();
    return (
      <TamaCheckbox.Indicator {...props}>
        <Check size={14} color={theme.colorOnAccent.val} />
      </TamaCheckbox.Indicator>
    );
  }

  export const PekuloCheckbox = Object.assign(Root, { Indicator });
  ```

  Create `packages/ui/src/primitives/PekuloNativeCheckbox.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloNativeCheckbox.native.tsx
  import { Check } from "lucide-react-native";
  import { useState } from "react";
  import { View, useTheme } from "tamagui";

  export interface PekuloNativeCheckboxProps {
    size?: number;
    checked?: boolean;
    defaultChecked?: boolean;
    disabled?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    onChange?: (event: { target: { checked: boolean } }) => void;
    accessibilityLabel?: string;
    "aria-label"?: string;
    testID?: string;
  }

  export function PekuloNativeCheckbox({
    size = 20,
    checked: controlledChecked,
    defaultChecked = false,
    disabled = false,
    onCheckedChange,
    onChange,
    accessibilityLabel,
    "aria-label": ariaLabel,
    testID,
  }: PekuloNativeCheckboxProps) {
    const theme = useTheme();
    const [uncontrolled, setUncontrolled] = useState(defaultChecked);
    const isChecked = controlledChecked ?? uncontrolled;

    const toggle = () => {
      if (disabled) return;
      const next = !isChecked;
      if (controlledChecked === undefined) {
        setUncontrolled(next);
      }
      onCheckedChange?.(next);
      onChange?.({ target: { checked: next } });
    };

    return (
      <View
        role="checkbox"
        testID={testID}
        aria-label={accessibilityLabel ?? ariaLabel}
        aria-checked={isChecked}
        aria-disabled={disabled}
        onPress={toggle}
        width={size}
        height={size}
        borderRadius="$sm"
        alignItems="center"
        justifyContent="center"
        backgroundColor={isChecked ? "$color" : "$backgroundMuted"}
        opacity={disabled ? 0.5 : 1}
      >
        {isChecked && <Check size={Math.round(size * 0.7)} color={theme.colorOnAccent.val} />}
      </View>
    );
  }
  ```

  Create `packages/ui/src/primitives/PekuloSelect.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloSelect.native.tsx
  import {
    Select as TamaSelect,
    SelectSeparator as TamaSelectSeparator,
    type SelectProps,
  } from "@tamagui/select";
  import { Sheet as TamaSheet } from "@tamagui/sheet";
  import { Check, ChevronDown, ChevronUp } from "lucide-react-native";
  import type { ComponentProps, ReactNode } from "react";
  import { useTheme } from "tamagui";

  function Root<Value extends string = string>(props: SelectProps<Value>) {
    return (
      <TamaSelect {...props}>
        {props.children}
        <TamaSelect.Adapt when="maxMd" platform="touch">
          <TamaSheet modal dismissOnSnapToBottom snapPointsMode="fit">
            <TamaSheet.Frame backgroundColor="$backgroundElevated" padding="$3">
              <TamaSheet.ScrollView>
                <TamaSelect.Adapt.Contents />
              </TamaSheet.ScrollView>
            </TamaSheet.Frame>
            <TamaSheet.Overlay backgroundColor="$backgroundOverlay" />
          </TamaSheet>
        </TamaSelect.Adapt>
      </TamaSelect>
    );
  }

  function Group({
    children,
    ...props
  }: ComponentProps<typeof TamaSelect.Group> & { children: ReactNode }) {
    return (
      <TamaSelect.Group padding="$1" {...props}>
        {children}
      </TamaSelect.Group>
    );
  }

  const Value = TamaSelect.Value;

  function Trigger({
    children,
    controlSize = "md",
    ...props
  }: ComponentProps<typeof TamaSelect.Trigger> & {
    children: ReactNode;
    controlSize?: "sm" | "md";
  }) {
    const theme = useTheme();
    return (
      <TamaSelect.Trigger
        backgroundColor="$backgroundMuted"
        borderRadius="$lg"
        borderWidth={0}
        paddingHorizontal="$3"
        height={controlSize === "sm" ? 32 : 40}
        gap="$2"
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        width="100%"
        {...props}
      >
        {children}
        <TamaSelect.Icon>
          <ChevronDown size={16} color={theme.colorTertiary.val} />
        </TamaSelect.Icon>
      </TamaSelect.Trigger>
    );
  }

  function Content({
    children,
    ...props
  }: ComponentProps<typeof TamaSelect.Content> & { children: ReactNode }) {
    const theme = useTheme();
    return (
      <TamaSelect.Content {...props}>
        <TamaSelect.ScrollUpButton
          alignItems="center"
          justifyContent="center"
          width="100%"
          height="$3"
          backgroundColor="$backgroundElevated"
        >
          <ChevronUp size={14} color={theme.colorTertiary.val} />
        </TamaSelect.ScrollUpButton>
        <TamaSelect.Viewport
          backgroundColor="$backgroundElevated"
          borderRadius="$lg"
          padding="$1"
          minWidth={200}
        >
          {children}
        </TamaSelect.Viewport>
        <TamaSelect.ScrollDownButton
          alignItems="center"
          justifyContent="center"
          width="100%"
          height="$3"
          backgroundColor="$backgroundElevated"
        >
          <ChevronDown size={14} color={theme.colorTertiary.val} />
        </TamaSelect.ScrollDownButton>
      </TamaSelect.Content>
    );
  }

  function Label(props: ComponentProps<typeof TamaSelect.Label>) {
    return (
      <TamaSelect.Label
        color="$colorTertiary"
        fontSize="$xs"
        fontWeight="500"
        letterSpacing={0.4}
        textTransform="uppercase"
        paddingHorizontal="$2"
        paddingVertical="$1"
        {...props}
      />
    );
  }

  function Item({
    children,
    icon,
    ...props
  }: ComponentProps<typeof TamaSelect.Item> & { children: ReactNode; icon?: ReactNode }) {
    const theme = useTheme();
    return (
      <TamaSelect.Item
        paddingHorizontal="$2"
        paddingVertical="$2"
        paddingRight={28}
        borderRadius="$md"
        flexDirection="row"
        alignItems="center"
        gap="$2"
        {...props}
      >
        {icon}
        <TamaSelect.ItemText color="$color" fontSize="$bodySm">
          {children}
        </TamaSelect.ItemText>
        <TamaSelect.ItemIndicator marginLeft="auto">
          <Check size={14} color={theme.color.val} />
        </TamaSelect.ItemIndicator>
      </TamaSelect.Item>
    );
  }

  function Separator(props: ComponentProps<typeof TamaSelectSeparator>) {
    return (
      <TamaSelectSeparator
        height={1}
        backgroundColor="$borderDefault"
        marginVertical="$1"
        marginHorizontal={-4}
        {...props}
      />
    );
  }

  export const PekuloSelect = Object.assign(Root, {
    Group,
    Value,
    Trigger,
    Content,
    Label,
    Item,
    Separator,
  });
  ```

  Create `packages/ui/src/primitives/PekuloNativeSelect.native.tsx` (using `@react-native-picker/picker` and supporting both `options` and `<option>` children):

  ```tsx
  // packages/ui/src/primitives/PekuloNativeSelect.native.tsx
  import { Picker } from "@react-native-picker/picker";
  import { Children, isValidElement, useMemo, useState, type ReactNode } from "react";
  import { View, useTheme } from "tamagui";
  import { pekuloRadius, pekuloSpacing } from "../tokens";

  export interface PekuloNativeSelectOption {
    value: string;
    label: string;
  }

  export interface PekuloNativeSelectProps {
    controlSize?: "sm" | "md";
    invalid?: boolean;
    disabled?: boolean;
    value?: string;
    defaultValue?: string;
    options?: ReadonlyArray<PekuloNativeSelectOption>;
    children?: ReactNode;
    onValueChange?: (value: string) => void;
    onChange?: (event: { target: { value: string } }) => void;
    accessibilityLabel?: string;
    "aria-label"?: string;
    testID?: string;
  }

  const SIZE_HEIGHT: Record<NonNullable<PekuloNativeSelectProps["controlSize"]>, number> = {
    sm: pekuloSpacing[8],
    md: pekuloSpacing[10],
  };

  function extractOptions(
    options: ReadonlyArray<PekuloNativeSelectOption> | undefined,
    children: ReactNode,
  ): PekuloNativeSelectOption[] {
    if (options) return [...options];
    const resolved: PekuloNativeSelectOption[] = [];
    Children.forEach(children, (child) => {
      if (!isValidElement(child)) return;
      const props = child.props as { value?: string; label?: string; children?: ReactNode };
      if (props.value !== undefined) {
        const label =
          props.label ??
          (typeof props.children === "string" || typeof props.children === "number"
            ? String(props.children)
            : props.value);
        resolved.push({ value: String(props.value), label });
      }
    });
    return resolved;
  }

  export function PekuloNativeSelect({
    controlSize = "md",
    invalid = false,
    disabled = false,
    value: controlledValue,
    defaultValue,
    options,
    children,
    onValueChange,
    onChange,
    accessibilityLabel,
    "aria-label": ariaLabel,
    testID,
  }: PekuloNativeSelectProps) {
    const theme = useTheme();
    const items = useMemo(() => extractOptions(options, children), [options, children]);
    const [uncontrolled, setUncontrolled] = useState(
      defaultValue ?? items[0]?.value ?? "",
    );
    const selectedValue = controlledValue ?? uncontrolled;

    return (
      <View
        width="100%"
        minHeight={SIZE_HEIGHT[controlSize]}
        backgroundColor="$backgroundMuted"
        borderRadius={pekuloRadius.lg}
        borderWidth={invalid ? 1 : 0}
        borderColor={invalid ? "$danger" : "transparent"}
        opacity={disabled ? 0.5 : 1}
        justifyContent="center"
        overflow="hidden"
      >
        <Picker
          testID={testID}
          enabled={!disabled}
          selectedValue={selectedValue}
          accessibilityLabel={accessibilityLabel ?? ariaLabel}
          dropdownIconColor={theme.colorTertiary.val}
          style={{ color: theme.color.val, width: "100%" }}
          onValueChange={(nextValue) => {
            const str = String(nextValue);
            if (controlledValue === undefined) {
              setUncontrolled(str);
            }
            onValueChange?.(str);
            onChange?.({ target: { value: str } });
          }}
        >
          {items.map((opt) => (
            <Picker.Item
              key={opt.value}
              label={opt.label}
              value={opt.value}
              color={theme.color.val}
            />
          ))}
        </Picker>
      </View>
    );
  }
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck && bun --filter='@pekulo/ui' run test:visual`
  Expected: `typecheck` exits 0; all existing web snapshots pass unchanged.
  Commit: `git add packages/ui/src/primitives/PekuloInput.native.tsx packages/ui/src/primitives/PekuloTextarea.native.tsx packages/ui/src/primitives/PekuloSwitch.native.tsx packages/ui/src/primitives/PekuloCheckbox.native.tsx packages/ui/src/primitives/PekuloNativeCheckbox.native.tsx packages/ui/src/primitives/PekuloSelect.native.tsx packages/ui/src/primitives/PekuloNativeSelect.native.tsx && git commit -m "feat(#154): port input, textarea, switch, checkbox, and select primitives to native"`

- [x] **T8 — Port overlays, breadcrumb, resizable, and native date primitives (`PekuloPopover`, `PekuloDialogCloseX`, `PekuloDrawer`, `PekuloBreadcrumb`, `PekuloResizable`, `PekuloCalendar`, `PekuloDatePicker`)** [AC: AC-2, AC-3, AC-4]

  Create `packages/ui/src/primitives/PekuloPopover.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloPopover.native.tsx
  import { Popover as TamaPopover, type PopoverProps } from "@tamagui/popover";
  import type { ComponentProps, ReactNode } from "react";
  import { View, type ViewProps } from "tamagui";

  function Root({
    placement = "bottom",
    allowFlip = true,
    stayInFrame = true,
    offset = 6,
    ...props
  }: PopoverProps & { children: ReactNode }) {
    return (
      <TamaPopover
        placement={placement}
        allowFlip={allowFlip}
        stayInFrame={stayInFrame}
        offset={offset}
        {...props}
      />
    );
  }

  function Trigger({ children, ...props }: Omit<ViewProps, "children"> & { children: ReactNode }) {
    return (
      <TamaPopover.Trigger asChild>
        <View role="button" flexDirection="row" alignItems="center" {...props}>
          {children}
        </View>
      </TamaPopover.Trigger>
    );
  }

  function Content({
    children,
    ...props
  }: ComponentProps<typeof TamaPopover.Content> & { children: ReactNode }) {
    return (
      <TamaPopover.Content
        backgroundColor="$backgroundElevated"
        borderRadius="$lg"
        padding="$3"
        gap="$2"
        borderWidth={1}
        borderColor="$borderStrong"
        transition="quick"
        enterStyle={{ opacity: 0, y: -4 }}
        exitStyle={{ opacity: 0, y: -4 }}
        {...props}
      >
        {children}
      </TamaPopover.Content>
    );
  }

  function Arrow(props: ComponentProps<typeof TamaPopover.Arrow>) {
    return <TamaPopover.Arrow backgroundColor="$backgroundElevated" {...props} />;
  }

  const Close = TamaPopover.Close;

  export const PekuloPopover = Object.assign(Root, { Trigger, Content, Arrow, Close });
  ```

  Create `packages/ui/src/primitives/PekuloDialogCloseX.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloDialogCloseX.native.tsx
  import { X } from "lucide-react-native";
  import { View, useTheme } from "tamagui";
  import { PekuloDialog } from "./PekuloDialog";

  export function PekuloDialogCloseX() {
    const theme = useTheme();
    return (
      <View position="absolute" top="$3" right="$3" zIndex={1}>
        <PekuloDialog.Close asChild>
          <View
            role="button"
            aria-label="Fermer"
            width={32}
            height={32}
            alignItems="center"
            justifyContent="center"
            borderRadius="$full"
            backgroundColor="transparent"
            pressStyle={{ backgroundColor: "$backgroundMuted" }}
          >
            <X size={18} color={theme.colorTertiary.val} />
          </View>
        </PekuloDialog.Close>
      </View>
    );
  }
  ```

  Create `packages/ui/src/primitives/PekuloDrawer.native.tsx` (compound API parity with web `PekuloDrawer`, backed by `@tamagui/sheet` without `vaul`):

  ```tsx
  // packages/ui/src/primitives/PekuloDrawer.native.tsx
  import { Sheet as TamaSheet } from "@tamagui/sheet";
  import { createContext, useContext, useState, type ReactNode } from "react";
  import { Text, View, type TextProps, type ViewProps } from "tamagui";

  interface DrawerContextValue {
    open: boolean;
    setOpen: (next: boolean) => void;
  }

  const DrawerContext = createContext<DrawerContextValue | null>(null);

  export interface PekuloDrawerProps {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: ReactNode;
  }

  function Root({
    open: controlledOpen,
    defaultOpen = false,
    onOpenChange,
    children,
  }: PekuloDrawerProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const open = controlledOpen ?? uncontrolledOpen;
    const setOpen = (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    };

    return (
      <DrawerContext.Provider value={{ open, setOpen }}>
        {children}
      </DrawerContext.Provider>
    );
  }

  function Trigger({ children, ...props }: Omit<ViewProps, "children"> & { children: ReactNode }) {
    const ctx = useContext(DrawerContext);
    return (
      <View role="button" onPress={() => ctx?.setOpen(true)} {...props}>
        {children}
      </View>
    );
  }

  function Portal({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  }

  function Close({ children, ...props }: Omit<ViewProps, "children"> & { children?: ReactNode }) {
    const ctx = useContext(DrawerContext);
    return (
      <View role="button" onPress={() => ctx?.setOpen(false)} {...props}>
        {children}
      </View>
    );
  }

  function Overlay(props: ViewProps) {
    return <TamaSheet.Overlay backgroundColor="$backgroundOverlay" {...props} />;
  }

  function Content({ children, ...props }: Omit<ViewProps, "children"> & { children?: ReactNode }) {
    const ctx = useContext(DrawerContext);
    const open = ctx?.open ?? false;

    return (
      <TamaSheet
        modal
        open={open}
        onOpenChange={(next: boolean) => ctx?.setOpen(next)}
        snapPoints={[80, 45]}
        dismissOnSnapToBottom
      >
        <Overlay />
        <TamaSheet.Frame
          backgroundColor="$backgroundElevated"
          borderTopLeftRadius={16}
          borderTopRightRadius={16}
          padding="$4"
          gap="$3"
          {...props}
        >
          <TamaSheet.Handle
            backgroundColor="$backgroundMuted"
            height={4}
            width={64}
            borderRadius="$full"
            alignSelf="center"
            marginBottom="$2"
          />
          {children}
        </TamaSheet.Frame>
      </TamaSheet>
    );
  }

  function Header({ children, ...props }: Omit<ViewProps, "children"> & { children?: ReactNode }) {
    return (
      <View flexDirection="column" gap="$1" padding="$2" {...props}>
        {children}
      </View>
    );
  }

  function Footer({ children, ...props }: Omit<ViewProps, "children"> & { children?: ReactNode }) {
    return (
      <View flexDirection="column" gap="$2" padding="$2" marginTop="auto" {...props}>
        {children}
      </View>
    );
  }

  function Title(props: TextProps) {
    return <Text fontSize="$body" fontWeight="500" color="$color" {...props} />;
  }

  function Description(props: TextProps) {
    return <Text fontSize="$bodySm" color="$colorTertiary" {...props} />;
  }

  export const PekuloDrawer = Object.assign(Root, {
    Trigger,
    Portal,
    Close,
    Overlay,
    Content,
    Header,
    Footer,
    Title,
    Description,
  });
  ```

  Create `packages/ui/src/primitives/PekuloBreadcrumb.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloBreadcrumb.native.tsx
  import { ChevronRight, MoreHorizontal } from "lucide-react-native";
  import type { ReactNode } from "react";
  import { Text, View, useTheme, type TextProps, type ViewProps } from "tamagui";
  import { pekuloFontSizes } from "../tokens";

  export interface PekuloBreadcrumbProps extends Omit<ViewProps, "children"> {
    children?: ReactNode;
  }

  export function PekuloBreadcrumb({ children, ...props }: PekuloBreadcrumbProps) {
    return (
      <View role="navigation" aria-label="breadcrumb" {...props}>
        {children}
      </View>
    );
  }

  export interface PekuloBreadcrumbListProps extends Omit<ViewProps, "children"> {
    children?: ReactNode;
  }

  export function PekuloBreadcrumbList({ children, ...props }: PekuloBreadcrumbListProps) {
    return (
      <View flexDirection="row" flexWrap="wrap" alignItems="center" gap="$2" {...props}>
        {children}
      </View>
    );
  }

  export interface PekuloBreadcrumbItemProps extends Omit<ViewProps, "children"> {
    children?: ReactNode;
  }

  export function PekuloBreadcrumbItem({ children, ...props }: PekuloBreadcrumbItemProps) {
    return (
      <View flexDirection="row" alignItems="center" gap="$2" {...props}>
        {children}
      </View>
    );
  }

  export interface PekuloBreadcrumbLinkProps extends TextProps {
    href?: string;
    children?: ReactNode;
  }

  export function PekuloBreadcrumbLink({
    children,
    href: _href,
    ...props
  }: PekuloBreadcrumbLinkProps) {
    return (
      <Text role="link" color="$colorTertiary" fontSize={pekuloFontSizes.bodySm} {...props}>
        {children}
      </Text>
    );
  }

  export function PekuloBreadcrumbPage(props: TextProps) {
    return <Text color="$color" fontSize="$bodySm" fontWeight="400" {...props} />;
  }

  export interface PekuloBreadcrumbSeparatorProps extends Omit<ViewProps, "children"> {
    children?: ReactNode;
  }

  export function PekuloBreadcrumbSeparator({ children, ...props }: PekuloBreadcrumbSeparatorProps) {
    const theme = useTheme();
    return (
      <View
        accessibilityElementsHidden
        flexDirection="row"
        alignItems="center"
        {...props}
      >
        {children ?? <ChevronRight size={14} color={theme.colorTertiary.val} />}
      </View>
    );
  }

  export function PekuloBreadcrumbEllipsis(props: Omit<ViewProps, "children">) {
    const theme = useTheme();
    return (
      <View
        accessibilityElementsHidden
        flexDirection="row"
        alignItems="center"
        justifyContent="center"
        width={36}
        height={36}
        {...props}
      >
        <MoreHorizontal size={16} color={theme.colorTertiary.val} />
      </View>
    );
  }
  ```

  Create `packages/ui/src/primitives/PekuloResizable.native.tsx`:

  ```tsx
  // packages/ui/src/primitives/PekuloResizable.native.tsx
  import type { ReactNode } from "react";
  import { View, type ViewProps } from "tamagui";

  export interface PekuloResizablePanelGroupProps extends Omit<ViewProps, "children"> {
    orientation?: "horizontal" | "vertical";
    children?: ReactNode;
  }

  export function PekuloResizablePanelGroup({
    orientation = "horizontal",
    children,
    ...props
  }: PekuloResizablePanelGroupProps) {
    return (
      <View
        width="100%"
        height="100%"
        flexDirection={orientation === "vertical" ? "column" : "row"}
        {...props}
      >
        {children}
      </View>
    );
  }

  export interface PekuloResizablePanelProps extends Omit<ViewProps, "children"> {
    defaultSize?: number;
    children?: ReactNode;
  }

  export function PekuloResizablePanel({
    defaultSize,
    children,
    ...props
  }: PekuloResizablePanelProps) {
    return (
      <View flex={defaultSize ?? 1} minWidth={0} minHeight={0} {...props}>
        {children}
      </View>
    );
  }

  export interface PekuloResizableHandleProps extends Omit<ViewProps, "children"> {
    withHandle?: boolean;
    orientation?: "horizontal" | "vertical";
  }

  export function PekuloResizableHandle({
    withHandle = false,
    orientation = "horizontal",
    ...props
  }: PekuloResizableHandleProps) {
    const isVertical = orientation === "vertical";
    return (
      <View
        alignItems="center"
        justifyContent="center"
        backgroundColor="$borderDefault"
        width={isVertical ? "100%" : 1}
        height={isVertical ? 1 : "100%"}
        {...props}
      >
        {withHandle && (
          <View
            width={isVertical ? 24 : 4}
            height={isVertical ? 4 : 24}
            borderRadius="$md"
            backgroundColor="$borderDefault"
          />
        )}
      </View>
    );
  }
  ```

  Create `packages/ui/src/primitives/PekuloCalendar.native.tsx` (backed by `@react-native-community/datetimepicker`):

  ```tsx
  // packages/ui/src/primitives/PekuloCalendar.native.tsx
  import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
  import { useState } from "react";
  import { Platform } from "react-native";
  import { Text, View } from "tamagui";
  import { useThemeSetting } from "../provider/index.native";
  import { pekuloRadius, pekuloSpacing } from "../tokens";

  export interface NativeDateRange {
    from: Date | undefined;
    to?: Date | undefined;
  }

  export interface PekuloCalendarSingleProps {
    mode?: "single";
    selected?: Date;
    onSelect?: (d: Date | undefined) => void;
    month?: Date;
    disabled?: boolean;
  }

  export interface PekuloCalendarRangeProps {
    mode: "range";
    selected?: NativeDateRange;
    onSelect?: (r: NativeDateRange | undefined) => void;
    month?: Date;
    disabled?: boolean;
    min?: number;
    resetOnSelect?: boolean;
    numberOfMonths?: number;
  }

  export type PekuloCalendarProps = PekuloCalendarSingleProps | PekuloCalendarRangeProps;

  export function PekuloCalendar(props: PekuloCalendarProps) {
    const { resolvedTheme } = useThemeSetting();
    const themeVariant = resolvedTheme === "pekulo-light" ? "light" : "dark";
    const [activeEdge, setActiveEdge] = useState<"from" | "to">("from");

    if (props.mode === "range") {
      const fromDate = props.selected?.from ?? props.month ?? new Date();
      const toDate = props.selected?.to ?? fromDate;
      const activeValue = activeEdge === "from" ? fromDate : toDate;

      const handleRangeChange = (_event: DateTimePickerEvent, date?: Date) => {
        if (!date) return;
        if (activeEdge === "from") {
          const currentTo = props.selected?.to;
          const nextRange: NativeDateRange =
            currentTo && date > currentTo ? { from: date, to: undefined } : { from: date, to: currentTo };
          props.onSelect?.(nextRange);
          setActiveEdge("to");
        } else {
          const currentFrom = props.selected?.from ?? date;
          const nextRange: NativeDateRange =
            date < currentFrom ? { from: date, to: currentFrom } : { from: currentFrom, to: date };
          props.onSelect?.(nextRange);
        }
      };

      return (
        <View
          backgroundColor="$backgroundCard"
          borderRadius={pekuloRadius.lg}
          padding={pekuloSpacing[3]}
          gap="$3"
        >
          <View flexDirection="row" gap="$2">
            <View
              role="button"
              flex={1}
              paddingVertical="$2"
              borderRadius="$md"
              alignItems="center"
              backgroundColor={activeEdge === "from" ? "$color" : "$backgroundMuted"}
              onPress={() => setActiveEdge("from")}
            >
              <Text
                fontSize="$caption"
                fontWeight="500"
                color={activeEdge === "from" ? "$colorOnAccent" : "$color"}
              >
                Début
              </Text>
            </View>
            <View
              role="button"
              flex={1}
              paddingVertical="$2"
              borderRadius="$md"
              alignItems="center"
              backgroundColor={activeEdge === "to" ? "$color" : "$backgroundMuted"}
              onPress={() => setActiveEdge("to")}
            >
              <Text
                fontSize="$caption"
                fontWeight="500"
                color={activeEdge === "to" ? "$colorOnAccent" : "$color"}
              >
                Fin
              </Text>
            </View>
          </View>
          <View
            pointerEvents={props.disabled ? "none" : "auto"}
            opacity={props.disabled ? 0.5 : 1}
          >
            <DateTimePicker
              value={activeValue}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              locale="fr-FR"
              themeVariant={themeVariant}
              onChange={handleRangeChange}
            />
          </View>
        </View>
      );
    }

    const singleValue = props.selected ?? props.month ?? new Date();

    return (
      <View
        backgroundColor="$backgroundCard"
        borderRadius={pekuloRadius.lg}
        padding={pekuloSpacing[3]}
        pointerEvents={props.disabled ? "none" : "auto"}
        opacity={props.disabled ? 0.5 : 1}
      >
        <DateTimePicker
          value={singleValue}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          locale="fr-FR"
          themeVariant={themeVariant}
          onChange={(_event: DateTimePickerEvent, date?: Date) => {
            if (date) props.onSelect?.(date);
          }}
        />
      </View>
    );
  }
  ```

  Create `packages/ui/src/primitives/PekuloDatePicker.native.tsx` (composing `PekuloDialog` + `PekuloCalendar` + `Calendar` from `lucide-react-native`):

  ```tsx
  // packages/ui/src/primitives/PekuloDatePicker.native.tsx
  import { Calendar as CalendarIcon } from "lucide-react-native";
  import { useState } from "react";
  import { Text, View, useTheme } from "tamagui";
  import { pekuloFontSizes, pekuloRadius } from "../tokens";
  import { PekuloCalendar, type NativeDateRange } from "./PekuloCalendar.native";
  import { PekuloDialog } from "./PekuloDialog";
  import { PekuloDialogCloseX } from "./PekuloDialogCloseX.native";

  export type DateRange = NativeDateRange;

  const dateFmtFR = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function defaultFormatSingle(d?: Date): string {
    if (!d) return "Choisir une date";
    return dateFmtFR.format(d);
  }

  function defaultFormatRange(r?: DateRange): string {
    if (!r?.from) return "Choisir une plage";
    if (!r.to) return dateFmtFR.format(r.from);
    return `${dateFmtFR.format(r.from)} → ${dateFmtFR.format(r.to)}`;
  }

  export interface PekuloDatePickerSingleProps {
    mode?: "single";
    value: Date | undefined;
    onChange: (d: Date | undefined) => void;
    placeholder?: string;
    formatLabel?: (d?: Date) => string;
    width?: number | `${number}%`;
    disabled?: boolean;
    id?: string;
  }

  export interface PekuloDatePickerRangeProps {
    mode: "range";
    value: DateRange | undefined;
    onChange: (r: DateRange | undefined) => void;
    placeholder?: string;
    formatLabel?: (r?: DateRange) => string;
    width?: number | `${number}%`;
    disabled?: boolean;
    numberOfMonths?: number;
    id?: string;
  }

  export type PekuloDatePickerProps = PekuloDatePickerSingleProps | PekuloDatePickerRangeProps;

  export function PekuloDatePicker(props: PekuloDatePickerProps) {
    const theme = useTheme();
    const [open, setOpen] = useState(false);
    const width = props.width ?? 280;

    const label =
      props.mode === "range"
        ? (props.formatLabel ?? defaultFormatRange)(props.value)
        : (props.formatLabel ?? defaultFormatSingle)(props.value);

    return (
      <PekuloDialog open={open} onOpenChange={setOpen}>
        <PekuloDialog.Trigger asChild>
          <View
            role="button"
            aria-label="Sélectionner une date"
            aria-disabled={props.disabled}
            onPress={() => {
              if (!props.disabled) setOpen(true);
            }}
            flexDirection="row"
            alignItems="center"
            gap={8}
            width={width}
            paddingHorizontal={12}
            height={32}
            backgroundColor="$backgroundMuted"
            borderRadius={pekuloRadius.lg}
            opacity={props.disabled ? 0.5 : 1}
          >
            <CalendarIcon size={14} color={theme.color.val} />
            <Text flex={1} color="$color" fontSize={pekuloFontSizes.bodySm} fontWeight="500">
              {label}
            </Text>
          </View>
        </PekuloDialog.Trigger>
        <PekuloDialog.Portal>
          <PekuloDialog.Overlay />
          <PekuloDialog.Content padding="$4">
            <PekuloDialogCloseX />
            <PekuloDialog.Title>Sélectionner une date</PekuloDialog.Title>
            {props.mode === "range" ? (
              <PekuloCalendar
                mode="range"
                selected={props.value}
                onSelect={(r) => {
                  props.onChange(r);
                  if (r?.from && r?.to) {
                    setOpen(false);
                  }
                }}
              />
            ) : (
              <PekuloCalendar
                mode="single"
                selected={props.value}
                onSelect={(d) => {
                  props.onChange(d);
                  setOpen(false);
                }}
              />
            )}
          </PekuloDialog.Content>
        </PekuloDialog.Portal>
      </PekuloDialog>
    );
  }
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck && bun --filter='@pekulo/ui' run test:visual`
  Expected: `typecheck` exits 0; all existing web snapshots pass unchanged.
  Commit: `git add packages/ui/src/primitives/PekuloPopover.native.tsx packages/ui/src/primitives/PekuloDialogCloseX.native.tsx packages/ui/src/primitives/PekuloDrawer.native.tsx packages/ui/src/primitives/PekuloBreadcrumb.native.tsx packages/ui/src/primitives/PekuloResizable.native.tsx packages/ui/src/primitives/PekuloCalendar.native.tsx packages/ui/src/primitives/PekuloDatePicker.native.tsx && git commit -m "feat(#154): port overlay, breadcrumb, resizable, and native date primitives"`

- [x] **T9 — Export full `@pekulo/ui` surface from `index.native.ts` and enforce 100% parity in `ds-coverage.meta.test.ts`** [AC: AC-1, AC-2]

  Replace `packages/ui/src/index.native.ts` with the complete native barrel mirroring `packages/ui/src/index.ts` (note: `@pekulo/ui` exports only `.native`-safe modules here; `./client` remains identical):

  ```ts
  // packages/ui/src/index.native.ts
  // React Native public barrel for @pekulo/ui (resolved via package.json
  // "react-native" export condition by Metro, Jest, and apps/mobile tsconfig).
  // Mirrors 100% of packages/ui/src/index.ts.

  // Provider (native TamaguiProvider + Theme + ToastProvider + useThemeSetting)
  export * from "./provider/index.native";

  // Toast (hook + native absolute-positioned viewport)
  export * from "./toast/index.native";

  // Pure design tokens and theme maps
  export * from "./tokens";
  export * from "./themes";

  // Animation hooks (window.matchMedia guarded)
  export * from "./animations";

  // Primitives (Metro / TS moduleSuffixes resolve *.native.tsx automatically)
  export * from "./primitives";

  // Domain components (Metro / TS moduleSuffixes resolve *.native.tsx automatically)
  export * from "./components";
  ```

  Update `packages/ui/src/ds-coverage.meta.test.ts`:
  1. Exclude `*.native.tsx` / `*.native.ts` from `primitiveEntries()` and `moduleComponents()` so `.native` platform files are not flagged as separate uncovered web primitives.
  2. Add a meta-test assertion verifying that every module re-exported by `index.ts` (`provider`, `toast`, `tokens`, `themes`, `animations`, `primitives`, `components`) is also re-exported by `index.native.ts`.

  In `packages/ui/src/ds-coverage.meta.test.ts`:

  ```ts
  // Add near line 23:
  const NATIVE_BARREL = join(SRC, "index.native.ts");
  ```

  Update `primitiveEntries()` (lines 70-76):

  ```ts
  function primitiveEntries(): Array<{ name: string; dir: string }> {
    return readdirSync(PRIMITIVES_DIR)
      .filter(
        (entry) =>
          entry.endsWith(".tsx") && !entry.includes(".test.") && !entry.endsWith(".native.tsx"),
      )
      .map((entry) => entry.replace(/\.tsx$/, ""))
      .sort()
      .map((name) => ({ name, dir: PRIMITIVES_DIR }));
  }
  ```

  Update `moduleComponents()` (lines 103-118):

  ```ts
  function moduleComponents(module: string): string[] {
    const dir = join(SRC, module);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => /\.tsx?$/.test(f) && !f.includes(".test.") && !/\.native\.tsx?$/.test(f))
      .flatMap((f) => [
        ...readFileSync(join(dir, f), "utf8").matchAll(
          /export\s+(?:function|const)\s+([A-Z]\w*)/g,
        ),
      ])
      .map((m) => m[1])
      .sort();
  }
  ```

  Add inside `describe("design-system test coverage (architecture.md:631)", ...)` after line 289:

  ```ts
    it("exports the complete public barrel surface on React Native (index.native.ts)", () => {
      const nativeMatches = readFileSync(NATIVE_BARREL, "utf8").matchAll(
        /export\s+(?:\*|\{[^}]*\})\s+from\s+"\.\/([\w./-]+)"/g,
      );
      const nativeModules = [
        ...new Set([...nativeMatches].map((m) => m[1].split("/")[0])),
      ].sort();
      expect(nativeModules).toEqual(barrelModules());
    });
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck && bun --filter='@pekulo/ui' run test && bun --filter='@pekulo/mobile' run typecheck`
  Expected: `@pekulo/ui` `typecheck` and all Vitest suites (`159 passed`) exit 0; `@pekulo/mobile` `typecheck` exits 0 (confirming every shared and `.native.tsx` module resolves cleanly under React Native TypeScript types!).
  Commit: `git add packages/ui/src/index.native.ts packages/ui/src/ds-coverage.meta.test.ts && git commit -m "feat(#154): expose complete @pekulo/ui surface in index.native.ts and enforce barrel parity"`

- [x] **T10 — Add comprehensive Jest / RNTL native parity tests in `apps/mobile/__tests__/` covering all primitives, charts, icons, and domain components** [AC: AC-1, AC-3, AC-4]

  Create `apps/mobile/__tests__/ui-native-parity.test.tsx`:

  ```tsx
  import * as PekuloUI from "@pekulo/ui";
  import {
    CategoryIcon,
    CategoryPicker,
    HeaderAction,
    PekuloAccountRow,
    PekuloAccountsSection,
    PekuloActivityRow,
    PekuloAvatar,
    PekuloBreadcrumb,
    PekuloBreadcrumbItem,
    PekuloBreadcrumbLink,
    PekuloBreadcrumbList,
    PekuloBreadcrumbPage,
    PekuloBreadcrumbSeparator,
    PekuloButton,
    PekuloButtonGroup,
    PekuloButtonGroupText,
    PekuloCalendar,
    PekuloCard,
    PekuloCardContent,
    PekuloCardDescription,
    PekuloCardFooter,
    PekuloCardHeader,
    PekuloCardTitle,
    PekuloCheckbox,
    PekuloClassRow,
    PekuloCompositionCard,
    PekuloCompositionRow,
    PekuloContextualAddButton,
    PekuloCountUpEUR,
    PekuloCountUpPct,
    PekuloDatePicker,
    PekuloDialog,
    PekuloDialogCloseX,
    PekuloDonut,
    PekuloDonutCard,
    PekuloDrawer,
    PekuloEmpty,
    PekuloEmptyDescription,
    PekuloEmptyHeader,
    PekuloEmptyMedia,
    PekuloEmptyState,
    PekuloEmptyTitle,
    PekuloErrorBoundary,
    PekuloField,
    PekuloFieldContent,
    PekuloFieldDescription,
    PekuloFieldError,
    PekuloFieldGroup,
    PekuloFieldLabel,
    PekuloHero,
    PekuloHeroCard,
    PekuloHoldingRow,
    PekuloHypothesisCard,
    PekuloHypothesisVerdict,
    PekuloInput,
    PekuloKpiTile,
    PekuloLabel,
    PekuloLoadingItem,
    PekuloMilestoneRow,
    PekuloMilestonesCard,
    PekuloMobileBottomNav,
    PekuloMonthlyRow,
    PekuloNativeCheckbox,
    PekuloNativeSelect,
    PekuloNavRail,
    PekuloPagination,
    PekuloPopover,
    PekuloProgress,
    PekuloProjectionChart,
    PekuloPropertyCard,
    PekuloRadioGroup,
    PekuloRecentActivityCard,
    PekuloResizableHandle,
    PekuloResizablePanel,
    PekuloResizablePanelGroup,
    PekuloRootProvider,
    PekuloSegmentedControl,
    PekuloSelect,
    PekuloSeparator,
    PekuloSettingRow,
    PekuloSheet,
    PekuloSkeleton,
    PekuloSlider,
    PekuloSpinner,
    PekuloStaggerList,
    PekuloStat,
    PekuloSubmitButton,
    PekuloSuggestionRow,
    PekuloSwitch,
    PekuloTextarea,
    PekuloToggleRow,
    PekuloTooltip,
    PekuloTopTabToggle,
    PekuloTrajectoryCard,
    PekuloTrajectoryChart,
    PekuloUserDot,
    Section,
    TransactionLogo,
    useThemeSetting,
    useToast,
  } from "@pekulo/ui";
  import { fireEvent, render, screen } from "@testing-library/react-native";
  import { Compass, Moon, Sun } from "lucide-react-native";
  import { Text, View } from "react-native";

  function ToastProbe() {
    const toast = useToast();
    return (
      <PekuloButton onPress={() => toast.success("Enregistré", "Opération terminée")}>
        Notifier
      </PekuloButton>
    );
  }

  function ThemeToggleProbe() {
    const { resolvedTheme, set } = useThemeSetting();
    return (
      <PekuloButton onPress={() => set("pekulo-light")}>
        {`Theme: ${resolvedTheme}`}
      </PekuloButton>
    );
  }

  describe("@pekulo/ui native parity", () => {
    it("exports every public component and primitive from index.native.ts", () => {
      const expected = [
        "PekuloRootProvider",
        "useThemeSetting",
        "ToastProvider",
        "useToast",
        "PekuloToast",
        "PekuloToastViewport",
        "useCountUp",
        "useStagger",
        "Section",
        "HeaderAction",
        "PekuloAvatar",
        "PekuloBreadcrumb",
        "PekuloButton",
        "PekuloButtonGroup",
        "PekuloCalendar",
        "PekuloCard",
        "PekuloCheckbox",
        "PekuloDatePicker",
        "PekuloDialog",
        "PekuloDialogCloseX",
        "PekuloDrawer",
        "PekuloEmpty",
        "PekuloField",
        "PekuloInput",
        "PekuloLabel",
        "PekuloLoadingItem",
        "PekuloNativeCheckbox",
        "PekuloNativeSelect",
        "PekuloPopover",
        "PekuloProgress",
        "PekuloRadioGroup",
        "PekuloResizablePanelGroup",
        "PekuloSelect",
        "PekuloSeparator",
        "PekuloSheet",
        "PekuloSlider",
        "PekuloSpinner",
        "PekuloSubmitButton",
        "PekuloSwitch",
        "PekuloTextarea",
        "PekuloTooltip",
        "CategoryIcon",
        "CategoryPicker",
        "PekuloAccountRow",
        "PekuloAccountsSection",
        "PekuloActivityRow",
        "PekuloClassRow",
        "PekuloCompositionCard",
        "PekuloCompositionRow",
        "PekuloContextualAddButton",
        "PekuloCountUpEUR",
        "PekuloCountUpPct",
        "PekuloDonut",
        "PekuloDonutCard",
        "PekuloEmptyState",
        "PekuloErrorBoundary",
        "PekuloHero",
        "PekuloHeroCard",
        "PekuloHoldingRow",
        "PekuloHypothesisCard",
        "PekuloHypothesisVerdict",
        "PekuloKpiTile",
        "PekuloMilestoneRow",
        "PekuloMilestonesCard",
        "PekuloMobileBottomNav",
        "PekuloMonthlyRow",
        "PekuloNavRail",
        "PekuloPagination",
        "PekuloProjectionChart",
        "PekuloPropertyCard",
        "PekuloRecentActivityCard",
        "PekuloSegmentedControl",
        "PekuloSettingRow",
        "PekuloSkeleton",
        "PekuloStaggerList",
        "PekuloStat",
        "PekuloSuggestionRow",
        "PekuloToggleRow",
        "PekuloTopTabToggle",
        "PekuloTrajectoryChart",
        "PekuloTrajectoryCard",
        "PekuloUserDot",
        "TransactionLogo",
      ] as const;

      for (const name of expected) {
        expect(PekuloUI[name]).toBeDefined();
      }
    });

    it("renders charts, cards, rows, navigation, and domain components in dark & light themes", async () => {
      const ui = (
        <View>
          <Section title="Vue globale" action={<HeaderAction label="Ajouter" icon={Compass} />}>
            <PekuloHeroCard totalEur={180400} aheadEur={2781} targetCapital={800000} targetYear={2055} requiredYearlyEur={20653} />
            <PekuloDonutCard pct={0.226} centered ariaLabel="Cap 22.6 %" />
            <PekuloTrajectoryCard months={[1, 2, 3]} actual={[100, 120, 140]} plan={[100, 115, 130]} />
            <PekuloProjectionChart
              years={[2026, 2030, 2040]}
              actual={[180400, 250000, 480000]}
              required={[180400, 260000, 500000]}
              nowMarker={{ year: 2026, value: 180400 }}
              capMarker={{ year: 2040, value: 500000 }}
            />
            <PekuloHypothesisCard reaches={false} headline="En dessous du cap" deltaLabel="−20 000 €" gapLabel="+150 €/mois" />
            <PekuloKpiTile label="Avancement" valueTop="22,6 %" valueBottom="vs 800 k€" progress={0.226} />
            <PekuloCountUpEUR value={180400} />
            <PekuloCountUpPct value={0.226} precise />
            <PekuloHero variant="mobile" totalEur={180400} aheadEur={2781} />
            <PekuloStat label="Net" value="+1 050 €" tone="gain" />
            <PekuloDonut pct={0.5} size={40} stroke={4} />
            <PekuloTrajectoryChart months={[1, 2]} actual={[10, 20]} plan={[10, 15]} />
            <PekuloHypothesisVerdict reaches headline="Cap atteint" deltaLabel="+1 000 €" />
            <PekuloCompositionCard
              items={[{ id: "1", label: "Liquidités", amount: 15000, pct: 0.1 }]}
            />
            <PekuloCompositionRow label="Actions" amount={100000} pct={0.55} />
            <PekuloClassRow label="ETF" amountEur={80000} pct={0.44} />
            <PekuloAccountsSection
              accounts={[{ label: "Livret A", type: "livret", institution: "SG", balanceEur: 12000 }]}
            />
            <PekuloAccountRow label="Compte courant" type="banque" balanceEur={2400} />
            <PekuloHoldingRow
              holding={{
                ticker: "CW8.PA",
                kind: "etf",
                label: "Amundi MSCI World",
                account: "PEA",
                quantity: 100,
                pricePerUnit: 500,
                marketValueEur: 50000,
                pnlEur: 5000,
                pnlPct: 11.1,
              }}
            />
            <PekuloMilestonesCard
              milestones={[
                {
                  id: "m1",
                  label: "Premier palier",
                  targetEur: 100000,
                  targetYear: 2032,
                  progressPct: 0.6,
                  deltaEur: 5000,
                  status: "ahead",
                },
              ]}
            />
            <PekuloMilestoneRow
              milestone={{
                id: "m2",
                label: "Palier 2",
                targetEur: 300000,
                targetYear: 2040,
                progressPct: 0.25,
                deltaEur: -1000,
                status: "behind",
              }}
            />
            <PekuloPropertyCard
              property={{
                label: "Lyon 7e",
                valuationEur: 320000,
                debtRemainingEur: 200000,
                monthlyPaymentEur: 1100,
                yearsRemaining: 18,
                repaidPct: 0.37,
              }}
            />
            <PekuloMonthlyRow
              month={{
                monthLabel: "octobre 2026",
                incomeEur: 4000,
                spendingEur: 2700,
                netEur: 1300,
                closed: true,
              }}
            />
            <PekuloRecentActivityCard
              activities={[
                {
                  direction: "out",
                  label: "Carrefour",
                  account: "SG",
                  category: "Courses",
                  amountEur: 85,
                },
              ]}
            />
            <PekuloActivityRow
              tx={{ direction: "in", label: "Salaire", account: "SG", category: "Salaire", amountEur: 3500 }}
              logo={<TransactionLogo src={null} category="salaire" />}
              aiApplied
            />
            <CategoryIcon category="courses" />
            <PekuloSettingRow label="Export" value="JSON" />
            <PekuloStaggerList>
              <Text>Item 1</Text>
              <Text>Item 2</Text>
            </PekuloStaggerList>
            <PekuloSkeleton lines={2} />
            <PekuloEmptyState icon={Compass} title="Rien ici" message="Ajoutez un élément" />
            <PekuloContextualAddButton label="Ajouter" onPress={jest.fn()} />
            <PekuloUserDot initial="a" onPress={jest.fn()} />
            <PekuloTopTabToggle topTab="cap" onChange={jest.fn()} />
            <PekuloMobileBottomNav activeKey="cap" onSelect={jest.fn()} />
            <PekuloNavRail activeKey="cap" onSelect={jest.fn()} />
            <PekuloErrorBoundary>
              <Text>OK</Text>
            </PekuloErrorBoundary>
          </Section>
        </View>
      );

      await render(<PekuloRootProvider theme="pekulo-dark">{ui}</PekuloRootProvider>);
      expect(screen.getByText("Vue globale")).toBeTruthy();
      expect(screen.getByText("Lyon 7e")).toBeTruthy();
      expect(screen.getByText("CW8.PA")).toBeTruthy();

      await render(<PekuloRootProvider theme="pekulo-light">{ui}</PekuloRootProvider>);
      expect(screen.getByText("Vue globale")).toBeTruthy();
    });

    it("renders and drives interactive primitives, pickers, calendar, toast, and theme switching", async () => {
      const onConfirm = jest.fn();
      const onPageChange = jest.fn();
      const onSelectChange = jest.fn();
      const onDateChange = jest.fn();
      const onToggle = jest.fn();
      const onSegment = jest.fn();

      await render(
        <PekuloRootProvider theme="pekulo-dark">
          <View>
            <ThemeToggleProbe />
            <ToastProbe />
            <PekuloCard>
              <PekuloCardHeader>
                <PekuloCardTitle>Carte</PekuloCardTitle>
                <PekuloCardDescription>Description</PekuloCardDescription>
              </PekuloCardHeader>
              <PekuloCardContent>
                <PekuloFieldGroup>
                  <PekuloField>
                    <PekuloFieldContent>
                      <PekuloFieldLabel htmlFor="pwd">Mot de passe</PekuloFieldLabel>
                      <PekuloInput type="password" placeholder="Secret" testID="pwd-input" />
                      <PekuloFieldDescription>12 caractères min</PekuloFieldDescription>
                      <PekuloFieldError errors={["Champ requis"]} />
                    </PekuloFieldContent>
                  </PekuloField>
                  <PekuloLabel>Notes</PekuloLabel>
                  <PekuloTextarea placeholder="Note" />
                  <PekuloNativeSelect
                    testID="native-select"
                    defaultValue="pea"
                    onValueChange={onSelectChange}
                  >
                    <option value="livret">Livret</option>
                    <option value="pea">PEA</option>
                  </PekuloNativeSelect>
                  <CategoryPicker
                    value="courses"
                    onValueChange={jest.fn()}
                    options={[{ value: "courses", label: "Courses" }]}
                  />
                  <PekuloSelect value="a" onValueChange={jest.fn()}>
                    <PekuloSelect.Trigger>
                      <PekuloSelect.Value placeholder="Choisir" />
                    </PekuloSelect.Trigger>
                  </PekuloSelect>
                  <PekuloCheckbox checked onCheckedChange={jest.fn()}>
                    <PekuloCheckbox.Indicator />
                  </PekuloCheckbox>
                  <PekuloNativeCheckbox testID="native-cb" />
                  <PekuloRadioGroup value="1" onValueChange={jest.fn()}>
                    <PekuloRadioGroup.Item value="1" />
                  </PekuloRadioGroup>
                  <PekuloSlider defaultValue={[40]} max={100} />
                  <PekuloSwitch checked onCheckedChange={jest.fn()} />
                  <PekuloToggleRow label="Activer" checked={false} onChange={onToggle} />
                  <PekuloCalendar mode="single" selected={new Date(2026, 0, 15)} onSelect={onDateChange} />
                  <PekuloDatePicker value={new Date(2026, 0, 15)} onChange={onDateChange} />
                  <PekuloProgress value={50} />
                  <PekuloLoadingItem title="Synchro" trailing="1/2" />
                  <PekuloSpinner />
                  <PekuloSeparator />
                  <PekuloAvatar>
                    <PekuloAvatar.Fallback>
                      <Text>A</Text>
                    </PekuloAvatar.Fallback>
                  </PekuloAvatar>
                  <PekuloBreadcrumb>
                    <PekuloBreadcrumbList>
                      <PekuloBreadcrumbItem>
                        <PekuloBreadcrumbLink>Cap</PekuloBreadcrumbLink>
                      </PekuloBreadcrumbItem>
                      <PekuloBreadcrumbSeparator />
                      <PekuloBreadcrumbItem>
                        <PekuloBreadcrumbPage>Portefeuille</PekuloBreadcrumbPage>
                      </PekuloBreadcrumbItem>
                    </PekuloBreadcrumbList>
                  </PekuloBreadcrumb>
                  <PekuloButtonGroup>
                    <PekuloButtonGroupText>EUR</PekuloButtonGroupText>
                  </PekuloButtonGroup>
                  <PekuloSubmitButton onPress={jest.fn()}>Valider</PekuloSubmitButton>
                  <PekuloEmpty>
                    <PekuloEmptyHeader>
                      <PekuloEmptyMedia variant="icon">
                        <Compass size={20} color="#EDEDED" />
                      </PekuloEmptyMedia>
                      <PekuloEmptyTitle>Vide</PekuloEmptyTitle>
                      <PekuloEmptyDescription>Aucune donnée</PekuloEmptyDescription>
                    </PekuloEmptyHeader>
                  </PekuloEmpty>
                  <PekuloResizablePanelGroup>
                    <PekuloResizablePanel>
                      <Text>Gauche</Text>
                    </PekuloResizablePanel>
                    <PekuloResizableHandle withHandle />
                    <PekuloResizablePanel>
                      <Text>Droite</Text>
                    </PekuloResizablePanel>
                  </PekuloResizablePanelGroup>
                  <PekuloSegmentedControl
                    ariaLabel="Thème"
                    value="dark"
                    onChange={onSegment}
                    options={[
                      { value: "dark", label: "Sombre", icon: Moon },
                      { value: "light", label: "Clair", icon: Sun },
                    ]}
                  />
                  <PekuloPagination page={2} pageCount={5} onPageChange={onPageChange} />
                  <PekuloSuggestionRow
                    tx={{
                      id: "tx1",
                      direction: "out",
                      label: "Boulangerie",
                      account: "SG",
                      dateLabel: "12 nov",
                      amountEur: 5,
                      suggestedCategory: "Courses",
                      confidence: 0.9,
                      route: "ollama",
                    }}
                    onConfirm={onConfirm}
                  />
                  <PekuloDialog open={false}>
                    <PekuloDialog.Content>
                      <PekuloDialogCloseX />
                    </PekuloDialog.Content>
                  </PekuloDialog>
                  <PekuloDrawer open={false}>
                    <PekuloDrawer.Content>
                      <PekuloDrawer.Header>
                        <PekuloDrawer.Title>Filtres</PekuloDrawer.Title>
                        <PekuloDrawer.Description>Par mois</PekuloDrawer.Description>
                      </PekuloDrawer.Header>
                      <PekuloDrawer.Footer>OK</PekuloDrawer.Footer>
                    </PekuloDrawer.Content>
                  </PekuloDrawer>
                  <PekuloPopover>
                    <PekuloPopover.Trigger>
                      <Text>Menu</Text>
                    </PekuloPopover.Trigger>
                  </PekuloPopover>
                  <PekuloSheet open={false}>
                    <PekuloSheet.Frame>
                      <Text>Sheet</Text>
                    </PekuloSheet.Frame>
                  </PekuloSheet>
                  <PekuloTooltip>
                    <PekuloTooltip.Trigger>
                      <Text>Info</Text>
                    </PekuloTooltip.Trigger>
                  </PekuloTooltip>
                </PekuloFieldGroup>
              </PekuloCardContent>
              <PekuloCardFooter>
                <Text>Pied</Text>
              </PekuloCardFooter>
            </PekuloCard>
          </View>
        </PekuloRootProvider>,
      );

      fireEvent.press(screen.getByText("Notifier"));
      expect(screen.getByText("Enregistré")).toBeTruthy();

      fireEvent.press(screen.getByText("Theme: pekulo-dark"));
      expect(screen.getByText("Theme: pekulo-light")).toBeTruthy();

      fireEvent.press(screen.getByText("✓ Confirmer"));
      expect(onConfirm).toHaveBeenCalledTimes(1);

      fireEvent.press(screen.getByText("3"));
      expect(onPageChange).toHaveBeenCalledWith(3);

      fireEvent.press(screen.getByText("Clair"));
      expect(onSegment).toHaveBeenCalledWith("light");

      fireEvent.press(screen.getByText("Livret"));
      expect(onSelectChange).toHaveBeenCalledWith("livret");
    });
  });
  ```

  Run: `bun --filter='@pekulo/mobile' run test __tests__/ui-native-parity.test.tsx`
  Expected: `Tests: 3 passed, 3 total`, exit 0.
  Commit: `git add apps/mobile/__tests__/ui-native-parity.test.tsx && git commit -m "test(#154): verify 100% @pekulo/ui native parity and interactions under Jest"`

- [x] **T11 — Full monorepo quality sweep (`format`, `lint`, `typecheck`, `test`, `tamagui-css-fresh`)** [AC: AC-2, AC-5]

  Run every check from repo root in order (Lesson 2026-06-01 + Lesson 2026-05-04 + Lesson 2026-05-19):

  ```bash
  cd "$(git rev-parse --show-toplevel)"
  bun run format
  bun run format:check
  bun run lint
  bun run typecheck
  bun --filter='@pekulo/ui' run test:visual
  bun --filter='@pekulo/ui' run test:axe
  bun --filter='@pekulo/ui' run test
  bun --filter='@pekulo/web' run test
  bun --filter='@pekulo/mobile' run test
  bun run generate:tamagui-css && git diff --exit-code packages/ui/public/tamagui.generated.css
  ```

  Expected: every command exits 0; `packages/ui/public/tamagui.generated.css` has zero diff; `@pekulo/ui` Vitest (`test:visual`, `test:axe`, `test`), `@pekulo/web` Vitest, and `@pekulo/mobile` Jest 30 tests all pass cleanly.
  Commit: `git add -u && git commit -m "chore(#154): format and verify full 10-3 native DS parity sweep"` (only if formatting touched tracked files; otherwise confirm clean working tree).

## Dev Notes

### Existing code at write time (Step-0 verbatim quotes)

Every modified existing file is quoted verbatim from the working tree at story-write time:

**1. `packages/ui/package.json:65-86` (current):**

```json
  "devDependencies": {
    "@pekulo/tsconfig": "workspace:*",
    "@tamagui/cli": "2.3.1",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^16.0.0",
    "@types/bun": "^1.3.0",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitest/coverage-v8": "^3.2.6",
    "happy-dom": "^20.0.0",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "typescript": "^6.0.3",
    "vitest": "^3.2.6",
    "vitest-axe": "^0.1.0"
  },
  "peerDependencies": {
    "react": "19.3.0",
    "react-dom": "19.3.0"
  }
```

**2. `apps/mobile/package.json:17-41` (current):**

```json
  "dependencies": {
    "@expo-google-fonts/geist": "^0.4.2",
    "@expo-google-fonts/geist-mono": "^0.4.3",
    "@pekulo/types": "workspace:*",
    "@pekulo/ui": "workspace:*",
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
    "react": "19.3.0",
    "react-native": "0.88.1",
    "react-native-gesture-handler": "~3.3.0",
    "react-native-reanimated": "4.7.1",
    "react-native-safe-area-context": "~5.11.1",
    "react-native-screens": "~4.30.1",
    "react-native-worklets": "0.13.0",
    "tamagui": "2.3.1"
  },
```

**3. `apps/mobile/jest.config.js:1-31` & `apps/mobile/jest.setup.ts:1-27` (current):**

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
    "^@pekulo/ui$": "<rootDir>/../../packages/ui/src/index.native.ts",
    "^@pekulo/ui/client$": "<rootDir>/../../packages/ui/src/client.ts",
    "^@pekulo/ui/tamagui-config$": "<rootDir>/../../packages/ui/src/config/tamagui.ts",
    "^@/(.*)$": "<rootDir>/$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((?:\\.bun/[^/]+/node_modules/)?(?:(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|standard-navigation|tamagui|@tamagui/.*|@pekulo/.*)))",
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

**4. `packages/ui/src/animations/use-stagger.ts:13-23` (current):**

```ts
function getReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeReducedMotion(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
```

**5. `packages/ui/src/provider/index.native.tsx:14-36` (current):**

```tsx
import type { ReactNode } from "react";
import { useColorScheme } from "react-native";
import { TamaguiProvider, Theme } from "tamagui";

import { config } from "../config/tamagui";

export interface PekuloRootProviderProps {
  children: ReactNode;
  /** Optional explicit theme override; defaults to OS color scheme ("pekulo-dark" fallback). */
  theme?: "pekulo-dark" | "pekulo-light" | "system";
}

export function PekuloRootProvider({ children, theme = "system" }: PekuloRootProviderProps) {
  const colorScheme = useColorScheme();
  const resolvedTheme =
    theme === "system" ? (colorScheme === "light" ? "pekulo-light" : "pekulo-dark") : theme;

  return (
    <TamaguiProvider config={config} defaultTheme={resolvedTheme}>
      <Theme name={resolvedTheme}>{children}</Theme>
    </TamaguiProvider>
  );
}
```

**6. `packages/ui/src/index.native.ts:1-21` (current):**

```ts
export { PekuloRootProvider, type PekuloRootProviderProps } from "./provider/index.native";

// Pure design tokens and theme maps
export * from "./tokens";
export * from "./themes";

// Native-safe animation hook (guards window.matchMedia)
export { useCountUp, type UseCountUpOptions } from "./animations/use-count-up";

// Cross-platform pilot components (pure Tamagui Text + View)
export { PekuloStat, type PekuloStatProps } from "./components/PekuloStat";
export { PekuloHero, type PekuloHeroProps } from "./components/PekuloHero";
```

**7. `packages/ui/src/ds-coverage.meta.test.ts:70-76` & `103-118` (current):**

```ts
function primitiveEntries(): Array<{ name: string; dir: string }> {
  return readdirSync(PRIMITIVES_DIR)
    .filter((entry) => entry.endsWith(".tsx") && !entry.includes(".test."))
    .map((entry) => entry.replace(/\.tsx$/, ""))
    .sort()
    .map((name) => ({ name, dir: PRIMITIVES_DIR }));
}
```

```ts
function moduleComponents(module: string): string[] {
  const dir = join(SRC, module);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."))
    .flatMap((f) => [
      ...readFileSync(join(dir, f), "utf8").matchAll(
        // `export function Foo` and `export const Foo = …`. A default export
        // is deliberately not matched: `export *` never re-exports a default,
        // so it cannot reach the public barrel this way.
        /export\s+(?:function|const)\s+([A-Z]\w*)/g,
      ),
    ])
    .map((m) => m[1])
    .sort();
}
```

### File structure design (3-bullet decision template per file)

- **`apps/mobile/package.json` & `packages/ui/package.json` & `bun.lock`**
  - Single responsibility: Declare Expo SDK 58 native UI dependencies (`react-native-svg@15.16.0`, `lucide-react-native@^1.73.0`, `@react-native-community/datetimepicker@9.2.1`, `@react-native-picker/picker@2.11.4`) as runtime deps on mobile and optional peer/dev deps on `@pekulo/ui`.
  - Inputs + outputs: Consumed by Bun isolated linker, Expo autolinking, Metro, TypeScript, and Jest without pulling RN deps into `apps/web`.
- **`apps/mobile/jest.config.js` & `apps/mobile/jest.setup.ts`**
  - Single responsibility: Resolve Bun `.bun/` native package paths and provide deterministic Jest mocks for `@react-native-community/datetimepicker` and `@react-native-picker/picker`.
  - Inputs + outputs: Consumed by `bun --filter='@pekulo/mobile' run test`.
- **`packages/ui/src/animations/use-stagger.ts`**
  - Single responsibility: Guard `window.matchMedia` availability so `useStagger` and `usePrefersReducedMotion` run safely in React Native without changing web behaviour.
  - Inputs + outputs: Exports `useStagger`, `usePrefersReducedMotion`.
- **`packages/ui/src/toast/index.native.tsx` & `packages/ui/src/provider/index.native.tsx`**
  - Single responsibility: Provide native `ToastProvider` / `useToast` / `PekuloToastViewport` (`position="absolute"`) and runtime `useThemeSetting` inside `PekuloRootProvider`.
  - Inputs + outputs: Wraps `TamaguiProvider` + `Theme` + `ToastProvider`; exports `PekuloRootProvider`, `useThemeSetting`, `ToastProvider`, `useToast`, `PekuloToast`, `PekuloToastViewport`.
- **`packages/ui/src/components/PekuloDonut/PekuloDonut.native.tsx`, `PekuloTrajectoryChart.native.tsx`, `PekuloProjectionChart.native.tsx`**
  - Single responsibility: Render Pekulo's ring and line charts natively via `react-native-svg` (`Svg`, `Circle`, `Path`) with theme tokens resolved through `useTheme()`.
  - Inputs + outputs: Same prop contracts as web counterparts; outputs native SVG trees.
- **`packages/ui/src/components/{CategoryIcon,TransactionLogo,PekuloActivityRow,PekuloMilestoneRow,PekuloMonthlyRow,PekuloContextualAddButton,PekuloEmptyState,PekuloSegmentedControl,PekuloPagination,PekuloSuggestionRow,PekuloNavRail,PekuloMobileBottomNav,PekuloSkeleton,PekuloStaggerList,PekuloErrorBoundary}/*.native.tsx`**
  - Single responsibility: Provide React Native implementations of every icon-bearing, layout-specific, image-rendering, or `<style>`-using domain component with `lucide-react-native`, RN `Image`, `Animated`, and `useTheme()`.
  - Inputs + outputs: Match web component prop types while resolving all colors via Tamagui themes instead of `var(--...)` or `currentColor`.
- **`packages/ui/src/primitives/{HeaderAction,PekuloSpinner,PekuloButton,PekuloButtonGroup,PekuloSubmitButton,PekuloCard,PekuloEmpty,PekuloLabel,PekuloProgress,PekuloInput,PekuloTextarea,PekuloSwitch,PekuloCheckbox,PekuloNativeCheckbox,PekuloSelect,PekuloNativeSelect,PekuloPopover,PekuloDialogCloseX,PekuloDrawer,PekuloBreadcrumb,PekuloResizable,PekuloCalendar,PekuloDatePicker}.native.tsx`**
  - Single responsibility: Provide React Native implementations of every web-coupled primitive using RN `TextInput`, `Animated`, `@tamagui/sheet` (for `PekuloDrawer`), `@react-native-picker/picker` (for `PekuloNativeSelect`), `@react-native-community/datetimepicker` (for `PekuloCalendar`), and `lucide-react-native`.
  - Inputs + outputs: Match exported component names and APIs so `primitives/index.ts` resolves transparently to `.native.tsx` under Metro and `apps/mobile` TypeScript.
- **`packages/ui/src/index.native.ts` & `packages/ui/src/ds-coverage.meta.test.ts`**
  - Single responsibility: Expose 100% of `@pekulo/ui`'s public surface on React Native and enforce barrel parity mechanically in Vitest without flagging `*.native.tsx` as web coverage gaps.
  - Inputs + outputs: Re-exports `provider/index.native`, `toast/index.native`, `tokens`, `themes`, `animations`, `primitives`, `components`.
- **`apps/mobile/__tests__/ui-native-parity.test.tsx`**
  - Single responsibility: Verify every exported `@pekulo/ui` symbol is defined and renders cleanly in both `pekulo-dark` and `pekulo-light` themes with core interactions tested.
  - Inputs + outputs: Runs under `bun --filter='@pekulo/mobile' run test`.

### Architecture & Dependency Notes

- **Zero web regression (`docs/stories/10-1-visual-snapshot-suite.md`, `10-2`):** Web `*.tsx` component and primitive files stay runtime-untouched (only the `window.matchMedia` guard in `use-stagger.ts` and the type-only `ComponentProps<typeof TamaTooltip>` adjustment in `PekuloTooltip.tsx`). `packages/ui/tsconfig.json` already excludes `**/*.native.{ts,tsx}`, and `bun run generate:tamagui-css` ignores `.native.tsx` files, keeping `packages/ui/public/tamagui.generated.css` byte-identical.
- **Native package pins (`apps/mobile/node_modules/expo/bundledNativeModules.json`):** `react-native-svg@15.16.0`, `@react-native-community/datetimepicker@9.2.1`, `@react-native-picker/picker@2.11.4`, and `lucide-react-native@^1.73.0` (`react@^19.0.0`, `react-native-svg@^15.0.0`).
- **TR-strict palette discipline (`docs/ux/design-spec.md` §1):** All native components resolve surface, typography, chart, and perf delta tokens through Tamagui's `pekulo-dark` / `pekulo-light` themes (`useTheme()`), keeping `$accent` / `$success` / `$danger` strictly scoped to monetary deltas, validation states, and transient feedback.
- **Testing & Typecheck gates (Lessons 2026-05-07, 2026-05-19, 2026-06-01):** Always use `bun --filter='@pekulo/ui'` / `bun --filter='@pekulo/mobile'` / `bun --filter='@pekulo/web'`. Run `bun run typecheck` manually before committing because lefthook pre-commit does not invoke `tsc`.
- **Commit prefix:** `feat(#154): …` / `chore(#154): …` / `test(#154): …`. Final PR body: `Closes #154`.

## File List

**Modified:**

- `apps/mobile/package.json`
- `apps/mobile/jest.config.js`
- `apps/mobile/jest.setup.ts`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/(cap)/_layout.tsx`
- `apps/mobile/app/(tabs)/(cap)/index.tsx`
- `apps/mobile/components/screen-shell.tsx`
- `apps/mobile/__tests__/cap-screen.test.tsx`
- `packages/ui/package.json`
- `packages/ui/src/animations/use-stagger.ts`
- `packages/ui/src/primitives/PekuloTooltip.tsx`
- `packages/ui/src/provider/index.native.tsx`
- `packages/ui/src/index.native.ts`
- `packages/ui/src/ds-coverage.meta.test.ts`
- `bun.lock`
- `docs/epics.md`
- `docs/epics-context/epic-10-context.md`
- `docs/state.yaml`

**Created (`@pekulo/ui` native implementations & tests):**

- `packages/ui/src/animations/use-stagger.native.ts`
- `packages/ui/src/toast/index.native.tsx`
- `packages/ui/src/components/CategoryIcon/CategoryIcon.native.tsx`
- `packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.native.tsx`
- `packages/ui/src/components/PekuloContextualAddButton/PekuloContextualAddButton.native.tsx`
- `packages/ui/src/components/PekuloDonut/PekuloDonut.native.tsx`
- `packages/ui/src/components/PekuloEmptyState/PekuloEmptyState.native.tsx`
- `packages/ui/src/components/PekuloErrorBoundary/PekuloErrorBoundary.native.tsx`
- `packages/ui/src/components/PekuloMilestoneRow/PekuloMilestoneRow.native.tsx`
- `packages/ui/src/components/PekuloMobileBottomNav/PekuloMobileBottomNav.native.tsx`
- `packages/ui/src/components/PekuloMonthlyRow/PekuloMonthlyRow.native.tsx`
- `packages/ui/src/components/PekuloNavRail/PekuloNavRail.native.tsx`
- `packages/ui/src/components/PekuloPagination/PekuloPagination.native.tsx`
- `packages/ui/src/components/PekuloProjectionChart/PekuloProjectionChart.native.tsx`
- `packages/ui/src/components/PekuloSegmentedControl/PekuloSegmentedControl.native.tsx`
- `packages/ui/src/components/PekuloSkeleton/PekuloSkeleton.native.tsx`
- `packages/ui/src/components/PekuloStaggerList/PekuloStaggerList.native.tsx`
- `packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.native.tsx`
- `packages/ui/src/components/PekuloTrajectoryChart/PekuloTrajectoryChart.native.tsx`
- `packages/ui/src/components/TransactionLogo/TransactionLogo.native.tsx`
- `packages/ui/src/primitives/HeaderAction.native.tsx`
- `packages/ui/src/primitives/PekuloBreadcrumb.native.tsx`
- `packages/ui/src/primitives/PekuloButton.native.tsx`
- `packages/ui/src/primitives/PekuloButtonGroup.native.tsx`
- `packages/ui/src/primitives/PekuloCalendar.native.tsx`
- `packages/ui/src/primitives/PekuloCard.native.tsx`
- `packages/ui/src/primitives/PekuloCheckbox.native.tsx`
- `packages/ui/src/primitives/PekuloDatePicker.native.tsx`
- `packages/ui/src/primitives/PekuloDialogCloseX.native.tsx`
- `packages/ui/src/primitives/PekuloDrawer.native.tsx`
- `packages/ui/src/primitives/PekuloEmpty.native.tsx`
- `packages/ui/src/primitives/PekuloInput.native.tsx`
- `packages/ui/src/primitives/PekuloLabel.native.tsx`
- `packages/ui/src/primitives/PekuloNativeCheckbox.native.tsx`
- `packages/ui/src/primitives/PekuloNativeSelect.native.tsx`
- `packages/ui/src/primitives/PekuloPopover.native.tsx`
- `packages/ui/src/primitives/PekuloProgress.native.tsx`
- `packages/ui/src/primitives/PekuloResizable.native.tsx`
- `packages/ui/src/primitives/PekuloSelect.native.tsx`
- `packages/ui/src/primitives/PekuloSpinner.native.tsx`
- `packages/ui/src/primitives/PekuloSubmitButton.native.tsx`
- `packages/ui/src/primitives/PekuloSwitch.native.tsx`
- `packages/ui/src/primitives/PekuloTextarea.native.tsx`
- `apps/mobile/__tests__/ui-native-parity.test.tsx`
- `docs/stories/10-3-ui-native-parity.md`

## Dev Agent Record

- **Model:** Gemini 4 Hydrogen (High)
- **Started:** 2026-11-16T18:08:30Z
- **Completed:** 2026-11-16T17:37:31Z

### Summary

Implemented 100% React Native platform parity across `@pekulo/ui` (`.native.tsx` siblings, native toast provider, native root provider, complete `packages/ui/src/index.native.ts` barrel, and barrel/meta parity enforcement in `packages/ui/src/ds-coverage.meta.test.ts`), verified with `@pekulo/mobile` Jest/RNTL tests, `@pekulo/ui` Vitest snapshot/a11y/meta tests, `@pekulo/web` tests, and full monorepo format/lint/typecheck/Tamagui CSS generation without regression on web (`packages/ui/public/tamagui.generated.css` zero diff).

### Files changed

- `apps/mobile/__tests__/ui-native-parity.test.tsx`
- `apps/mobile/jest.config.js`
- `apps/mobile/jest.setup.ts`
- `apps/mobile/package.json`
- `bun.lock`
- `packages/ui/package.json`
- `packages/ui/src/animations/use-stagger.ts`
- `packages/ui/src/components/CategoryIcon/CategoryIcon.native.tsx`
- `packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.native.tsx`
- `packages/ui/src/components/PekuloContextualAddButton/PekuloContextualAddButton.native.tsx`
- `packages/ui/src/components/PekuloDonut/PekuloDonut.native.tsx`
- `packages/ui/src/components/PekuloEmptyState/PekuloEmptyState.native.tsx`
- `packages/ui/src/components/PekuloErrorBoundary/PekuloErrorBoundary.native.tsx`
- `packages/ui/src/components/PekuloMilestoneRow/PekuloMilestoneRow.native.tsx`
- `packages/ui/src/components/PekuloMobileBottomNav/PekuloMobileBottomNav.native.tsx`
- `packages/ui/src/components/PekuloMonthlyRow/PekuloMonthlyRow.native.tsx`
- `packages/ui/src/components/PekuloNavRail/PekuloNavRail.native.tsx`
- `packages/ui/src/components/PekuloPagination/PekuloPagination.native.tsx`
- `packages/ui/src/components/PekuloProjectionChart/PekuloProjectionChart.native.tsx`
- `packages/ui/src/components/PekuloSegmentedControl/PekuloSegmentedControl.native.tsx`
- `packages/ui/src/components/PekuloSkeleton/PekuloSkeleton.native.tsx`
- `packages/ui/src/components/PekuloStaggerList/PekuloStaggerList.native.tsx`
- `packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.native.tsx`
- `packages/ui/src/components/PekuloTrajectoryChart/PekuloTrajectoryChart.native.tsx`
- `packages/ui/src/components/TransactionLogo/TransactionLogo.native.tsx`
- `packages/ui/src/ds-coverage.meta.test.ts`
- `packages/ui/src/index.native.ts`
- `packages/ui/src/primitives/HeaderAction.native.tsx`
- `packages/ui/src/primitives/PekuloBreadcrumb.native.tsx`
- `packages/ui/src/primitives/PekuloButton.native.tsx`
- `packages/ui/src/primitives/PekuloButtonGroup.native.tsx`
- `packages/ui/src/primitives/PekuloCalendar.native.tsx`
- `packages/ui/src/primitives/PekuloCard.native.tsx`
- `packages/ui/src/primitives/PekuloCheckbox.native.tsx`
- `packages/ui/src/primitives/PekuloDatePicker.native.tsx`
- `packages/ui/src/primitives/PekuloDialogCloseX.native.tsx`
- `packages/ui/src/primitives/PekuloDrawer.native.tsx`
- `packages/ui/src/primitives/PekuloEmpty.native.tsx`
- `packages/ui/src/primitives/PekuloInput.native.tsx`
- `packages/ui/src/primitives/PekuloLabel.native.tsx`
- `packages/ui/src/primitives/PekuloNativeCheckbox.native.tsx`
- `packages/ui/src/primitives/PekuloNativeSelect.native.tsx`
- `packages/ui/src/primitives/PekuloPopover.native.tsx`
- `packages/ui/src/primitives/PekuloProgress.native.tsx`
- `packages/ui/src/primitives/PekuloResizable.native.tsx`
- `packages/ui/src/primitives/PekuloSelect.native.tsx`
- `packages/ui/src/primitives/PekuloSpinner.native.tsx`
- `packages/ui/src/primitives/PekuloSubmitButton.native.tsx`
- `packages/ui/src/primitives/PekuloSwitch.native.tsx`
- `packages/ui/src/primitives/PekuloTextarea.native.tsx`
- `packages/ui/src/primitives/PekuloTooltip.tsx`
- `packages/ui/src/provider/index.native.tsx`
- `packages/ui/src/toast/index.native.tsx`

### Deviations

- **Typed mock casts in `apps/mobile/jest.setup.ts`:** `jest-expo` TypeScript compilation rejects untyped `jest.fn(({ children }) => ...)` / CommonJS `require(...)`; added explicit `ReactNode` / prop typings.
- **Additional `window.matchMedia` guard (`packages/ui/src/animations/use-stagger.ts`):** `jest-expo` stubs `window.matchMedia` without `.addEventListener`; guarded `!mq || typeof mq.addEventListener !== "function"`.
- **`ToastProvider` timer cleanup (`packages/ui/src/toast/index.native.tsx`):** Cleared auto-dismiss timers on unmount via `timersRef` so Jest exits without open handles.
- **Native prop / API fixes vs story snippets:**
  - `PekuloInput.native.tsx` & `PekuloTextarea.native.tsx`: omitted both `"editable"` and `"onChange"` from RN `TextInputProps` so `{ target: { value } }` `onChange` matches web.
  - `PekuloSelect.native.tsx`: used valid Tamagui v5 breakpoint `"max-md"` instead of `"maxMd"`.
  - `PekuloTooltip.tsx`: replaced `@tamagui/tooltip`'s `TooltipProps` import (absent in RN typings) with `ComponentProps<typeof TamaTooltip>` so `@pekulo/mobile` `tsc` resolves cleanly with zero web runtime change.
  - Accessibility & RN rules: used `styled(View/Text, { role: ... })` / `accessibilityRole` + `aria-current`/`accessibilityState` for `oxlint` `jsx-a11y` compliance, wrapped `DrawerContext.Provider` value in `useMemo`, used `PekuloDialog.Portal` and `<Text>` inside `PekuloDrawer.Footer` in `apps/mobile/__tests__/ui-native-parity.test.tsx`, omitted non-existent `id` on `Suggestion` fixture, and `await`ed all RNTL v14 `render()` / `fireEvent.*()` calls.
- **Visual MCP verification (`AGENTS.md` React Grab):** `mcp__react-grab-mcp__get_element_context` is unavailable in this environment (and target components are React Native); verified rendering and token resolution via RNTL + Vitest snapshots instead.

### Test output

- `bun run format:check` — exit 0 (1347 files)
- `bun run lint` — exit 0 (0 errors, 4 warnings across 1158 files)
- `bun run typecheck` — exit 0 (`10 successful, 10 total`)
- `bun --filter='@pekulo/ui' run test:visual` — exit 0 (`77 passed | 82 skipped (159)`, `137 passed | 206 skipped (343)`)
- `bun --filter='@pekulo/ui' run test:axe` — exit 0 (`77 passed | 82 skipped (159)`, `130 passed | 213 skipped (343)`)
- `bun --filter='@pekulo/ui' run test` — exit 0 (`159 passed (159)`, `342 passed | 1 skipped (343)`)
- `bun --filter='@pekulo/web' run test` — exit 0 (`125 passed (125)`, `435 passed (435)`)
- `bun --filter='@pekulo/mobile' run test` — exit 0 (`Test Suites: 3 passed, 3 total`, `Tests: 12 passed, 12 total`)
- `bun run generate:tamagui-css && git diff --exit-code packages/ui/public/tamagui.generated.css` — exit 0 (zero diff)
