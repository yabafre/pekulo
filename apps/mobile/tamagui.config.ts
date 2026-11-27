// apps/mobile/tamagui.config.ts
// Local root entrypoint for @tamagui/babel-plugin and @tamagui/metro-plugin.
// Story 10-8: re-exports the NATIVE compiler config — the shared runtime
// config resolves "./fonts" to the web stack under the compiler's Node
// require(). Guarded by __tests__/native-font-config.test.ts.
export { config as default } from "@pekulo/ui/tamagui-compiler-config";
