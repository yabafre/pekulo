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
  const React = require("react") as typeof import("react");
  const { Pressable, Text } = require("react-native") as typeof import("react-native");
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
  const React = require("react") as typeof import("react");
  const { View, Pressable, Text } = require("react-native") as typeof import("react-native");
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
      {
        testID: testID ?? "native-picker",
        accessibilityLabel,
        accessibilityValue: { text: selectedValue },
      },
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
