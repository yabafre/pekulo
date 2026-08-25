// packages/ui/src/ds-coverage.meta.test.ts
// Class-killer meta-test (story 10-1). The DS contract at
// architecture.md:631 is "1 visual snapshot + 1 vitest-axe a11y spec per
// public component". Nothing enforced it, so coverage silently drifted to
// 69 % across epics 1-9. This test enumerates the real filesystem and fails
// naming any public component/primitive missing either sibling file.
//
// Same shape as apps/api's ID_PREFIXES meta-test (lesson 2026-06-05): a
// cheap enumeration that kills the whole class of "someone forgot" bugs.
//
// The `it` titles deliberately contain "snapshot" and "a11y" so the
// filtered scripts (`test:visual` --testNamePattern='snapshot',
// `test:axe` --testNamePattern='a11y') each verify their own
// exhaustiveness, not just the specs that happen to exist.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = dirname(fileURLToPath(import.meta.url));
const COMPONENTS_DIR = join(SRC, "components");
const PRIMITIVES_DIR = join(SRC, "primitives");
const BARREL = join(SRC, "index.ts");

/**
 * Components/primitives exempt from a given suite, with the reason.
 * An entry here is a documented, reviewed decision, never a convenience.
 * Adding one requires the reason to survive aped-review.
 */
const SNAPSHOT_EXEMPT: Record<string, string> = {
  PekuloRootProvider:
    "Mounts @tamagui/next-theme, which imports next/script — a peer that only " +
    "exists in apps/web. It cannot mount in this package's test harness; " +
    "test/setup.tsx:44 documents the same constraint and wraps TamaguiProvider " +
    "directly for exactly this reason. Covered at the app level instead.",
};
const A11Y_EXEMPT: Record<string, string> = {
  PekuloRootProvider: "Same as SNAPSHOT_EXEMPT — cannot mount in this harness.",
};

/**
 * Modules re-exported from `src/index.ts` that carry no rendered surface,
 * with the reason. Anything NOT listed here and not `components`/`primitives`
 * must ship snapshot + a11y coverage for every component it exports.
 */
const MODULE_EXEMPT: Record<string, string> = {
  animations: "Hooks only (use-count-up, use-stagger). Covered by their own unit tests.",
  themes: "Tamagui theme maps — plain data, nothing renders.",
  tokens: "Raw design tokens — plain data, nothing renders.",
};

/** Every `src/components/<Name>/` directory (one component per folder, R11). */
function componentEntries(): Array<{ name: string; dir: string }> {
  return readdirSync(COMPONENTS_DIR)
    .filter((entry) => statSync(join(COMPONENTS_DIR, entry)).isDirectory())
    .sort()
    .map((name) => ({ name, dir: join(COMPONENTS_DIR, name) }));
}

/** Every `src/primitives/<Name>.tsx` source file (flat layout, not R11). */
function primitiveEntries(): Array<{ name: string; dir: string }> {
  return readdirSync(PRIMITIVES_DIR)
    .filter((entry) => entry.endsWith(".tsx") && !entry.includes(".test."))
    .map((entry) => entry.replace(/\.tsx$/, ""))
    .sort()
    .map((name) => ({ name, dir: PRIMITIVES_DIR }));
}

/**
 * Every `export * from "./x"` in the public barrel. This is the real public
 * surface — `components/` and `primitives/` are only two of its entries.
 */
function barrelModules(): string[] {
  return [...readFileSync(BARREL, "utf8").matchAll(/export \* from "\.\/([\w-]+)"/g)]
    .map((m) => m[1])
    .sort();
}

/**
 * React components a free-standing module exports.
 *
 * Reads every non-test source file in the module folder, not just its index:
 * a module's index commonly does `export * from "./Thing"`, so a component
 * declared in a sibling file is just as public as one declared inline. An
 * index-only scan misses those — verified with a probe at aped-review, which
 * stayed green until this walked the whole folder.
 */
function moduleComponents(module: string): string[] {
  const dir = join(SRC, module);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."))
    .flatMap((f) => [...readFileSync(join(dir, f), "utf8").matchAll(/export function ([A-Z]\w*)/g)])
    .map((m) => m[1])
    .sort();
}

/**
 * Components of `components/`- and `primitives/`-style modules are covered by a
 * `<Name>.<suffix>` sibling. Free-standing modules (toast/, provider/, …) name
 * their specs after the module, not the component, so coverage is "some spec in
 * this folder renders this component".
 */
function moduleSpecMentions(module: string, suffix: string): string {
  const dir = join(SRC, module);
  if (!existsSync(dir)) return "";
  return readdirSync(dir)
    .filter((f) => f.endsWith(suffix))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
}

/** Free-standing-module components with no spec rendering them. */
function missingModuleEntries(suffix: string, exempt: Record<string, string>): string[] {
  return barrelModules()
    .filter((m) => m !== "components" && m !== "primitives" && !(m in MODULE_EXEMPT))
    .flatMap((m) => {
      const covered = moduleSpecMentions(m, suffix);
      return moduleComponents(m)
        .filter((name) => !(name in exempt))
        .filter((name) => !covered.includes(name));
    })
    .sort();
}

function missing(
  entries: Array<{ name: string; dir: string }>,
  suffix: string,
  exempt: Record<string, string>,
): string[] {
  return entries
    .filter(({ name }) => !(name in exempt))
    .filter(({ name, dir }) => !existsSync(join(dir, `${name}.${suffix}`)))
    .map(({ name }) => name);
}

describe("design-system test coverage (architecture.md:631)", () => {
  // AC-1 (verbatim from story 10-1-visual-snapshot-suite:44):
  //   Given every component and primitive that `@pekulo/ui` exports publicly,
  //   When the package's visual-test script runs, Then each one is covered by
  //   at least one snapshot of its default state, and the run reports zero
  //   uncovered and exits 0.
  // AC-3 (verbatim from story 10-1-visual-snapshot-suite:46):
  //   Given a newly-exported component or primitive shipped without its
  //   snapshot spec, When the test suite runs, Then the suite fails and the
  //   failure message names the uncovered component.
  it("every public component and primitive has a snapshot spec", () => {
    const gaps = [
      ...missing(componentEntries(), "snapshot.test.tsx", SNAPSHOT_EXEMPT),
      ...missing(primitiveEntries(), "snapshot.test.tsx", SNAPSHOT_EXEMPT),
      ...missingModuleEntries("snapshot.test.tsx", SNAPSHOT_EXEMPT),
    ];
    expect(gaps, `missing snapshot coverage for: ${gaps.join(", ")}`).toEqual([]);
  });

  // AC-5 (verbatim from story 10-1-visual-snapshot-suite:48, as widened by the
  // 2026-08-25 scope amendment):
  //   Given every publicly-exported component and primitive still lacking one
  //   (`CategoryIcon`, `PekuloMobileBottomNav`, `PekuloCalendar`,
  //   `PekuloDatePicker`, `PekuloDialogCloseX`, `PekuloDrawer`,
  //   `PekuloNativeCheckbox`, `PekuloNativeSelect`, `PekuloTextarea`), When the
  //   package's a11y script runs, Then each is covered by an a11y spec
  //   reporting zero `serious` and zero `critical` axe violations.
  // This assertion covers the "is covered by an a11y spec" half; the
  // zero-violations half lives in each `<Name>.a11y.test.tsx`.
  it("every public component and primitive has an a11y spec", () => {
    const gaps = [
      ...missing(componentEntries(), "a11y.test.tsx", A11Y_EXEMPT),
      ...missing(primitiveEntries(), "a11y.test.tsx", A11Y_EXEMPT),
      ...missingModuleEntries("a11y.test.tsx", A11Y_EXEMPT),
    ];
    expect(gaps, `missing a11y coverage for: ${gaps.join(", ")}`).toEqual([]);
  });

  // Added at aped-review. The two assertions above enumerate `components/` and
  // `primitives/`, but `src/index.ts` also re-exports `toast/`, `provider/` and
  // `animations/` — PekuloToastViewport shipped publicly with no spec at all
  // and nothing said a word. A gate that hard-codes the folders it knows about
  // reproduces, one level up, the drift this file exists to kill. Enumerating
  // the barrel means a NEW `export * from "./x"` fails here until it is either
  // covered or given a reason in MODULE_EXEMPT.
  it("every module in the public barrel is covered or exempt (snapshot + a11y)", () => {
    const unaccounted = barrelModules().filter(
      (m) =>
        m !== "components" &&
        m !== "primitives" &&
        !(m in MODULE_EXEMPT) &&
        moduleComponents(m).some((name) => !(name in SNAPSHOT_EXEMPT)) &&
        moduleSpecMentions(m, "snapshot.test.tsx") === "",
    );
    expect(
      unaccounted,
      `barrel modules exporting components with no snapshot spec: ${unaccounted.join(", ")}`,
    ).toEqual([]);
  });

  // Added at aped-review. `test:visual` and `test:axe` select by
  // --testNamePattern, so a correctly-named file whose titles omit the keyword
  // satisfies the assertions above while being invisible to its own gate.
  it("every spec file carries its keyword in a test title (snapshot / a11y)", () => {
    const invisible: string[] = [];
    for (const [suffix, keyword] of [
      ["snapshot.test.tsx", "snapshot"],
      ["a11y.test.tsx", "a11y"],
    ] as const) {
      const dirs = [
        ...new Set([COMPONENTS_DIR, PRIMITIVES_DIR, ...barrelModules().map((m) => join(SRC, m))]),
      ];
      for (const dir of dirs) {
        if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
        for (const entry of readdirSync(dir)) {
          const nested = join(dir, entry);
          const files = statSync(nested).isDirectory()
            ? readdirSync(nested).map((f) => join(nested, f))
            : [nested];
          for (const file of files.filter((f) => f.endsWith(suffix))) {
            if (!readFileSync(file, "utf8").includes(keyword)) invisible.push(file);
          }
        }
      }
    }
    expect(
      invisible,
      `spec files invisible to their own filtered gate: ${invisible.join(", ")}`,
    ).toEqual([]);
  });

  // Added at aped-review. Every assertion above is "the gaps list is empty",
  // which is also what an enumeration returning NOTHING produces. A renamed or
  // relocated folder would turn this file silently green — the exact failure
  // mode it was written to prevent. The floors are deliberately well below the
  // real counts (42 components, 33 primitives at the time of writing); they
  // catch collapse, not growth.
  it("the enumeration actually found the design system", () => {
    expect(componentEntries().length).toBeGreaterThan(30);
    expect(primitiveEntries().length).toBeGreaterThan(25);
    expect(barrelModules()).toContain("components");
    expect(barrelModules()).toContain("primitives");
  });
});
