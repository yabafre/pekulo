// apps/mobile/__tests__/native-surface-guards.test.ts
// Story 10-6 AC-5 / AC-2 — class-killer meta-tests over the mobile sources
// (lesson 2026-06-05, second half: enumerate the source of truth and assert):
//   1. every `<SymbolView … />` declares an Android Material Symbol
//      (`name={{ ios: "…", android: "…" }}`), so no icon renders blank on Android;
//   2. `Stack.Toolbar` (throws on Android without `@expo/ui`) only appears in the
//      three files whose Android branch is covered by __tests__/android/*.test.tsx.
//      A new usage fails here until it gets an Android branch AND an Android test.
//
// AC-5 (verbatim from story 10-6-android-parity-and-maestro):
//   Given any system symbol icon in the mobile app, When it renders on Android,
//   Then it shows a Material Symbol, never a blank or text fallback; And the
//   mobile test suite fails when a new symbol icon has no Android name; And the
//   Android tab bar shows all five labels on a grayscale Pekulo bar.
const fs = require("node:fs") as {
  readdirSync: (dir: string) => string[];
  readFileSync: (filePath: string, encoding: "utf8") => string;
  statSync: (filePath: string) => { isDirectory: () => boolean };
};
const path = require("node:path") as {
  dirname: (filePath: string) => string;
  join: (...segments: string[]) => string;
  relative: (from: string, to: string) => string;
};

const resolveModule = (require as unknown as { resolve: (id: string) => string }).resolve;
const MOBILE_ROOT = path.dirname(resolveModule("../package.json"));
const SOURCE_DIRS = ["app", "components", "lib"];
const STACK_TOOLBAR_FILES = [
  "app/parametres.tsx",
  "components/form/sheet.tsx",
  "components/tab-stack-layout.tsx",
];

function listSources(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) return listSources(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

const SOURCES = SOURCE_DIRS.flatMap((dir) => listSources(path.join(MOBILE_ROOT, dir))).map(
  (file) => ({ file: path.relative(MOBILE_ROOT, file), text: fs.readFileSync(file, "utf8") }),
);

/** Every `<SymbolView … />` element as raw source text (`name` is always its first prop). */
function symbolViewElements(text: string): string[] {
  return text.match(/<SymbolView\b[\s\S]*?\/>/g) ?? [];
}

describe("native surface guards (story 10-6)", () => {
  it("scans the mobile sources", () => {
    expect(SOURCES.length).toBeGreaterThan(20);
    expect(SOURCES.flatMap(({ text }) => symbolViewElements(text)).length).toBeGreaterThanOrEqual(
      6,
    );
  });

  it("gives every SymbolView an Android Material Symbol name (AC-5)", () => {
    const missing = SOURCES.flatMap(({ file, text }) =>
      symbolViewElements(text)
        .filter((element) => !/\bandroid:\s*"/.test(element))
        .map(() => file),
    );
    expect(missing).toEqual([]);
  });

  it("keeps <Stack.Toolbar> inside the Android-tested files only (AC-2)", () => {
    // JSX usage only — comments that merely mention Stack.Toolbar are fine.
    const users = SOURCES.filter(({ text }) => text.includes("<Stack.Toolbar"))
      .map(({ file }) => file)
      .sort();
    expect(users).toEqual(STACK_TOOLBAR_FILES);
  });
});
