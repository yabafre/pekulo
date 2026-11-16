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
