// apps/mobile/jest.config.js
// Story 10-6 AC-9 — two Jest projects sharing one transform/mapping setup:
//   - `ios`: the historical `jest-expo` preset (haste defaultPlatform ios) for
//     every suite under __tests__/ except __tests__/android/;
//   - `android`: `jest-expo/android` (Platform.OS === "android", `.android.*`
//     resolution) for __tests__/android/**.
const path = require("node:path");
const jestExpoPreset = require("jest-expo/jest-preset");
const jestExpoAndroidPreset = require("jest-expo/android/jest-preset");

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

const MODULE_NAME_MAPPER = {
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
  "^@pekulo/ui/parity$": "<rootDir>/../../packages/ui/src/parity/index.ts",
  "^@pekulo/ui/tamagui-config$": "<rootDir>/../../packages/ui/src/config/tamagui.ts",
  "^@pekulo/contracts$": "<rootDir>/../../packages/contracts/src/index.ts",
  "^@pekulo/validators$": "<rootDir>/../../packages/validators/src/index.ts",
  "^@pekulo/types$": "<rootDir>/../../packages/types/src/index.ts",
  "^@pekulo/zod$": "<rootDir>/../../packages/zod/src/index.ts",
  "^@/(.*)$": "<rootDir>/$1",
};

const TRANSFORM_IGNORE_PATTERNS = [
  "node_modules/(?!((?:\\.bun/[^/]+/node_modules/)?(?:(jest-)?react-native|@react-native(-community)?|@react-native-picker/.*|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|standard-navigation|lucide-react-native|react-native-svg|@orpc/.*|@supabase/.*|@tanstack/.*|@standard-schema/.*|zod|tamagui|@tamagui/.*|@pekulo/.*)))",
];

// jest-expo's default transform only matches `\.[jt]sx?$`, skipping `.mjs` ESM
// entrypoints shipped by `@orpc/*` and `zod` v4 under Jest CommonJS mode.
function projectBase(preset) {
  const { "\\.[jt]sx?$": babelTransform, ...assetTransforms } = preset.transform;
  return {
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    transform: {
      ...assetTransforms,
      "\\.m?[jt]sx?$": babelTransform,
    },
    moduleNameMapper: MODULE_NAME_MAPPER,
    transformIgnorePatterns: TRANSFORM_IGNORE_PATTERNS,
  };
}

/** @type {import("jest").Config} */
module.exports = {
  testTimeout: 20000,
  projects: [
    {
      ...projectBase(jestExpoPreset),
      displayName: "ios",
      preset: "jest-expo",
      testMatch: ["<rootDir>/__tests__/**/*.test.{ts,tsx}"],
      testPathIgnorePatterns: ["/node_modules/", "<rootDir>/__tests__/android/"],
    },
    {
      ...projectBase(jestExpoAndroidPreset),
      displayName: "android",
      preset: "jest-expo/android",
      testMatch: ["<rootDir>/__tests__/android/**/*.test.{ts,tsx}"],
    },
  ],
};
