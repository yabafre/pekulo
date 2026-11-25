// apps/mobile/__tests__/android/helpers/android-stack-mock.ts
// Story 10-6 AC-2 — `expo-router/stack` stand-in for the android Jest project.
// `Stack.Toolbar` / `Stack.Toolbar.Button` THROW the exact error expo-router 58
// raises on Android without `@expo/ui`
// (build/layouts/stack-utils/toolbar/processHeaderItemsForPlatform.android.js),
// so any Android render path that still reaches them fails the test.
// `Stack.Screen` renders `options.headerRight()` so header actions can be pressed.
import { Fragment, createElement, type ReactNode } from "react";
import { View } from "react-native";

export const ANDROID_TOOLBAR_ERROR =
  "Stack.Toolbar on Android requires '@expo/ui'. Install it with `npx expo install @expo/ui` and rebuild your app.";

interface MockScreenOptions {
  title?: string;
  headerRight?: () => ReactNode;
}

export function createAndroidStackMock() {
  function MockStack({ children }: { children?: ReactNode }) {
    return createElement(Fragment, null, children);
  }
  MockStack.Screen = function MockStackScreen({ options }: { options?: MockScreenOptions }) {
    if (!options?.headerRight) return null;
    return createElement(View, { testID: "mock-native-header-right" }, options.headerRight());
  };
  function MockToolbar(): never {
    throw new Error(ANDROID_TOOLBAR_ERROR);
  }
  MockToolbar.Button = function MockToolbarButton(): never {
    throw new Error(ANDROID_TOOLBAR_ERROR);
  };
  MockStack.Toolbar = MockToolbar;
  return { __esModule: true, default: MockStack };
}
