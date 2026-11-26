// apps/mobile/__tests__/helpers/load-compiler-config.cjs
// Story 10-8 review (AC-3) — loads apps/mobile/tamagui.config.ts EXACTLY the
// way @tamagui/babel-plugin does at build time: @tamagui/static's
// registerRequire() + a plain Node require(), which has NO `.native.ts`
// resolution. Jest cannot reproduce this in-process (its resolver already maps
// `./fonts` to `fonts.native`), so native-font-config.test.ts runs this file in
// a child Node process and compares the printed config with the runtime one.
//
// Usage: node load-compiler-config.cjs <apps/mobile root>
const path = require("node:path");

const MARKER = "__PEKULO_TAMAGUI_COMPILER_CONFIG__";

const mobileRoot = process.argv[2];
const babelPlugin = require.resolve("@tamagui/babel-plugin", { paths: [mobileRoot] });
const staticDir = path.dirname(
  require.resolve("@tamagui/static/package.json", { paths: [babelPlugin] }),
);
const { registerRequire } = require(path.join(staticDir, "dist/registerRequire.cjs"));

const { unregister } = registerRequire("native");
let exported;
try {
  exported = require(path.join(mobileRoot, "tamagui.config.ts"));
} finally {
  unregister();
}
const config = exported.default || exported.config || exported;
// Marker-prefixed: registerRequire's unregister() may log to stdout first.
process.stdout.write(
  `\n${MARKER}${JSON.stringify({
    fontsParsed: config.fontsParsed,
    defaultProps: config.defaultProps ?? {},
    tokensParsed: config.tokensParsed,
    themes: config.themes,
  })}\n`,
);
