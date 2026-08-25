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
    ];
    expect(gaps, `missing <name>.snapshot.test.tsx for: ${gaps.join(", ")}`).toEqual([]);
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
    ];
    expect(gaps, `missing <name>.a11y.test.tsx for: ${gaps.join(", ")}`).toEqual([]);
  });
});
