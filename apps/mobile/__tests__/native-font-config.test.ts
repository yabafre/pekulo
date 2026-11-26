// apps/mobile/__tests__/native-font-config.test.ts
// Story 10-8 AC-3 — the Tamagui compiler must load the native-font config,
// and that config must equal the runtime config (fonts + defaultProps).
//
// AC-3 (verbatim from story 10-8-native-geist-font:29):
//   Given the mobile unit test suite, When it runs for iOS and for Android with
//   a cold transform cache, Then the same assertions prove AC-1 and AC-2 on
//   both, And the suite fails if the build-time style compiler stops using the
//   native font configuration or if the build-time and runtime configurations
//   ever disagree on fonts or text defaults.
// Module scope: other script-style suites declare the same globals.
export {};

const { readFileSync } = require("node:fs") as {
  readFileSync: (filePath: string, encoding: "utf8") => string;
};
const { dirname, join } = require("node:path") as {
  dirname: (filePath: string) => string;
  join: (...segments: string[]) => string;
};

const resolveModule = (require as unknown as { resolve: (id: string) => string }).resolve;
const MOBILE_ROOT = dirname(resolveModule("../package.json"));
const UI_CONFIG = join(MOBILE_ROOT, "../../packages/ui/src/config");

describe("Tamagui native compiler config (story 10-8)", () => {
  it("apps/mobile/tamagui.config.ts re-exports the native compiler config", () => {
    const source = readFileSync(join(MOBILE_ROOT, "tamagui.config.ts"), "utf8");
    expect(source).toMatch(
      /export \{ config as default \} from "@pekulo\/ui\/tamagui-compiler-config";/,
    );
  });

  it("the compiler config imports the native fonts explicitly", () => {
    const source = readFileSync(join(UI_CONFIG, "tamagui.compiler.native.ts"), "utf8");
    expect(source).toMatch(/from "\.\/fonts\.native";/);
  });

  it("compiler and runtime configs agree on fonts and the Text default", () => {
    jest.isolateModules(() => {
      const runtime = require("@pekulo/ui/tamagui-config").config;
      const runtimeFonts = JSON.stringify(runtime.fontsParsed);
      const runtimeDefaults = JSON.stringify(runtime.defaultProps);
      const compiler = require("@pekulo/ui/tamagui-compiler-config").config;
      expect(JSON.stringify(compiler.fontsParsed)).toBe(runtimeFonts);
      expect(JSON.stringify(compiler.defaultProps)).toBe(runtimeDefaults);
      expect(compiler.defaultProps.Text).toEqual({ fontFamily: "$body" });
      expect(compiler.fontsParsed.$body.family.val ?? compiler.fontsParsed.$body.family).toBe(
        "Geist_400Regular",
      );
    });
  });
});
