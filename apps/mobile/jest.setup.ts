// apps/mobile/jest.setup.ts
// Mock Reanimated v4 for Jest unit/navigation tests without a native runtime.
// Note: react-native-reanimated@4.7.1's `mock` entry loads `initializers.native.ts`,
// which calls `JSReanimated.setCSSEventHandler` and throws in Jest; a direct stub
// provides Animated.View/Text/ScrollView and shared-value hooks for @tamagui/animations-reanimated.
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { Image, ScrollView, Text, View } = require("react-native");

  const Animated = {
    View,
    Text,
    Image,
    ScrollView,
    createAnimatedComponent: (Component: unknown) => Component,
    call: () => {},
  };

  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: (init: unknown) => ({ value: init }),
    useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useAnimatedProps: (fn: () => unknown) => fn(),
    useAnimatedReaction: () => {},
    withTiming: (toValue: unknown) => toValue,
    withSpring: (toValue: unknown) => toValue,
    withDecay: (toValue: unknown) => toValue,
    withDelay: (_delay: number, anim: unknown) => anim,
    withSequence: (...anims: unknown[]) => anims[anims.length - 1],
    withRepeat: (anim: unknown) => anim,
    cancelAnimation: () => {},
    runOnJS: (fn: unknown) => fn,
    runOnUI: (fn: unknown) => fn,
    Easing: {
      linear: (t: number) => t,
      ease: (t: number) => t,
      bezier: () => (t: number) => t,
      in: (fn: unknown) => fn,
      out: (fn: unknown) => fn,
      inOut: (fn: unknown) => fn,
    },
    Extrapolation: {
      CLAMP: "clamp",
      EXTEND: "extend",
      IDENTITY: "identity",
    },
    interpolate: (v: number) => v,
    createAnimatedPropAdapter: (fn: unknown) => fn,
    isReanimated3: () => true,
    React,
  };
});

// Ensure expo-font resolves immediately in tests.
jest.mock("expo-font", () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(true),
  hideAsync: jest.fn().mockResolvedValue(true),
}));
