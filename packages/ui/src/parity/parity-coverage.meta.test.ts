// packages/ui/src/parity/parity-coverage.meta.test.ts
// Story 10-5 class-killer meta-test (lesson 2026-06-05): enumerate the real
// components folder and fail naming any component the parity catalog misses,
// so a new component cannot ship without web ↔ native parity coverage.
//
// AC-1 (verbatim from story 10-5-mobile-parity-and-maestro:16):
//   Given a parity catalog published by the design-system package through a
//   dedicated `@pekulo/ui/parity` entry point (kept out of the public component
//   barrels), When the design-system test suite runs, Then it fails unless every
//   design-system component is covered by at least one catalog case (or carries a
//   documented exemption), every case id is unique and of the form
//   `<Component>.<variant>`, every case refers to an existing component, and
//   every covered component has exactly one case designated as its screenshot
//   golden.
import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PARITY_CASES, PARITY_EXEMPT_COMPONENTS } from "./cases";

const COMPONENTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "components");

const componentNames = readdirSync(COMPONENTS_DIR)
  .filter((entry) => statSync(join(COMPONENTS_DIR, entry)).isDirectory())
  .sort();

describe("parity catalog coverage (story 10-5)", () => {
  it("covers every src/components/<Name> folder with a case or a documented exemption", () => {
    const covered = new Set(PARITY_CASES.map((c) => c.component));
    const missing = componentNames.filter(
      (name) => !covered.has(name) && !(name in PARITY_EXEMPT_COMPONENTS),
    );
    expect(missing).toEqual([]);
  });

  it("only references real component folders", () => {
    const referenced = [
      ...new Set([
        ...PARITY_CASES.map((c) => c.component),
        ...Object.keys(PARITY_EXEMPT_COMPONENTS),
      ]),
    ];
    expect(referenced.filter((name) => !componentNames.includes(name))).toEqual([]);
  });

  it("uses unique deep-link-safe ids of the form <Component>.<variant>", () => {
    const ids = PARITY_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const parityCase of PARITY_CASES) {
      expect(parityCase.id).toMatch(new RegExp(`^${parityCase.component}\\.[A-Za-z0-9]+$`));
    }
  });

  it("marks exactly one golden case per covered component", () => {
    const goldens = new Map<string, number>();
    for (const parityCase of PARITY_CASES) {
      if (parityCase.golden) {
        goldens.set(parityCase.component, (goldens.get(parityCase.component) ?? 0) + 1);
      }
    }
    const covered = [...new Set(PARITY_CASES.map((c) => c.component))];
    expect(covered.filter((name) => goldens.get(name) !== 1)).toEqual([]);
  });

  it("gives every exemption a non-empty reason", () => {
    for (const [name, reason] of Object.entries(PARITY_EXEMPT_COMPONENTS)) {
      expect(`${name}: ${reason.trim()}`).not.toBe(`${name}: `);
    }
  });
});
