// fix-tamagui-css.mjs — post-process @tamagui/cli's generated CSS (story 8-2).
//
// Two jobs:
//   (1) Legacy fix (pre-8-2): the CLI emits theme/token blocks whose first
//       selector is dropped to empty (`     {` / `, .tm_…`). Restore `:root`
//       so the default theme + tokens apply at the document root.
//   (2) Two-custom-theme rescue: @tamagui/cli rc.42 STILL hashes BOTH custom
//       themes (pekulo-dark, pekulo-light) onto the SAME `.tm_xxt` class (the
//       rc.41 selector-emission bug persists). Both blocks therefore collapse
//       to `:root, .tm_xxt {…}` and the second wins the cascade — light would
//       render for everyone and dark/light could never be told apart. We
//       re-key the two blocks by the `data-theme` attribute that
//       NextThemeProvider (attribute="data-theme") + the layout anti-FOUC
//       script both write:
//         block 1 (pekulo-dark, declared first) → [data-theme="pekulo-dark"], :root, .tm_xxt
//         block 2 (pekulo-light)               → [data-theme="pekulo-light"]
//       Keeping :root on dark makes it the no-attribute default; the light
//       block, later in source with equal specificity, wins only when
//       data-theme="pekulo-light" is set.
//   (3) Drop the @media(prefers-color-scheme:light) blocks: with both themes
//       colliding they fight the explicit data-theme selectors on specificity
//       ties. `system` is resolved to a concrete data-theme by the synchronous
//       anti-FOUC head script before first paint, so the media query is
//       redundant and only introduces ambiguity.
//
// Fails loudly (throws) if the expected two theme blocks aren't found — a
// future CLI format change must not silently ship un-rekeyed (broken) CSS.
import { readFileSync, writeFileSync } from "node:fs";

const path = "public/tamagui.generated.css";
let css = readFileSync(path, "utf8");

// (1) Legacy selector restoration.
css = css.replace(/^ {5}\{/gm, ":root {").replace(/^, \.tm_/gm, ":root, .tm_");

// (2) Re-key the two colliding theme blocks by declaration order.
let count = 0;
css = css.replace(/:root, \.tm_xxt \{/g, () => {
  count += 1;
  return count === 1
    ? '[data-theme="pekulo-dark"], :root, .tm_xxt {'
    : '[data-theme="pekulo-light"] {';
});
if (count !== 2) {
  throw new Error(
    `[fix-tamagui-css] expected 2 ':root, .tm_xxt {' theme blocks, found ${count}. ` +
      `The @tamagui/cli output format changed — re-derive the re-key step before trusting the theme CSS.`,
  );
}

// (3) Drop the prefers-color-scheme media blocks (data-theme is always set).
css = css.replace(/@media\(prefers-color-scheme:light\)\s*\{[\s\S]*?\n\s*\}/g, "");

writeFileSync(path, css);
console.log("[fix-tamagui-css] re-keyed 2 theme blocks to [data-theme] + dropped media blocks");
