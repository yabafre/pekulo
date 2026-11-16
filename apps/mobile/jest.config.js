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
