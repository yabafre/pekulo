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
//
// Review fix: the build-time side is loaded the way the compiler loads it
// (helpers/load-compiler-config.cjs, child Node process, no `.native.ts`
// resolution), not through Jest's resolver — under Jest, `./fonts` already
// resolves to `fonts.native`, so an in-process comparison passed by
// construction. Witnessed RED by pointing apps/mobile/tamagui.config.ts back at
// `@pekulo/ui/tamagui-config`: the compiler side then reports the web stack
// `Geist, ui-sans-serif, …` and an empty defaultProps.
// Module scope: other script-style suites declare the same globals.
export {};

const { execFileSync } = require("node:child_process") as {
  execFileSync: (file: string, args: string[], options: { encoding: "utf8" }) => string;
};
const { dirname, join } = require("node:path") as {
  dirname: (filePath: string) => string;
  join: (...segments: string[]) => string;
};

const resolveModule = (require as unknown as { resolve: (id: string) => string }).resolve;
const MOBILE_ROOT = dirname(resolveModule("../package.json"));

type LoadedConfig = {
  fontsParsed: Record<string, { family: unknown }>;
  defaultProps: Record<string, Record<string, unknown>>;
};

function familyOf(fonts: LoadedConfig["fontsParsed"], key: string): unknown {
  const family = fonts[key]?.family as { val?: unknown } | string | undefined;
  return typeof family === "object" && family !== null ? family.val : family;
}

describe("Tamagui native compiler config (story 10-8)", () => {
  let compiler: LoadedConfig;
  let runtime: LoadedConfig;

  beforeAll(() => {
    compiler = JSON.parse(
      execFileSync(
        "node",
        [join(MOBILE_ROOT, "__tests__/helpers/load-compiler-config.cjs"), MOBILE_ROOT],
        { encoding: "utf8" },
      ),
    ) as LoadedConfig;
    jest.isolateModules(() => {
      const config = require("@pekulo/ui/tamagui-config").config;
      runtime = JSON.parse(
        JSON.stringify({ fontsParsed: config.fontsParsed, defaultProps: config.defaultProps }),
      ) as LoadedConfig;
    });
  }, 60000);

  it("the compiler (plain Node require) loads the native Geist faces", () => {
    expect(familyOf(compiler.fontsParsed, "$body")).toBe("Geist_400Regular");
    expect(familyOf(compiler.fontsParsed, "$heading")).toBe("Geist_600SemiBold");
    expect(familyOf(compiler.fontsParsed, "$mono")).toBe("GeistMono_400Regular");
  });

  it("the compiler carries the native Text font default", () => {
    expect(compiler.defaultProps.Text).toEqual({ fontFamily: "$body" });
  });

  it("compiler and runtime configs agree on fonts and the Text default", () => {
    expect(compiler.fontsParsed).toEqual(runtime.fontsParsed);
    expect(compiler.defaultProps).toEqual(runtime.defaultProps);
  });
});
