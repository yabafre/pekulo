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
import { readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = dirname(fileURLToPath(import.meta.url));
const COMPONENTS_DIR = join(SRC, "components");
const PRIMITIVES_DIR = join(SRC, "primitives");

/**
 * Components/primitives exempt from a given suite, with the reason.
 * Empty by design — an entry here is a documented, reviewed decision,
 * never a convenience. Adding one requires the reason to survive
 * aped-review.
 */
const SNAPSHOT_EXEMPT: Record<string, string> = {};
const A11Y_EXEMPT: Record<string, string> = {};

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
  it("every public component and primitive has a snapshot spec", () => {
    const gaps = [
      ...missing(componentEntries(), "snapshot.test.tsx", SNAPSHOT_EXEMPT),
      ...missing(primitiveEntries(), "snapshot.test.tsx", SNAPSHOT_EXEMPT),
    ];
    expect(gaps, `missing <name>.snapshot.test.tsx for: ${gaps.join(", ")}`).toEqual([]);
  });

  it("every public component and primitive has an a11y spec", () => {
    const gaps = [
      ...missing(componentEntries(), "a11y.test.tsx", A11Y_EXEMPT),
      ...missing(primitiveEntries(), "a11y.test.tsx", A11Y_EXEMPT),
    ];
    expect(gaps, `missing <name>.a11y.test.tsx for: ${gaps.join(", ")}`).toEqual([]);
  });
});
