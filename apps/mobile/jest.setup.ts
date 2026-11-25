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

jest.mock("expo-haptics", () => ({
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    __store: store,
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
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
