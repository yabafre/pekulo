// apps/mobile/jest/tamagui-babel-transformer.js
// Story 10-8 review — babel-jest wrapper whose cache key also covers the
// Tamagui compiler config. @tamagui/babel-plugin bakes config values (font
// faces, the Text default, tokens, themes) into every flattened style, but
// babel-jest's key only hashes the source file + babel options, so a warm cache
// kept serving output compiled against an OLD config — a regression of the
// compiler config stayed green locally until `--no-cache`. Hashing the inputs
// the compiler reads makes any config edit invalidate the cache.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MOBILE_ROOT = path.join(__dirname, "..");
const UI_SRC = path.join(MOBILE_ROOT, "../../packages/ui/src");
// Everything apps/mobile/tamagui.config.ts transitively loads.
const CONFIG_INPUTS = [
  path.join(MOBILE_ROOT, "tamagui.config.ts"),
  path.join(UI_SRC, "config"),
  path.join(UI_SRC, "tokens"),
  path.join(UI_SRC, "themes"),
];

function listFiles(entry) {
  const stat = fs.statSync(entry);
  if (stat.isFile()) return [entry];
  return fs
    .readdirSync(entry)
    .sort()
    .flatMap((name) => listFiles(path.join(entry, name)))
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file) && !/\.test\.[jt]sx?$/.test(file));
}

function hashConfigInputs() {
  const hash = crypto.createHash("sha1");
  for (const file of CONFIG_INPUTS.flatMap(listFiles)) {
    hash.update(path.relative(MOBILE_ROOT, file));
    hash.update(fs.readFileSync(file));
  }
  return hash.digest("hex");
}

/** Jest transformer factory: `[thisFile, { babelJestPath, babelOptions }]`. */
function createTransformer({ babelJestPath, babelOptions }) {
  const babelJest = require(babelJestPath);
  const inner = (babelJest.default ?? babelJest).createTransformer(babelOptions);
  const configHash = hashConfigInputs();
  return {
    ...inner,
    getCacheKey: (...args) => `${inner.getCacheKey(...args)}:${configHash}`,
    getCacheKeyAsync: async (...args) => `${await inner.getCacheKeyAsync(...args)}:${configHash}`,
  };
}

module.exports = { createTransformer, hashConfigInputs };
