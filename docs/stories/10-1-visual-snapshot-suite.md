# Story: 10-1-visual-snapshot-suite — Close the `@pekulo/ui` snapshot coverage and lock the anti-regression gate

**Epic:** Epic 10 — Design system parity (V1.5)
**Status:** review
**Ticket:** #46
**Branch:** feature/46-10-1-visual-snapshot-suite
**Complexity:** M
**Covered FRs:** FR-55, FR-56 (web side) · **Binds:** V1 DoD §2 (locks the web visual baseline the V1.5 mobile port diffs against — gate G1)

**Reality check — this story is NOT greenfield.** The epic text ("Add `<comp>.snapshot.test.tsx` for every Pekulo\* component") reads as if no suite exists. It does: **52 snapshot files already ship** (38 components + 14 primitives), all on the same `renderWithTamagui` + `toMatchInlineSnapshot` shape. The measured gap is **23 missing snapshots** and **2 missing a11y specs**, plus one structural hole that matters more than the 23: **nothing fails when a new component ships without a snapshot.** That is how the suite drifted from "every component" to 69 % coverage across epics 1–9 without a single red CI run.

So the story ships **three** things, in this order:

| # | What | Why it is in scope |
|---|---|---|
| 1 | A **meta-test** that enumerates every public component/primitive and fails naming the ones missing a snapshot or an a11y spec | The gate. Without it, this story is a one-shot that re-degrades on the next UI story — exactly the mechanism that produced the 23. Same shape as the `ID_PREFIXES` class-killer meta-test (lesson 2026-06-05). |
| 2 | The **23 missing snapshot files** + the **2 missing a11y files** | Turns the meta-test from RED to GREEN. Completes the contract at `architecture.md:631` — "1 visual snapshot + 1 vitest-axe a11y spec per public component". |
| 3 | A **reproducible proof** that `pekulo/no-tailwind-outside-ui` is live in production lint | AC-2. Lesson 2026-06-15: a self-gating custom oxlint rule can be silently inert for months while lint stays green — `no-server-action-in-component` was. Rule activity is proven with a deliberately-violating probe, never inferred. |

**Measured state at write time (2026-08-16), not assumed:**

| Fact | Measurement |
|---|---|
| Snapshot files present | 52 (`find src -name '*.snapshot.test.tsx'`) |
| Snapshot files missing | 23 — 4 components + 19 primitives (enumerated in Dev Notes) |
| a11y files present / missing | ~~66 present · 2 missing (`CategoryIcon`, `PekuloMobileBottomNav`)~~ **Superseded 2026-08-25 (aped-dev):** 66 present · **9 missing**. 42 components + 33 primitives = 75 public entities; 75 − 66 = 9. The write-time count only walked `src/components/`, so the 7 uncovered primitives were invisible. |
| Does CI run the suite? | Yes — `test-unit` job → `bun --filter='*' run test` → `@pekulo/ui` `vitest run` |
| Is `no-tailwind-outside-ui` live? | **Yes, verified.** Probe `className="flex p-4 text-sm"` in `apps/web/src/` → `pekulo(no-tailwind-outside-ui): Tailwind utility classes are forbidden outside @pekulo/ui (FR-55)`, 1 error. Identical probe in `packages/ui/src/` → 0 errors (the `uiRoot` exemption is correct). Both probes removed. |
| Anti-regression gate | **None.** A component added without a snapshot passes CI today. |

> **Scope amendment — 2026-08-25, `aped-dev` step-03, user-approved.** The a11y gap is **9**, not 2. T1's meta-test enumerates components *and* primitives for both suites, so its a11y assertion goes RED with 9 names; T13 then requires it GREEN. With only 2 specs written, T13 is unreachable as originally specified. The three ways out were: write the 9 specs, narrow the a11y gate to `src/components/` only, or park the 7 primitives in `A11Y_EXEMPT`. Narrowing the gate would leave all 33 publicly-exported primitives ungated — the exact drift mechanism this story exists to kill — and seven exemptions at once is the "convenience" the exempt map forbids by construction. **Decision: write all 9.** T11 is widened below; the total deliverable moves from 25 new files to **32** (1 meta-test + 23 snapshots + 9 a11y). No component source is touched, so the "tests only" framing in the header still holds.


**Out of scope — deliberate, do not absorb (lesson 2026-06-05):**

- ~~**No component source changes.** This story writes tests only. If a snapshot exposes a rendering bug, record it in the Dev Agent Record and raise it at `aped-review` — do not fix it here, the diff must stay reviewable as "tests only".~~ **Superseded 2026-08-25 (`aped-review`), user-approved.** The scope rule worked exactly as designed through `aped-dev`: the dev wrote zero source changes and routed what the snapshots exposed to review. At review the user elected to fix every finding rather than defer, so **six component sources are now touched** (`PekuloInput`, `PekuloTextarea`, `PekuloNativeSelect`, `PekuloCalendar`, `PekuloDatePicker`, `PekuloEmpty`) plus one new non-component helper (`form-focus-ring.ts`). Two of those were freezing accessibility violations into the baseline — a focus ring stripped with no replacement (NFR-24) and an `en-US` Sunday-first calendar in a French app (NFR-22) — which is the one class of finding it is actively harmful to defer: the whole point of this story is that the baseline becomes the reference the V1.5 mobile port diffs against. Every affected snapshot was re-captured. See the Review Record at the bottom of this file.
- **No Maestro / mobile snapshot suite.** That is story `10-2-mobile-app-bootstrap`, gated on G1 (a V1.5 `aped-arch` re-run). FR-56's mobile half does not ship here.
- **No lint-infra hardening.** The `oxlint-smoke` integration test runs against `fixture-oxlintrc.json`, not the production `.oxlintrc.json`. Widening it to the production config is a dedicated lint-infra task (the 2026-06-15 lesson says so explicitly); AC-2 is satisfied by a documented, reproducible probe instead.
- **No `__snapshots__/` file-based snapshots.** The repo is 52/52 inline (`toMatchInlineSnapshot`). Follow the established pattern; do not introduce a second one.

## User Story

**As a** Pekulo developer, **I want** every publicly-exported `@pekulo/ui` component and primitive covered by a snapshot test **and a CI gate that fails when a new one ships without it**, **so that** the web visual baseline is complete and *stays* complete — it is the frozen reference the V1.5 mobile port diffs against.

## Acceptance Criteria

- **AC-1** — **Given** every component and primitive that `@pekulo/ui` exports publicly, **When** the package's visual-test script runs, **Then** each one is covered by at least one snapshot of its default state, and the run reports zero uncovered and exits 0.
- **AC-2** — **Given** a Tailwind utility class used outside the design-system package, **When** the repo-wide lint runs, **Then** it is reported as an error and CI fails; **And** the same class used inside the design-system package is reported zero times, so the package's own styling surface stays unaffected; **And** the evidence that both halves hold is recorded in this story, so the rule's activity is never inferred from a green lint.
- **AC-3** — **Given** a newly-exported component or primitive shipped without its snapshot spec, **When** the test suite runs, **Then** the suite fails and the failure message names the uncovered component.
- **AC-4** — **Given** the calendar and date-picker primitives, whose underlying library renders the *current* month when none is supplied, **When** their snapshots run on any calendar date, **Then** they pass — the rendered month is fixed by the caller, never read from the system clock.
- **AC-5** — **Given** every publicly-exported component and primitive still lacking one (`CategoryIcon`, `PekuloMobileBottomNav`, `PekuloCalendar`, `PekuloDatePicker`, `PekuloDialogCloseX`, `PekuloDrawer`, `PekuloNativeCheckbox`, `PekuloNativeSelect`, `PekuloTextarea`), **When** the package's a11y script runs, **Then** each is covered by an a11y spec reporting zero `serious` and zero `critical` axe violations. _(Widened 2026-08-25 from the two components named at write time — see the scope amendment above.)_

## Tasks

Task order is load-bearing: **T1 first**, because it is the RED that every subsequent task turns green one slice at a time. Do not reorder.

- [x] **T1 — Write the coverage meta-test (RED: it must fail listing 25 gaps)** [AC: AC-3]

  Create `packages/ui/src/ds-coverage.meta.test.ts` with exactly this content:

  ```ts
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
  ```

  Run: `cd packages/ui && bunx vitest run src/ds-coverage.meta.test.ts`
  Expected: **RED — 2 tests failed.** The snapshot failure message must enumerate 23 names (`CategoryIcon, CategoryPicker, PekuloMobileBottomNav, PekuloPagination, PekuloBreadcrumb, PekuloButton, PekuloButtonGroup, PekuloCalendar, PekuloCard, PekuloDatePicker, PekuloDialogCloseX, PekuloDrawer, PekuloEmpty, PekuloField, PekuloInput, PekuloLabel, PekuloLoadingItem, PekuloNativeCheckbox, PekuloNativeSelect, PekuloResizable, PekuloSpinner, PekuloSubmitButton, PekuloTextarea`) and the a11y failure message must enumerate at least `CategoryIcon, PekuloMobileBottomNav`. **If either list is empty or the count differs from 23, STOP** — the enumeration logic is wrong, not the codebase; fix the test before writing a single snapshot.
  Commit: `git add packages/ui/src/ds-coverage.meta.test.ts && git commit -m "test(#46): add DS coverage meta-test (RED — 23 snapshot + 2 a11y gaps)"`

- [x] **T2 — Snapshot the two display components: `CategoryIcon`, `PekuloPagination`** [AC: AC-1]

  **The inline-snapshot workflow, applied to every task from here to T10 — read once, apply every time:**
  1. Write the file with `toMatchInlineSnapshot()` called with **no argument**.
  2. Run the test with `-u`. Vitest writes the rendered string into the file for you.
  3. Re-run **without** `-u`. It must pass.
  4. `git diff` the file and confirm the captured string is non-empty and contains Tamagui atomic classes (`is_View`, `is_Text`, `_dsp_contents`). A snapshot that captured only `"<span class=\"_dsp_contents  font_body\"><div style=\"display: contents;\"></div></span>"` means the component rendered into a **portal** — that is legitimate for portal primitives (`PekuloDialog`'s existing snapshot is exactly that) but is a red flag for any non-portal component: re-check the props.

  **NEVER hand-write the snapshot string.** It encodes Tamagui's generated atomic classes; an invented one is wrong by construction.

  Create `packages/ui/src/components/CategoryIcon/CategoryIcon.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../../test/setup.tsx";
  import { CategoryIcon } from "./CategoryIcon";

  describe("CategoryIcon snapshot", () => {
    it("renders a known category", () => {
      const { container } = renderWithTamagui(<CategoryIcon category="courses" />);
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders the fallback for an unknown category", () => {
      const { container } = renderWithTamagui(<CategoryIcon category="not-a-category" />);
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Create `packages/ui/src/components/PekuloPagination/PekuloPagination.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui } from "../../../test/setup.tsx";
  import { PekuloPagination } from "./PekuloPagination";

  describe("PekuloPagination snapshot", () => {
    it("renders a mid-range page with both neighbours", () => {
      const { container } = renderWithTamagui(
        <PekuloPagination page={3} pageCount={7} onPageChange={vi.fn()} />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders a single page (no gaps, both arrows dimmed)", () => {
      const { container } = renderWithTamagui(
        <PekuloPagination page={1} pageCount={1} onPageChange={vi.fn()} />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Run: `cd packages/ui && bunx vitest run src/components/CategoryIcon src/components/PekuloPagination -u` then `cd packages/ui && bunx vitest run src/components/CategoryIcon src/components/PekuloPagination`
  Expected: first run `Snapshots  4 written`; second run `Test Files  2 passed`, `Tests  4 passed`, exit 0.
  Commit: `git add packages/ui/src/components/CategoryIcon/CategoryIcon.snapshot.test.tsx packages/ui/src/components/PekuloPagination/PekuloPagination.snapshot.test.tsx && git commit -m "test(#46): snapshot CategoryIcon + PekuloPagination"`

- [x] **T3 — Snapshot the two interactive components: `CategoryPicker`, `PekuloMobileBottomNav`** [AC: AC-1]

  Create `packages/ui/src/components/CategoryPicker/CategoryPicker.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui } from "../../../test/setup.tsx";
  import { CategoryPicker, type CategoryOption } from "./CategoryPicker";

  const OPTIONS: ReadonlyArray<CategoryOption> = [
    { value: "courses", label: "Courses" },
    { value: "transport", label: "Transport" },
    { value: "restauration", label: "Restauration" },
  ];

  describe("CategoryPicker snapshot", () => {
    it("renders closed with the selected value", () => {
      const { container } = renderWithTamagui(
        <CategoryPicker value="courses" onValueChange={vi.fn()} options={OPTIONS} />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Create `packages/ui/src/components/PekuloMobileBottomNav/PekuloMobileBottomNav.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui } from "../../../test/setup.tsx";
  import { PekuloMobileBottomNav } from "./PekuloMobileBottomNav";

  describe("PekuloMobileBottomNav snapshot", () => {
    it("renders the five nav items with cap active", () => {
      const { container } = renderWithTamagui(
        <PekuloMobileBottomNav activeKey="cap" onSelect={vi.fn()} />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders with portfolio active", () => {
      const { container } = renderWithTamagui(
        <PekuloMobileBottomNav activeKey="portfolio" onSelect={vi.fn()} />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  After `-u`, **read the captured `PekuloMobileBottomNav` strings**: they must contain `grid-template-columns: repeat(5, 1fr)` (lesson 2026-05-17 — the five equal cells are CSS Grid, not flex; flex rounds unevenly and truncates the 12-char labels). If they show `flexDirection: row` instead, a regression landed in the component — record it in the Dev Agent Record, do **not** fix it here.

  Run: `cd packages/ui && bunx vitest run src/components/CategoryPicker src/components/PekuloMobileBottomNav -u` then the same command without `-u`
  Expected: first run `Snapshots  3 written`; second run `Test Files  2 passed`, `Tests  3 passed`, exit 0.
  Commit: `git add packages/ui/src/components/CategoryPicker/CategoryPicker.snapshot.test.tsx packages/ui/src/components/PekuloMobileBottomNav/PekuloMobileBottomNav.snapshot.test.tsx && git commit -m "test(#46): snapshot CategoryPicker + PekuloMobileBottomNav"`

- [x] **T4 — Snapshot the form input primitives: `PekuloInput`, `PekuloTextarea`, `PekuloLabel`** [AC: AC-1]

  Primitives live flat in `src/primitives/`, so the setup import is **`../../test/setup.tsx`** (two levels), not three. Getting this wrong is the single most likely failure in T4–T10.

  Create `packages/ui/src/primitives/PekuloInput.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import { PekuloInput } from "./PekuloInput";

  describe("PekuloInput snapshot", () => {
    it("renders default", () => {
      const { container } = renderWithTamagui(
        <PekuloInput aria-label="Libellé" placeholder="Courses Carrefour" />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders invalid", () => {
      const { container } = renderWithTamagui(
        <PekuloInput aria-label="Libellé" placeholder="Courses Carrefour" invalid />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Create `packages/ui/src/primitives/PekuloTextarea.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import { PekuloTextarea } from "./PekuloTextarea";

  describe("PekuloTextarea snapshot", () => {
    it("renders default", () => {
      const { container } = renderWithTamagui(
        <PekuloTextarea aria-label="Notes" placeholder="Note interne" rows={3} />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders invalid", () => {
      const { container } = renderWithTamagui(
        <PekuloTextarea aria-label="Notes" placeholder="Note interne" rows={3} invalid />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Create `packages/ui/src/primitives/PekuloLabel.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import { PekuloLabel } from "./PekuloLabel";

  describe("PekuloLabel snapshot", () => {
    it("renders bound to a control", () => {
      const { container } = renderWithTamagui(
        <PekuloLabel htmlFor="montant">Montant</PekuloLabel>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Run: `cd packages/ui && bunx vitest run src/primitives/PekuloInput.snapshot.test.tsx src/primitives/PekuloTextarea.snapshot.test.tsx src/primitives/PekuloLabel.snapshot.test.tsx -u` then the same without `-u`
  Expected: first run `Snapshots  5 written`; second run `Test Files  3 passed`, `Tests  5 passed`, exit 0.
  Commit: `git add packages/ui/src/primitives/PekuloInput.snapshot.test.tsx packages/ui/src/primitives/PekuloTextarea.snapshot.test.tsx packages/ui/src/primitives/PekuloLabel.snapshot.test.tsx && git commit -m "test(#46): snapshot form input primitives"`

- [x] **T5 — Snapshot the button primitives: `PekuloButton`, `PekuloButtonGroup`, `PekuloSubmitButton`** [AC: AC-1]

  Create `packages/ui/src/primitives/PekuloButton.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import { PekuloButton } from "./PekuloButton";

  describe("PekuloButton snapshot", () => {
    it("renders default", () => {
      const { container } = renderWithTamagui(<PekuloButton>Enregistrer</PekuloButton>);
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders loading", () => {
      const { container } = renderWithTamagui(
        <PekuloButton loading loadingLabel="Enregistrement…">
          Enregistrer
        </PekuloButton>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders disabled", () => {
      const { container } = renderWithTamagui(
        <PekuloButton disabled>Enregistrer</PekuloButton>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Create `packages/ui/src/primitives/PekuloButtonGroup.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import { PekuloButtonGroup } from "./PekuloButtonGroup";
  import { PekuloButton } from "./PekuloButton";

  describe("PekuloButtonGroup snapshot", () => {
    it("renders horizontal with two buttons", () => {
      const { container } = renderWithTamagui(
        <PekuloButtonGroup>
          <PekuloButton>Annuler</PekuloButton>
          <PekuloButton>Confirmer</PekuloButton>
        </PekuloButtonGroup>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders vertical", () => {
      const { container } = renderWithTamagui(
        <PekuloButtonGroup orientation="vertical">
          <PekuloButton>Annuler</PekuloButton>
          <PekuloButton>Confirmer</PekuloButton>
        </PekuloButtonGroup>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Create `packages/ui/src/primitives/PekuloSubmitButton.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import { PekuloSubmitButton } from "./PekuloSubmitButton";

  describe("PekuloSubmitButton snapshot", () => {
    it("renders primary idle", () => {
      const { container } = renderWithTamagui(
        <PekuloSubmitButton>Valider</PekuloSubmitButton>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders danger loading full-width", () => {
      const { container } = renderWithTamagui(
        <PekuloSubmitButton variant="danger" loading loadingLabel="Suppression…" fullWidth>
          Supprimer
        </PekuloSubmitButton>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Run: `cd packages/ui && bunx vitest run src/primitives/PekuloButton.snapshot.test.tsx src/primitives/PekuloButtonGroup.snapshot.test.tsx src/primitives/PekuloSubmitButton.snapshot.test.tsx -u` then the same without `-u`
  Expected: first run `Snapshots  7 written`; second run `Test Files  3 passed`, `Tests  7 passed`, exit 0.
  Commit: `git add packages/ui/src/primitives/PekuloButton.snapshot.test.tsx packages/ui/src/primitives/PekuloButtonGroup.snapshot.test.tsx packages/ui/src/primitives/PekuloSubmitButton.snapshot.test.tsx && git commit -m "test(#46): snapshot button primitives"`

- [x] **T6 — Snapshot the native-control primitives: `PekuloNativeCheckbox`, `PekuloNativeSelect`** [AC: AC-1]

  Both are uncontrolled here on purpose — a `checked`/`value` prop without `onChange` makes React warn about a controlled input with no handler, which pollutes the test output.

  Create `packages/ui/src/primitives/PekuloNativeCheckbox.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import { PekuloNativeCheckbox } from "./PekuloNativeCheckbox";

  describe("PekuloNativeCheckbox snapshot", () => {
    it("renders unchecked", () => {
      const { container } = renderWithTamagui(
        <PekuloNativeCheckbox aria-label="Compte actif" />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders checked", () => {
      const { container } = renderWithTamagui(
        <PekuloNativeCheckbox aria-label="Compte actif" defaultChecked />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Create `packages/ui/src/primitives/PekuloNativeSelect.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import { PekuloNativeSelect } from "./PekuloNativeSelect";

  describe("PekuloNativeSelect snapshot", () => {
    it("renders default with options", () => {
      const { container } = renderWithTamagui(
        <PekuloNativeSelect aria-label="Type de compte" defaultValue="pea">
          <option value="livret">Livret</option>
          <option value="pea">PEA</option>
          <option value="cto">CTO</option>
        </PekuloNativeSelect>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders invalid", () => {
      const { container } = renderWithTamagui(
        <PekuloNativeSelect aria-label="Type de compte" defaultValue="pea" invalid>
          <option value="livret">Livret</option>
          <option value="pea">PEA</option>
        </PekuloNativeSelect>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Run: `cd packages/ui && bunx vitest run src/primitives/PekuloNativeCheckbox.snapshot.test.tsx src/primitives/PekuloNativeSelect.snapshot.test.tsx -u` then the same without `-u`
  Expected: first run `Snapshots  4 written`; second run `Test Files  2 passed`, `Tests  4 passed`, exit 0.
  Commit: `git add packages/ui/src/primitives/PekuloNativeCheckbox.snapshot.test.tsx packages/ui/src/primitives/PekuloNativeSelect.snapshot.test.tsx && git commit -m "test(#46): snapshot native control primitives"`

- [x] **T7 — Snapshot the state primitives: `PekuloSpinner`, `PekuloLoadingItem`, `PekuloEmpty`** [AC: AC-1]

  `test/setup.tsx` forces `prefers-reduced-motion: reduce`, so rAF-driven animations settle at their final frame and snapshots stay stable. `PekuloSpinner` is CSS-keyframe driven (not rAF) — its snapshot legitimately contains the `@keyframes pekulo-spin-360` `<style>` block and `animation: pekulo-spin-360 1s linear infinite`. That is expected, not a leak.

  Create `packages/ui/src/primitives/PekuloSpinner.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import { PekuloSpinner } from "./PekuloSpinner";

  describe("PekuloSpinner snapshot", () => {
    it("renders default", () => {
      const { container } = renderWithTamagui(<PekuloSpinner />);
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders at size 24 with a custom label", () => {
      const { container } = renderWithTamagui(
        <PekuloSpinner size={24} ariaLabel="Synchronisation" />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Create `packages/ui/src/primitives/PekuloLoadingItem.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import { PekuloLoadingItem } from "./PekuloLoadingItem";

  describe("PekuloLoadingItem snapshot", () => {
    it("renders with a title", () => {
      const { container } = renderWithTamagui(
        <PekuloLoadingItem title="Chargement des comptes" />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders with trailing content", () => {
      const { container } = renderWithTamagui(
        <PekuloLoadingItem title="Synchronisation Bridge" trailing="3/12" spinnerSize={20} />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Create `packages/ui/src/primitives/PekuloEmpty.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { Inbox } from "lucide-react";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import {
    PekuloEmpty,
    PekuloEmptyHeader,
    PekuloEmptyMedia,
    PekuloEmptyTitle,
    PekuloEmptyDescription,
  } from "./PekuloEmpty";

  describe("PekuloEmpty snapshot", () => {
    it("renders the full composition", () => {
      const { container } = renderWithTamagui(
        <PekuloEmpty>
          <PekuloEmptyHeader>
            <PekuloEmptyMedia variant="icon">
              <Inbox size={20} aria-hidden={true} />
            </PekuloEmptyMedia>
            <PekuloEmptyTitle>Aucune transaction</PekuloEmptyTitle>
            <PekuloEmptyDescription>
              Importez un relevé ou connectez une banque pour commencer.
            </PekuloEmptyDescription>
          </PekuloEmptyHeader>
        </PekuloEmpty>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders outlined", () => {
      const { container } = renderWithTamagui(
        <PekuloEmpty outlined>
          <PekuloEmptyHeader>
            <PekuloEmptyTitle>Aucune transaction</PekuloEmptyTitle>
          </PekuloEmptyHeader>
        </PekuloEmpty>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Run: `cd packages/ui && bunx vitest run src/primitives/PekuloSpinner.snapshot.test.tsx src/primitives/PekuloLoadingItem.snapshot.test.tsx src/primitives/PekuloEmpty.snapshot.test.tsx -u` then the same without `-u`
  Expected: first run `Snapshots  6 written`; second run `Test Files  3 passed`, `Tests  6 passed`, exit 0.
  Commit: `git add packages/ui/src/primitives/PekuloSpinner.snapshot.test.tsx packages/ui/src/primitives/PekuloLoadingItem.snapshot.test.tsx packages/ui/src/primitives/PekuloEmpty.snapshot.test.tsx && git commit -m "test(#46): snapshot state primitives"`

- [x] **T8 — Snapshot the structure primitives: `PekuloCard`, `PekuloBreadcrumb`, `PekuloField`** [AC: AC-1]

  Create `packages/ui/src/primitives/PekuloCard.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import {
    PekuloCard,
    PekuloCardHeader,
    PekuloCardTitle,
    PekuloCardDescription,
    PekuloCardContent,
    PekuloCardFooter,
  } from "./PekuloCard";

  describe("PekuloCard snapshot", () => {
    it("renders the full composition at default size", () => {
      const { container } = renderWithTamagui(
        <PekuloCard>
          <PekuloCardHeader>
            <PekuloCardTitle>Compte courant</PekuloCardTitle>
            <PekuloCardDescription>Société Générale</PekuloCardDescription>
          </PekuloCardHeader>
          <PekuloCardContent>2 480,00 €</PekuloCardContent>
          <PekuloCardFooter>Mis à jour aujourd'hui</PekuloCardFooter>
        </PekuloCard>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders at size sm", () => {
      const { container } = renderWithTamagui(
        <PekuloCard size="sm">
          <PekuloCardHeader>
            <PekuloCardTitle>Compte courant</PekuloCardTitle>
          </PekuloCardHeader>
        </PekuloCard>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Create `packages/ui/src/primitives/PekuloBreadcrumb.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import {
    PekuloBreadcrumb,
    PekuloBreadcrumbList,
    PekuloBreadcrumbItem,
    PekuloBreadcrumbLink,
    PekuloBreadcrumbPage,
    PekuloBreadcrumbSeparator,
  } from "./PekuloBreadcrumb";

  describe("PekuloBreadcrumb snapshot", () => {
    it("renders a two-level trail ending on the current page", () => {
      const { container } = renderWithTamagui(
        <PekuloBreadcrumb>
          <PekuloBreadcrumbList>
            <PekuloBreadcrumbItem>
              <PekuloBreadcrumbLink href="/dashboard">Cap</PekuloBreadcrumbLink>
            </PekuloBreadcrumbItem>
            <PekuloBreadcrumbSeparator />
            <PekuloBreadcrumbItem>
              <PekuloBreadcrumbPage>Portefeuille</PekuloBreadcrumbPage>
            </PekuloBreadcrumbItem>
          </PekuloBreadcrumbList>
        </PekuloBreadcrumb>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Create `packages/ui/src/primitives/PekuloField.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import {
    PekuloField,
    PekuloFieldContent,
    PekuloFieldLabel,
    PekuloFieldDescription,
  } from "./PekuloField";
  import { PekuloInput } from "./PekuloInput";

  describe("PekuloField snapshot", () => {
    it("renders vertical with a label and a description", () => {
      const { container } = renderWithTamagui(
        <PekuloField>
          <PekuloFieldContent>
            <PekuloFieldLabel htmlFor="objectif">Capital cible</PekuloFieldLabel>
            <PekuloInput id="objectif" placeholder="800 000" />
            <PekuloFieldDescription>Montant visé à l'horizon du cap.</PekuloFieldDescription>
          </PekuloFieldContent>
        </PekuloField>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders invalid", () => {
      const { container } = renderWithTamagui(
        <PekuloField invalid>
          <PekuloFieldContent>
            <PekuloFieldLabel htmlFor="objectif2">Capital cible</PekuloFieldLabel>
            <PekuloInput id="objectif2" invalid />
          </PekuloFieldContent>
        </PekuloField>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Run: `cd packages/ui && bunx vitest run src/primitives/PekuloCard.snapshot.test.tsx src/primitives/PekuloBreadcrumb.snapshot.test.tsx src/primitives/PekuloField.snapshot.test.tsx -u` then the same without `-u`
  Expected: first run `Snapshots  5 written`; second run `Test Files  3 passed`, `Tests  5 passed`, exit 0.
  Commit: `git add packages/ui/src/primitives/PekuloCard.snapshot.test.tsx packages/ui/src/primitives/PekuloBreadcrumb.snapshot.test.tsx packages/ui/src/primitives/PekuloField.snapshot.test.tsx && git commit -m "test(#46): snapshot structure primitives"`

- [x] **T9 — Snapshot the portal/layout primitives: `PekuloDrawer`, `PekuloDialogCloseX`, `PekuloResizable`** [AC: AC-1]

  `PekuloDrawer` (vaul) renders into a portal — expect the shell-only snapshot, exactly like the existing `PekuloDialog.snapshot.test.tsx`. That is the accepted shape for portal primitives in this repo; do not chase the portal content into `document.body`.

  `PekuloDialogCloseX` calls `PekuloDialog.Close` internally, so it **must** be wrapped in a `PekuloDialog` or it throws a missing-context error. Render it outside the `Portal` so it has a chance to land in `container`; if the captured string is the empty shell anyway, that is the portal shape and it is fine.

  Create `packages/ui/src/primitives/PekuloDrawer.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import { PekuloDrawer } from "./PekuloDrawer";

  describe("PekuloDrawer snapshot", () => {
    it("renders open with header and footer", () => {
      const { container } = renderWithTamagui(
        <PekuloDrawer open>
          <PekuloDrawer.Portal>
            <PekuloDrawer.Overlay />
            <PekuloDrawer.Content>
              <PekuloDrawer.Header>
                <PekuloDrawer.Title>Filtrer les transactions</PekuloDrawer.Title>
                <PekuloDrawer.Description>Par mois et par catégorie.</PekuloDrawer.Description>
              </PekuloDrawer.Header>
              <PekuloDrawer.Footer>Appliquer</PekuloDrawer.Footer>
            </PekuloDrawer.Content>
          </PekuloDrawer.Portal>
        </PekuloDrawer>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Create `packages/ui/src/primitives/PekuloDialogCloseX.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import { PekuloDialog } from "./PekuloDialog";
  import { PekuloDialogCloseX } from "./PekuloDialogCloseX";

  describe("PekuloDialogCloseX snapshot", () => {
    it("renders the close affordance inside a dialog", () => {
      const { container } = renderWithTamagui(
        <PekuloDialog open>
          <PekuloDialogCloseX />
        </PekuloDialog>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Create `packages/ui/src/primitives/PekuloResizable.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import {
    PekuloResizablePanelGroup,
    PekuloResizablePanel,
    PekuloResizableHandle,
  } from "./PekuloResizable";

  describe("PekuloResizable snapshot", () => {
    it("renders a horizontal two-panel split", () => {
      const { container } = renderWithTamagui(
        <PekuloResizablePanelGroup orientation="horizontal">
          <PekuloResizablePanel defaultSize={50}>Gauche</PekuloResizablePanel>
          <PekuloResizableHandle />
          <PekuloResizablePanel defaultSize={50}>Droite</PekuloResizablePanel>
        </PekuloResizablePanelGroup>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders a vertical split with a grip handle", () => {
      const { container } = renderWithTamagui(
        <PekuloResizablePanelGroup orientation="vertical">
          <PekuloResizablePanel defaultSize={60}>Haut</PekuloResizablePanel>
          <PekuloResizableHandle withHandle />
          <PekuloResizablePanel defaultSize={40}>Bas</PekuloResizablePanel>
        </PekuloResizablePanelGroup>,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  If `PekuloResizable` throws on `defaultSize` or on `orientation`, read `node_modules/react-resizable-panels/dist/*.d.ts` for the v4 `GroupProps` / `PanelProps` shape before changing the props — the wrapper deliberately keeps the v3-style consumer API over the v4 primitives (`Group` / `Panel` / `Separator`), so the v3 shadcn docs do **not** describe what this wrapper accepts.

  Run: `cd packages/ui && bunx vitest run src/primitives/PekuloDrawer.snapshot.test.tsx src/primitives/PekuloDialogCloseX.snapshot.test.tsx src/primitives/PekuloResizable.snapshot.test.tsx -u` then the same without `-u`
  Expected: first run `Snapshots  4 written`; second run `Test Files  3 passed`, `Tests  4 passed`, exit 0.
  Commit: `git add packages/ui/src/primitives/PekuloDrawer.snapshot.test.tsx packages/ui/src/primitives/PekuloDialogCloseX.snapshot.test.tsx packages/ui/src/primitives/PekuloResizable.snapshot.test.tsx && git commit -m "test(#46): snapshot portal + layout primitives"`

- [x] **T10 — Snapshot the date primitives with a frozen month: `PekuloCalendar`, `PekuloDatePicker`** [AC: AC-1, AC-4]

  **This is the task that breaks silently if written naively.** react-day-picker renders the **current** month when no month is supplied. A snapshot captured today would encode August 2026 and start failing on 1 September — a red CI run with no code change, on a day nobody is looking. Every date below is an explicit literal; there is no `new Date()` without arguments anywhere in these files.

  Create `packages/ui/src/primitives/PekuloCalendar.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import { PekuloCalendar } from "./PekuloCalendar";

  // AC-4: the rendered month comes from an explicit prop, never the system
  // clock. react-day-picker defaults to the current month — a snapshot taken
  // without `month` encodes whatever month it was written in and turns red on
  // the 1st of the next one.
  const JANUARY_2026 = new Date(2026, 0, 1);
  const JANUARY_15_2026 = new Date(2026, 0, 15);

  describe("PekuloCalendar snapshot", () => {
    it("renders a fixed month with no selection", () => {
      const { container } = renderWithTamagui(
        <PekuloCalendar mode="single" month={JANUARY_2026} />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders a fixed month with a selected day", () => {
      const { container } = renderWithTamagui(
        <PekuloCalendar mode="single" month={JANUARY_2026} selected={JANUARY_15_2026} />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  Create `packages/ui/src/primitives/PekuloDatePicker.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui } from "../../test/setup.tsx";
  import { PekuloDatePicker } from "./PekuloDatePicker";

  // AC-4: fixed value → the trigger label is deterministic. The popover is
  // closed by default, so the calendar's own month never enters this snapshot.
  const JANUARY_15_2026 = new Date(2026, 0, 15);
  const JANUARY_31_2026 = new Date(2026, 0, 31);

  describe("PekuloDatePicker snapshot", () => {
    it("renders closed with a selected single date", () => {
      const { container } = renderWithTamagui(
        <PekuloDatePicker value={JANUARY_15_2026} onChange={vi.fn()} />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders closed with an empty value", () => {
      const { container } = renderWithTamagui(
        <PekuloDatePicker value={undefined} onChange={vi.fn()} placeholder="Choisir une date" />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });

    it("renders closed in range mode", () => {
      const { container } = renderWithTamagui(
        <PekuloDatePicker
          mode="range"
          value={{ from: JANUARY_15_2026, to: JANUARY_31_2026 }}
          onChange={vi.fn()}
        />,
      );
      expect(container.innerHTML).toMatchInlineSnapshot();
    });
  });
  ```

  After `-u`, **grep the two files for a month name or a 4-digit year that is not 2026**: `cd packages/ui && grep -nE "(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|20[0-9]{2})" src/primitives/PekuloCalendar.snapshot.test.tsx src/primitives/PekuloDatePicker.snapshot.test.tsx`. Every hit must be January/`janvier` or `2026`. Any other month means a `new Date()` leaked into the render path — fix the props before committing, or AC-4 is a lie that only surfaces next month.

  Run: `cd packages/ui && bunx vitest run src/primitives/PekuloCalendar.snapshot.test.tsx src/primitives/PekuloDatePicker.snapshot.test.tsx -u` then the same without `-u`
  Expected: first run `Snapshots  5 written`; second run `Test Files  2 passed`, `Tests  5 passed`, exit 0.
  Commit: `git add packages/ui/src/primitives/PekuloCalendar.snapshot.test.tsx packages/ui/src/primitives/PekuloDatePicker.snapshot.test.tsx && git commit -m "test(#46): snapshot date primitives with frozen month (AC-4)"`

- [x] **T11 — Add the two missing component a11y specs: `CategoryIcon`, `PekuloMobileBottomNav`** [AC: AC-5]

  Create `packages/ui/src/components/CategoryIcon/CategoryIcon.a11y.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../../test/setup.tsx";
  import { CategoryIcon } from "./CategoryIcon";

  describe("CategoryIcon a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(<CategoryIcon category="courses" />);
      const r = await axe(container);
      expect(
        (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
      ).toEqual([]);
    });

    it("is hidden from assistive tech (decorative icon, label lives on the row)", () => {
      const { container } = renderWithTamagui(<CategoryIcon category="courses" />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
  });
  ```

  Create `packages/ui/src/components/PekuloMobileBottomNav/PekuloMobileBottomNav.a11y.test.tsx`:

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { fireEvent } from "@testing-library/react";
  import { renderWithTamagui, axe } from "../../../test/setup.tsx";
  import { PekuloMobileBottomNav } from "./PekuloMobileBottomNav";

  describe("PekuloMobileBottomNav a11y + behaviour", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloMobileBottomNav activeKey="cap" onSelect={vi.fn()} />,
      );
      const r = await axe(container);
      expect(
        (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
      ).toEqual([]);
    });

    it("exposes the five destinations as buttons", () => {
      const { getAllByRole } = renderWithTamagui(
        <PekuloMobileBottomNav activeKey="cap" onSelect={vi.fn()} />,
      );
      expect(getAllByRole("button")).toHaveLength(5);
    });

    it("fires onSelect with the tapped key", () => {
      const onSelect = vi.fn();
      const { getByText } = renderWithTamagui(
        <PekuloMobileBottomNav activeKey="cap" onSelect={onSelect} />,
      );
      fireEvent.click(getByText("Portefeuille"));
      expect(onSelect).toHaveBeenCalledWith("portfolio");
    });
  });
  ```

  If the `getAllByRole("button")` assertion fails with 0 matches, the nav items render as plain `<div>`s — that is a real a11y defect (icon-only tap targets unreachable by keyboard, NFR-24). Record it in the Dev Agent Record and raise it at `aped-review`; do **not** patch the component in this story.

  Run: `cd packages/ui && bunx vitest run src/components/CategoryIcon src/components/PekuloMobileBottomNav`
  Expected: `Test Files  4 passed` (2 snapshot from T2/T3 + 2 a11y), `Tests  8 passed`, exit 0.
  Commit: `git add packages/ui/src/components/CategoryIcon/CategoryIcon.a11y.test.tsx packages/ui/src/components/PekuloMobileBottomNav/PekuloMobileBottomNav.a11y.test.tsx && git commit -m "test(#46): a11y specs for CategoryIcon + PekuloMobileBottomNav"`

- [x] **T11b — Add the seven missing primitive a11y specs** [AC: AC-5] _(added 2026-08-25 by the scope amendment above)_

  `PekuloCalendar`, `PekuloDatePicker`, `PekuloDialogCloseX`, `PekuloDrawer`, `PekuloNativeCheckbox`, `PekuloNativeSelect`, `PekuloTextarea`. Same shape as `PekuloSwitch.a11y.test.tsx`: one axe assertion filtered to `serious`/`critical`, plus one role/attribute assertion that makes the spec non-vacuous. Setup import is `"../../test/setup.tsx"` (two levels — primitives are flat).

  Three shape notes, each of which otherwise costs a RED cycle:
  - **Portal primitives** (`PekuloDrawer`, `PekuloDialogCloseX`) render their content into `document.body`, so `container` is the empty shell and `axe(container)` scans nothing. That is the established repo shape — `PekuloDialog.a11y.test.tsx` does exactly this. Keep `axe(container)` for consistency, and add a role assertion through the RTL queries (they are bound to `baseElement`, i.e. `document.body`) so the spec actually observes the portalled tree.
  - **`PekuloCalendar` / `PekuloDatePicker` pin their month** for the same reason as T10 (AC-4): react-day-picker defaults to the current month, and a spec that renders it is one Intl locale change away from a surprise. Pass `month={JANUARY_2026}` / a fixed `value`.
  - **Compound triggers must be real buttons** (lesson 2026-05-06 — axe flags `aria-expanded` on a `<div>` as critical). `PekuloPopover.Trigger` already renders `<button type="button">` via `asChild`, and `PekuloDialogCloseX` already carries `render="button"`; the specs assert it rather than assume it.

  Run: `cd packages/ui && bunx vitest run src/primitives/PekuloCalendar.a11y.test.tsx src/primitives/PekuloDatePicker.a11y.test.tsx src/primitives/PekuloDialogCloseX.a11y.test.tsx src/primitives/PekuloDrawer.a11y.test.tsx src/primitives/PekuloNativeCheckbox.a11y.test.tsx src/primitives/PekuloNativeSelect.a11y.test.tsx src/primitives/PekuloTextarea.a11y.test.tsx`
  Expected: `Test Files  7 passed`, exit 0. **If axe reports a `serious`/`critical` violation, that is a real component defect** — record it in the Dev Agent Record and raise it at `aped-review`; do not patch the source, the story is tests-only.
  Commit: `git add packages/ui/src/primitives/*.a11y.test.tsx && git commit -m "test(#46): a11y specs for the seven uncovered primitives"`

- [x] **T12 — Prove `no-tailwind-outside-ui` is live and record the procedure** [AC: AC-2]

  A green `bun run lint` proves nothing about a self-gating rule — `no-server-action-in-component` was inert for months while lint stayed green (lesson 2026-06-15). Run the probe below and paste the **verbatim output** into the Dev Agent Record § "AC-2 probe". Both halves are required: the rule must fire outside `packages/ui/` **and** stay silent inside it.

  ```bash
  cd "$(git rev-parse --show-toplevel)"

  # Half 1 — the rule MUST fire outside packages/ui/
  cat > apps/web/src/__tw-probe.tsx <<'PROBE'
  export function TwProbe() {
    return <div className="flex p-4 text-sm">probe</div>;
  }
  PROBE
  bunx oxlint apps/web/src/__tw-probe.tsx
  rm -f apps/web/src/__tw-probe.tsx

  # Half 2 — the uiRoot exemption MUST hold inside packages/ui/
  cat > packages/ui/src/__tw-probe.tsx <<'PROBE'
  export function TwProbe() {
    return <div className="flex p-4 text-sm">probe</div>;
  }
  PROBE
  bunx oxlint packages/ui/src/__tw-probe.tsx
  rm -f packages/ui/src/__tw-probe.tsx

  # Both probes gone — must print 0
  find apps/web/src packages/ui/src -name "__tw-probe*" | wc -l
  ```

  Run: the block above verbatim, from the repo root (it is the test command for this task — there is no test file, the probe *is* the test).
  Expected — half 1: `pekulo(no-tailwind-outside-ui): Tailwind utility classes are forbidden outside @pekulo/ui (FR-55)` and `Found 0 warnings and 1 error.` Half 2: `Found 0 warnings and 0 errors.` Final line: `0`.
  **If half 1 reports 0 errors, the rule is inert — STOP and raise it.** That is an AC-2 blocker and a lint-infra bug, not something to work around inside this story.
  Commit: no code changes — the probe files are deleted. Record the output in the story file, then `git add docs/stories/10-1-visual-snapshot-suite.md && git commit -m "docs(#46): record no-tailwind-outside-ui liveness probe (AC-2)"`

- [x] **T13 — Full sweep, meta-test GREEN, and doc-sync** [AC: AC-1, AC-2, AC-3, AC-4, AC-5]

  Run each gate below from the repo root, in order, and paste the tail of each into the Dev Agent Record:

  ```bash
  cd "$(git rev-parse --show-toplevel)"
  bun --filter='@pekulo/ui' run typecheck
  bun run lint
  bun run format:check
  cd packages/ui && bun run test:visual
  cd packages/ui && bun run test:axe
  cd packages/ui && bun run test
  ```

  Run: the six commands above, in that order, from the repo root.
  Expected: `typecheck` exit 0 · `lint` `Found 0 warnings and 0 errors.` · `format:check` exit 0 · `test:visual` exit 0 with the meta-test's `every public component and primitive has a snapshot spec` **passing** · `test:axe` exit 0 with `every public component and primitive has an a11y spec` **passing** · `test` exit 0 on the full suite (previous baseline + 25 new files).

  Two notes that will otherwise cost a RED cycle:
  - `oxfmt` reformats the long single-line strings that `vitest -u` writes. Run `bun run format` (not just `format:check`) before the final commit, or lefthook will rewrite the files under you at commit time and leave the tree dirty.
  - `typecheck` runs before the tests on purpose: the pre-commit hook does **not** run `tsc` (lesson 2026-06-01), so a type-broken test file commits green and lands red in CI.

  Then refresh the epic-context cache consumed by `aped-dev` / `aped-review` — this story is the first of epic 10, so the cache does not exist yet:

  ```bash
  bash .aped/scripts/validate-epic-context.sh docs/epics-context/epic-10-context.md
  ```

  Expected: exit 0 (the cache is written by `aped-story`; the validator confirms it conforms). If the script is absent, warn once and continue.
  Commit: `git add -u && git commit -m "test(#46): close DS snapshot coverage — 23 snapshots + 2 a11y specs, meta-test GREEN"`

## Dev Notes

### Existing code at write time

This story creates **25 new test files and modifies zero source files**, so there is no symbol to re-quote for modification. What follows is the verbatim current state of the two *patterns* every new file must reproduce, plus the exact prop surfaces the tasks call.

**The snapshot pattern — `packages/ui/src/components/PekuloStat/PekuloStat.snapshot.test.tsx` (current, verbatim):**

```tsx
import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { PekuloStat } from "./PekuloStat";

describe("PekuloStat snapshot", () => {
  it("renders neutral", () => {
    const { container } = renderWithTamagui(<PekuloStat label="Net" value="+1 050 €" />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View "><span class="is_Text _col-colorTertia3655 _fs-f-size-xs _ls-0--5px">Net</span><span class="is_Text _col-color _fs-f-size-h2 _fw-600 _mt-c-space-1">+1 050 €</span></div><div style="display: contents;"></div></span>"`,
    );
  });
});
```

**The a11y pattern — `packages/ui/src/primitives/PekuloSwitch.a11y.test.tsx` (current, first case verbatim):**

```tsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloSwitch } from "./PekuloSwitch";

describe("PekuloSwitch a11y + behaviour", () => {
  it("has no serious/critical violations + role=switch", async () => {
    const { container, getByRole } = renderWithTamagui(
      <PekuloSwitch aria-label="Notifications" checked onCheckedChange={vi.fn()} />,
    );
    expect(getByRole("switch")).toBeInTheDocument();
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
```

**The portal shape — `packages/ui/src/primitives/PekuloDialog.snapshot.test.tsx` (current, verbatim).** This is what a legitimate portal snapshot looks like; T9 will produce the same shape for `PekuloDrawer`:

```tsx
expect(container.innerHTML).toMatchInlineSnapshot(
  `"<span class="_dsp_contents  font_body"><div style="display: contents;"></div></span>"`,
);
```

**Prop surfaces called by the tasks (verbatim from source at write time):**

```ts
// src/components/CategoryIcon/CategoryIcon.tsx
export interface CategoryIconProps {
  category: string;
  size?: number;
  color?: string;
  style?: CSSProperties;
}

// src/components/CategoryPicker/CategoryPicker.tsx
export interface CategoryOption { value: string; label: string; }
export interface CategoryPickerProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<CategoryOption>;
  id?: string;
  placeholder?: string;
}

// src/components/PekuloMobileBottomNav/PekuloMobileBottomNav.tsx
export interface PekuloMobileBottomNavProps {
  activeKey: PekuloNavKey;              // imported from "../PekuloNavRail"
  onSelect: (key: PekuloNavKey) => void;
}
// NAV_ITEMS keys, in render order: cap · transactions · monthly · portfolio · realestate

// src/components/PekuloPagination/PekuloPagination.tsx
export interface PekuloPaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
}

// src/primitives/PekuloSpinner.tsx
export interface PekuloSpinnerProps { size?: number; color?: string; ariaLabel?: string; }

// src/primitives/PekuloLoadingItem.tsx
export interface PekuloLoadingItemProps { title: ReactNode; trailing?: ReactNode; spinnerSize?: number; }

// src/primitives/PekuloCalendar.tsx
export type PekuloCalendarProps = DayPickerProps;   // react-day-picker v10 — `month` prop pins the grid

// src/primitives/PekuloDatePicker.tsx — discriminated union on `mode`
export interface PekuloDatePickerSingleProps {
  mode?: "single";
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  placeholder?: string;
  formatLabel?: (d?: Date) => string;
  width?: number | string;
  disabled?: boolean;
  id?: string;
}
export interface PekuloDatePickerRangeProps {
  mode: "range";
  value: DateRange | undefined;
  onChange: (r: DateRange | undefined) => void;
  placeholder?: string;
  formatLabel?: (r?: DateRange) => string;
  width?: number | string;
  disabled?: boolean;
  numberOfMonths?: number;
}

// src/primitives/PekuloDrawer.tsx — compound, Object.assign(Root, {...})
export const PekuloDrawer = Object.assign(Root, {
  Trigger, Portal, Close, Overlay, Content, Header, Footer, Title, Description,
});

// src/primitives/PekuloResizable.tsx — wraps react-resizable-panels v4
export function PekuloResizablePanelGroup({ style, orientation, ...props }: GroupProps)
export function PekuloResizablePanel(props: PanelProps)
export interface PekuloResizableHandleProps extends SeparatorProps { withHandle?: boolean; className?: string; }
```

**Sub-part export lists (call them by these exact names — a wrong name is a typecheck failure, not a runtime one):**

- `PekuloCard` · `PekuloCardHeader` · `PekuloCardTitle` · `PekuloCardDescription` · `PekuloCardAction` · `PekuloCardContent` · `PekuloCardFooter`
- `PekuloEmpty` · `PekuloEmptyHeader` · `PekuloEmptyMedia` · `PekuloEmptyTitle` · `PekuloEmptyDescription` · `PekuloEmptyContent`
- `PekuloBreadcrumb` · `PekuloBreadcrumbList` · `PekuloBreadcrumbItem` · `PekuloBreadcrumbLink` · `PekuloBreadcrumbPage` · `PekuloBreadcrumbSeparator` · `PekuloBreadcrumbEllipsis`
- `PekuloFieldSet` · `PekuloFieldLegend` · `PekuloFieldGroup` · `PekuloField` · `PekuloFieldContent` · `PekuloFieldLabel` · `PekuloFieldTitle` · `PekuloFieldDescription` · `PekuloFieldSeparator` · `PekuloFieldError`

### File map — one responsibility per file

Every file below is a **new** file. The 3-bullet contract for the one non-obvious file, then the bulk rule for the 24 test files.

**`packages/ui/src/ds-coverage.meta.test.ts`** *(the only file that is not a per-component test)*
- **Responsibility** — enumerate the real filesystem under `src/components/` and `src/primitives/` and fail naming any public component/primitive missing a `.snapshot.test.tsx` or `.a11y.test.tsx` sibling. Nothing else.
- **Inputs** — `node:fs` (`readdirSync`, `existsSync`, `statSync`), `node:path`, `node:url`. No component imports, no rendering, no Tamagui.
- **Outputs** — two vitest assertions. The `it` titles carry the words `snapshot` and `a11y` so the filtered scripts `test:visual` and `test:axe` each pick up their own exhaustiveness check.

**The 24 test files** — `<Name>.snapshot.test.tsx` / `<Name>.a11y.test.tsx` sitting next to the component they cover.
- **Responsibility** — one file covers exactly one component's rendered output (snapshot) or its axe + role contract (a11y). Never two components per file.
- **Inputs** — `renderWithTamagui` (and `axe` for a11y specs) from `test/setup.tsx`, plus the component under test. **Import depth differs by location:** `src/components/<Name>/` → `"../../../test/setup.tsx"` · `src/primitives/` → `"../../test/setup.tsx"`.
- **Outputs** — inline snapshot assertions written by `vitest -u`; a11y files additionally assert zero `serious`/`critical` violations.

### The 23 missing snapshots and 9 missing a11y specs (measured, exhaustive)

| Location | Missing `.snapshot.test.tsx` | Task |
|---|---|---|
| `src/components/` | `CategoryIcon`, `PekuloPagination` | T2 |
| `src/components/` | `CategoryPicker`, `PekuloMobileBottomNav` | T3 |
| `src/primitives/` | `PekuloInput`, `PekuloTextarea`, `PekuloLabel` | T4 |
| `src/primitives/` | `PekuloButton`, `PekuloButtonGroup`, `PekuloSubmitButton` | T5 |
| `src/primitives/` | `PekuloNativeCheckbox`, `PekuloNativeSelect` | T6 |
| `src/primitives/` | `PekuloSpinner`, `PekuloLoadingItem`, `PekuloEmpty` | T7 |
| `src/primitives/` | `PekuloCard`, `PekuloBreadcrumb`, `PekuloField` | T8 |
| `src/primitives/` | `PekuloDrawer`, `PekuloDialogCloseX`, `PekuloResizable` | T9 |
| `src/primitives/` | `PekuloCalendar`, `PekuloDatePicker` | T10 |
| `src/components/` | *(a11y)* `CategoryIcon`, `PekuloMobileBottomNav` | T11 |
| `src/primitives/` | *(a11y)* `PekuloCalendar`, `PekuloDatePicker`, `PekuloDialogCloseX`, `PekuloDrawer`, `PekuloNativeCheckbox`, `PekuloNativeSelect`, `PekuloTextarea` | T11b |

### Architecture

- **Contract** — `architecture.md:631`: "`@pekulo/ui` components: 1 visual snapshot + 1 vitest-axe a11y spec per public component." All 33 primitives are publicly exported through `src/primitives/index.ts` → they are in scope, not just the 42 `Pekulo*` domain components.
- **R11 layout asymmetry (do not normalise it here)** — components follow R11 (`components/PekuloX/PekuloX.tsx` + siblings in the same folder); primitives are **flat files** in `src/primitives/`. The meta-test handles both shapes explicitly. Restructuring the primitives into R11 folders is a separate refactor — out of scope, and it would bury a tests-only diff under 100 file moves.
- **Test pyramid** — ADR-0002. `@pekulo/ui` runs **vitest** (not `bun test`) because of the DOM + `vitest-axe` harness; `apps/api` runs `bun test`. CI fans out via per-package `test` scripts (lesson 2026-05-07) — never short-circuit to one runner.
- **Snapshots encode Tamagui atomic classes**, which are generated at runtime by the Tamagui provider under `disableInjectCSS`. They are therefore sensitive to a Tamagui version bump — that is accepted (52 existing files already carry the same coupling) and orthogonal to the `tamagui-css-fresh` CI job, which guards the *committed* `public/tamagui.generated.css` artefact instead.

### Testing

- **Runner** — `cd packages/ui && bunx vitest run <paths>`. Verified working at write time: `bunx vitest run src/primitives/Section.snapshot.test.tsx` → `Test Files 1 passed (1)`, 1.55 s.
- **Never `bun --filter=ui`** — the workspace name is `@pekulo/ui` (lesson 2026-05-19). Never `bun --cwd packages/ui` — that form silently exits 0 on path-resolution failure (lesson 2026-05-05). The approved shapes are `cd packages/ui && bun run <script>` and `bun --filter='@pekulo/ui' run <script>`.
- **Inline-snapshot fill is mechanical, verified at write time.** A probe file with `toMatchInlineSnapshot()` (no argument) + `bunx vitest run <file> -u` produced `Snapshots  1 written` and rewrote the call with the full rendered string. Probe removed. This is the workflow every task from T2 to T10 relies on.
- **`vi.mock` hoisting** — not needed here (no module mocking), but if a component forces one, use `vi.hoisted(() => ({ … }))`; a bare top-level `const` referenced from a `vi.mock` factory throws `Cannot access '…' before initialization` (lesson 2026-05-20).
- **Reduced motion is forced in `test/setup.tsx`** — `window.matchMedia` reports `matches: true` for `prefers-reduced-motion`, so count-ups and donut sweeps render at their settled value. Snapshots are stable because of this, not by luck. Do not reassign `window.matchMedia` in these files.

### Dependencies

No new dependency. Everything used is already in `packages/ui/devDependencies`: `vitest ^3.2.6`, `@testing-library/react ^16`, `@testing-library/jest-dom ^6`, `vitest-axe ^0.1.0`, `happy-dom ^20`. `lucide-react` (used by the `PekuloEmpty` test's icon) is a runtime dependency already.

### Lessons applied to this story

- **2026-06-05 (aped-story/dev/review)** — a step-04 scope expansion into a new subsystem is split, not absorbed. The meta-test (T1) is *not* a new subsystem: it is one 60-line file in the same runner, and it is what makes AC-1 durable rather than momentary. The mobile snapshot suite (a genuine new subsystem) is explicitly left to `10-2`.
- **2026-06-05, second half** — the "cheap class-killer meta-test" that enumerates the source of truth and asserts registration. `ID_PREFIXES` got one after a model shipped unregistered twice; the DS coverage gap is the same failure class and gets the same fix.
- **2026-06-15 (aped-dev/review)** — a self-gating custom oxlint rule can be inert while lint is green. T12 proves activity with a deliberately-violating fixture in both directions and records the output verbatim.
- **2026-05-19 (aped-story/dev/review)** — `bun --filter` takes the workspace package name; every command in this story uses `@pekulo/ui` or `cd packages/ui`.
- **2026-06-01 (aped-dev)** — pre-commit does not run `tsc`. T13 runs `typecheck` before the test gates.
- **2026-05-17 (aped-dev/review)** — `PekuloMobileBottomNav`'s five cells must be CSS Grid `repeat(5, 1fr)`, not flex. T3 makes the captured snapshot the assertion of that.
- **2026-05-24 (aped-dev/review)** — `tamagui.generated.css` drift. Not triggered here (no `styled(...)` is added), and the `tamagui-css-fresh` CI job guards it independently.
- **2026-05-31 (aped-story/dev/review)** — any feature added after this scope lock carries its own doc-sync in the same change. If `aped-dev` ends up touching a component source, the "tests only" claim in the header becomes false and must be superseded in place, not deleted.

### Commit prefix

`test(#46): …` for the test files, `docs(#46): …` for story/doc updates. Final PR body: `Closes #46`.

## File List

**Created — 1 meta-test:**

- `packages/ui/src/ds-coverage.meta.test.ts`

**Created — 23 snapshot specs:**

- `packages/ui/src/components/CategoryIcon/CategoryIcon.snapshot.test.tsx`
- `packages/ui/src/components/CategoryPicker/CategoryPicker.snapshot.test.tsx`
- `packages/ui/src/components/PekuloMobileBottomNav/PekuloMobileBottomNav.snapshot.test.tsx`
- `packages/ui/src/components/PekuloPagination/PekuloPagination.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloBreadcrumb.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloButton.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloButtonGroup.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloCalendar.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloCard.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloDatePicker.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloDialogCloseX.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloDrawer.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloEmpty.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloField.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloInput.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloLabel.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloLoadingItem.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloNativeCheckbox.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloNativeSelect.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloResizable.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloSpinner.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloSubmitButton.snapshot.test.tsx`
- `packages/ui/src/primitives/PekuloTextarea.snapshot.test.tsx`

**Created — 9 a11y specs:**

- `packages/ui/src/components/CategoryIcon/CategoryIcon.a11y.test.tsx`
- `packages/ui/src/components/PekuloMobileBottomNav/PekuloMobileBottomNav.a11y.test.tsx`
- `packages/ui/src/primitives/PekuloCalendar.a11y.test.tsx`
- `packages/ui/src/primitives/PekuloDatePicker.a11y.test.tsx`
- `packages/ui/src/primitives/PekuloDialogCloseX.a11y.test.tsx`
- `packages/ui/src/primitives/PekuloDrawer.a11y.test.tsx`
- `packages/ui/src/primitives/PekuloNativeCheckbox.a11y.test.tsx`
- `packages/ui/src/primitives/PekuloNativeSelect.a11y.test.tsx`
- `packages/ui/src/primitives/PekuloTextarea.a11y.test.tsx`

**Modified:**

- `docs/stories/10-1-visual-snapshot-suite.md` (Dev Agent Record: AC-2 probe output, gate outputs, deviations)
- `docs/state.yaml` (`sprint.stories.10-1-visual-snapshot-suite.status`)

**Modified at `aped-review` (2026-08-25) — component sources, per the superseded scope note above:**

- `packages/ui/src/primitives/PekuloInput.tsx` (focus ring — NFR-24)
- `packages/ui/src/primitives/PekuloTextarea.tsx` (focus ring — NFR-24)
- `packages/ui/src/primitives/PekuloNativeSelect.tsx` (focus ring — NFR-24)
- `packages/ui/src/primitives/PekuloCalendar.tsx` (French locale, Monday-first — NFR-22)
- `packages/ui/src/primitives/PekuloDatePicker.tsx` (trigger aligned on the ux-preview pill)
- `packages/ui/src/primitives/PekuloEmpty.tsx` (dropped the unused `outlined` prop; icon chip geometry)

**Created at `aped-review`:**

- `packages/ui/src/primitives/form-focus-ring.ts` (shared `:focus-visible` contract — not a component, `.ts` by design so it is not itself a coverage target)

**Modified at `aped-review` — tests:**

- `packages/ui/src/ds-coverage.meta.test.ts` (gate extended to the public barrel)
- `packages/ui/src/toast/snapshot.test.tsx`, `packages/ui/src/toast/a11y.test.tsx` (cover `PekuloToastViewport` + `ToastProvider`)
- `packages/ui/src/components/TransactionLogo/TransactionLogo.snapshot.test.tsx` (title carried no `snapshot` keyword — `test:visual` was skipping it)
- Re-captured snapshots: `PekuloInput`, `PekuloTextarea`, `PekuloNativeSelect`, `PekuloField`, `PekuloCalendar`, `PekuloDatePicker`, `PekuloEmpty`, `PekuloResizable`
- `docs/epics-context/epic-10-context.md` (was generated but never committed)

**Still explicitly NOT modified** — every other file under `packages/ui/src/**/*.tsx` that is not a test.

## Dev Agent Record

- **Model:** Opus 5 (1M context) — `claude-opus-5[1m]`
- **Started:** 2026-08-25
- **Completed:** 2026-08-25

### Summary

The DS contract at `architecture.md:631` is now enforced by a meta-test and satisfied by the filesystem: **33 new test files** (1 meta-test + 23 snapshots + 9 a11y specs), **zero component source files touched**. The meta-test is the durable half — before it, a component could ship without a snapshot and CI stayed green, which is how coverage drifted to 69 % across epics 1-9. `test:visual` and `test:axe` each run their own half of the exhaustiveness check, so neither gate can pass while its suite is incomplete.

The measured a11y gap was **9**, not the 2 the story predicted at write time (the write-time count only walked `src/components/` and missed 7 uncovered primitives). The gap was surfaced at step-03 and closed by writing all 9 rather than narrowing the gate or filling the exempt map — see the scope amendment near the top of this file. Both exempt maps ship empty.

### Files changed

34 files, all new except the story itself. Full list under **File List** above. Nothing under `packages/ui/src/**/*.tsx` that is not a test was modified, so the header's "tests only" framing still holds.

### Deviations

**Scope**

1. **a11y gap was 9, not 2** — `PekuloCalendar`, `PekuloDatePicker`, `PekuloDialogCloseX`, `PekuloDrawer`, `PekuloNativeCheckbox`, `PekuloNativeSelect`, `PekuloTextarea` were uncovered on top of the two named components. T13 was unreachable as originally written: T1's meta-test enumerates primitives too, so its a11y assertion went RED with 9 names while T11 filled only 2. Task **T11b** added, AC-5 widened, user-approved before any code was written.

**Test shape, where the story's proposed code did not match the source**

2. **`PekuloDrawer`** — the story's tree wrapped `PekuloDrawer.Content` in `Portal` + `Overlay`, but `Content` already renders both internally (`PekuloDrawer.tsx:128-140`); following the story verbatim would have mounted two overlays. Both the snapshot and the a11y spec use the real API.
3. **`PekuloPagination`, second case** — the story titles it "renders a single page (no gaps, both arrows dimmed)", but `pageCount <= 1` returns `null` (`PekuloPagination.tsx:96`), so nothing renders. Retitled "renders nothing at a single page"; the empty-shell capture is correct here and is the one non-portal snapshot that legitimately holds it.
4. **`PekuloMobileBottomNav.a11y`** — needs a phone-width viewport. happy-dom's window is exactly **1024px**, where the component's `$lg={{ display: "none" }}` computes the whole subtree to `display: none`: every role query returns empty and **axe scans nothing and reports a vacuous pass**. The spec now sets a 390px viewport, restores 1024px after, and asserts `display !== "none"` before scanning — without that guard the AC-5 evidence for this component would have been a false green. The story's predicted cause (nav items rendering as plain `<div>`s) is **not** what happened: all five are real `<button>`s.
5. **`PekuloDrawer.a11y`** scans `baseElement`, not `container` — vaul portals its content into `document.body`, so scanning `container` would pass over an empty shell.

**Gate results that differ from the story's stated expectations**

6. **`lint` reports `Found 4 warnings and 0 errors`**, not `0 warnings`. All 4 pre-date this story (`apps/api/src/bootstrap/runtime-dependencies.ts` ×2, `apps/web/.../recent-activity-section.tsx`, `apps/web/.../dashboard-edit-context.tsx`); none is in this story's diff. oxlint exits **0** — warnings do not fail the gate.
7. **`format:check` exits 1**, on `.claude/settings.local.json` only. That file is **untracked and gitignored** (`~/.config/git/ignore`), so CI's `format-check` job never sees it. All **1045** git-tracked files, including all 33 written here, format clean. Not fixed: reformatting a developer's local settings file is outside this story.
8. **Visual dev loop not run** — `mcp__react-grab-mcp__get_element_context` is unavailable in this session, and the diff changes no rendered surface, so a live pass would have verified nothing about it. The snapshots are the visual capture.

**Environment**

9. **iCloud eviction blocked every tool for ~50 minutes.** `vitest` froze at 0 % CPU on `node_modules/.bun/loupe@3.2.1/.../date.js`; `/usr/bin/find node_modules -type f -flags +dataless` reported **8871** evicted files (112.5 MB). Rematerialised with a 320-way parallel read sweep (~250 files/min — the ceiling is the iCloud daemon, not CPU). This is the failure mode recorded in `lessons.md` on 2026-07-25, misdiagnosed as "agent sandbox hangs" during story 9-2. The durable fix (move the repo out of `~/Documents`, or disable "Optimise Mac Storage") is the developer's call and was raised.

**Observations for `aped-review` — recorded, deliberately not fixed.** None of these is fixed here: every one would require touching a component source, which this story forbids.

- **`PekuloCalendar` announces its days in English** inside a French app: `aria-label="Monday, December 29th, 2025"`, caption `January 2026`. No `locale` is passed to react-day-picker, so it falls back to `en-US`. axe does not flag it, but it is an NFR-22 screen-reader gap and it is now frozen into the visual baseline. Fixing it means touching the component, which this story forbids.
- **A breakpoint-hidden component gets a silently vacuous axe scan** (deviation 4). Today only `PekuloMobileBottomNav` combines a `display: none` breakpoint with an a11y spec — verified by scanning every component and primitive — but the next one to do so will hit the same false green. Worth a shared render helper or a lint rule; out of scope here.
- **happy-dom mis-expands CSS shorthands.** `invalid` snapshots contain `border-width: var(--danger); border-style: var(--danger)` from the source's `border: "1px solid var(--danger)"`, and `outline: "none"` becomes `outline-color: none`. Deterministic, so harmless as a baseline, but a reviewer will read it as a DS violation.
- **`defaultSize` is inert in `PekuloResizable` snapshots.** happy-dom reports zero-size boxes, so react-resizable-panels v4 has no group width and falls back to equal `flex-grow: 50` regardless of the prop. Documented in the file. Same root cause as the pre-existing `PekuloResizable.a11y` skip introduced by story 4-3 (`a303e4a`).

### Test output

#### (1) T1 — RED, meta-test enumerating the gaps

```
FAIL  src/ds-coverage.meta.test.ts > design-system test coverage (architecture.md:631) > every public component and primitive has a snapshot spec
AssertionError: missing <name>.snapshot.test.tsx for: CategoryIcon, CategoryPicker, PekuloMobileBottomNav, PekuloPagination, PekuloBreadcrumb, PekuloButton, PekuloButtonGroup, PekuloCalendar, PekuloCard, PekuloDatePicker, PekuloDialogCloseX, PekuloDrawer, PekuloEmpty, PekuloField, PekuloInput, PekuloLabel, PekuloLoadingItem, PekuloNativeCheckbox, PekuloNativeSelect, PekuloResizable, PekuloSpinner, PekuloSubmitButton, PekuloTextarea: expected [ 'CategoryIcon', …(22) ] to deeply equal []

FAIL  src/ds-coverage.meta.test.ts > design-system test coverage (architecture.md:631) > every public component and primitive has an a11y spec
AssertionError: missing <name>.a11y.test.tsx for: CategoryIcon, PekuloMobileBottomNav, PekuloCalendar, PekuloDatePicker, PekuloDialogCloseX, PekuloDrawer, PekuloNativeCheckbox, PekuloNativeSelect, PekuloTextarea: expected [ 'CategoryIcon', …(8) ] to deeply equal []

 Test Files  1 failed (1)
      Tests  2 failed (2)
```

23 snapshot names, exactly the list the task predicted. **9** a11y names, not the 2 the task predicted — see the scope amendment at the top of this story.

#### (2) T12 — `no-tailwind-outside-ui` liveness probe (AC-2)

Half 1 — the rule fires outside `packages/ui/`:

```
$ bunx oxlint apps/web/src/__tw-probe.tsx

  x pekulo(no-tailwind-outside-ui): Tailwind utility classes are forbidden outside @pekulo/ui (FR-55)
   ,-[apps/web/src/__tw-probe.tsx:2:25]
 1 | export function TwProbe() {
 2 |   return <div className="flex p-4 text-sm">probe</div>;
   :                         ^^^^^^^^^^^^^^^^^^
 3 | }
   `----

Found 0 warnings and 1 error.
Finished in 65ms on 1 file with 158 rules using 11 threads.
```

Half 2 — the `uiRoot` exemption holds inside `packages/ui/`:

```
$ bunx oxlint packages/ui/src/__tw-probe.tsx
Found 0 warnings and 0 errors.
Finished in 47ms on 1 file with 158 rules using 11 threads.
```

Both probes removed:

```
$ find apps/web/src packages/ui/src -name "__tw-probe*" | wc -l
0
```

The rule is live in production lint, in both directions. Not inferred from a green run.

#### (3) T13 — full sweep

```
$ bun --filter='@pekulo/ui' run typecheck
@pekulo/ui typecheck: Exited with code 0

$ bun run lint
Found 4 warnings and 0 errors.        # all 4 pre-existing, none in this diff; exit 0
Finished in 1.0s on 980 files with 158 rules using 11 threads.

$ bunx oxfmt --check <every git-tracked ts/tsx/js/json/css file>
All matched files use the correct format.
Finished in 344ms on 1045 files using 11 threads.
# `bun run format:check` itself exits 1 on .claude/settings.local.json —
# untracked + gitignored, never present in CI's checkout. See deviation 7.

$ cd packages/ui && bun run test:visual     # vitest run --passWithNoTests --testNamePattern='snapshot'
 ✓ src/ds-coverage.meta.test.ts > every public component and primitive has a snapshot spec
 ↓ src/ds-coverage.meta.test.ts > every public component and primitive has an a11y spec
 Test Files  76 passed | 82 skipped (158)
      Tests  130 passed | 158 skipped (288)

$ cd packages/ui && bun run test:axe        # vitest run --passWithNoTests --testNamePattern='a11y'
 ↓ src/ds-coverage.meta.test.ts > every public component and primitive has a snapshot spec
 ✓ src/ds-coverage.meta.test.ts > every public component and primitive has an a11y spec
 Test Files  77 passed | 81 skipped (158)
      Tests  127 passed | 161 skipped (288)

$ cd packages/ui && bun run test
 Test Files  158 passed (158)
      Tests  287 passed | 1 skipped (288)
# the 1 skip is PekuloResizable.a11y "(skipped — happy-dom limitation)",
# pre-existing since story 4-3 (a303e4a).

$ bash .aped/scripts/validate-epic-context.sh docs/epics-context/epic-10-context.md
EXIT=0
```

Each filtered script verifies its own half of the contract: `test:visual` runs the snapshot meta-assertion and skips the a11y one, `test:axe` does the reverse. Neither gate can go green on an incomplete suite.

## Review Record

**Date:** 2026-08-25
**Auditors:** Spec, Code, Aria · **Edge & hallucination — did not report** (two dispatches, no structured verdict; the Lead ran its brief directly: disk-vs-public-surface cross-check, count reconciliation, identical-variant sweep, clock-independence)
**Verdict:** done — 12 findings, 11 resolved, 1 recorded for `10-2` / G1

The suite the story shipped held up under attack: AC-2, AC-3, AC-4 and AC-5 were each **reproduced independently** rather than read off the Dev Agent Record. What did not hold was the gate's reach — it enumerated two hard-coded folders while `src/index.ts` exports five, so three publicly-exported components sat outside it, one of them a real rendered `View` with no test at all.

### Findings

#### Resolved

- [MAJOR] The coverage gate enumerated `components/` + `primitives/` only, while `src/index.ts` also re-exports `toast/`, `provider/` and `animations/`. `PekuloToastViewport`, `ToastProvider` and `PekuloRootProvider` were outside it entirely. [`packages/ui/src/ds-coverage.meta.test.ts`]
  - Source: Lead. Proved with a control: the *same* component passed in `src/toast/` and failed in `src/primitives/`.
  - Impact: AC-1 ("every component `@pekulo/ui` exports **publicly**") and AC-3 were both partial. The Spec auditor rated AC-1 IMPLEMENTED off the meta-test, which is circular — the meta-test defined "public" as "inside one of two folders".
  - Resolution: `4801f80`. Gate now enumerates the barrel; a new `export * from "./x"` fails until covered or given a reason in `MODULE_EXEMPT`. Module scanning walks the whole folder, not just the index — an index-only scan stayed green on a component declared in a re-exported sibling (caught by re-running the probe). `PekuloToastViewport` + `ToastProvider` covered; `PekuloRootProvider` exempt **by documented decision** (mounts `next/script`, absent from this harness — `test/setup.tsx:44` hits the same wall) rather than by invisibility.

- [MAJOR] `outline: "none"` on three form primitives with nothing restoring it — keyboard-reachable, no visible indicator (NFR-24). [`PekuloInput.tsx:95`, `PekuloTextarea.tsx:22`, `PekuloNativeSelect.tsx:54`]
  - Source: Aria; verified by the Lead. Pre-existing on `main`; **not** reported by the dev, though the scope rule required it.
  - axe cannot see this (WCAG 2.4.7 is not machine-checkable), so the new a11y specs passed over it. `apps/web/.../form-controls.module.css` already existed to patch the same gap locally on radios.
  - Resolution: `825533e`. The reset had to leave the inline style — an inline declaration outranks any external `:focus-visible` rule. Shared `form-focus-ring.ts`, ring geometry matching `PekuloButton`.

- [MAJOR] `PekuloCalendar` frozen in `en-US`: English captions **and Sunday-first columns** inside a French app (NFR-22). [`PekuloCalendar.tsx:215`]
  - Source: Aria + Code; verified by the Lead. The dev reported this but only the `aria-label`/caption half — the column shift, which misaligns the whole grid, was missed.
  - Resolution: `9bbee53`. `locale={fr}` from react-day-picker's own re-export of `date-fns/locale` (no new dependency) + French nav labels. Capture now shows `lang="fr"`, `janvier 2026`, `lu ma me je ve sa di`, zero English strings.

- [MINOR] `docs/epics-context/epic-10-context.md` generated but never committed — T13's `git add -u` cannot stage an untracked file.
  - Source: Lead + Spec. Resolution: `ad38c29`.

- [MINOR] `PekuloDatePicker` trigger froze a 1px bordered transparent rect while `CategoryPicker`'s trigger — same role, same PR — was already the filled pill from `ux-preview:896-921`. Two idioms about to be frozen side by side; design-spec §1 bans borders. [`PekuloDatePicker.tsx:155`]
  - Source: Aria. Resolution: `c912410`.

- [MINOR] `PekuloEmpty outlined` froze a dashed container border with no reference backing and, per `git grep`, no consumer anywhere in the repo. [`PekuloEmpty.tsx:34`]
  - Source: Aria. Resolution: `c912410` — prop removed.

- [MINOR] `PekuloEmptyMedia` icon chip at 32px/`radius-lg` against the reference's 48px/`rounded-full` (`ux-preview:880`).
  - Source: Aria. Resolution: `c912410`.

- [MINOR] `PekuloResizable` snapshot passed `defaultSize`, which happy-dom cannot express (zero-size boxes → `flex-grow: 50` regardless), implying a split ratio the capture never asserted.
  - Source: Aria + dev self-disclosure. Resolution: `c912410` — prop dropped from the JSX, comment now states what the two cases *do* pin (the orientation contract) and what covering ratios would require.

- [NIT] Meta-test cited story line numbers (`:44`, `:46`, `:48`) that had already drifted to 47/49/51.
  - Source: Code. Resolution: re-anchored on the AC identifier, which does not move when the story grows — the numbers would have drifted again from this very Review Record.

- [NIT] The gate checked that a spec *file* existed, not that its titles carried the keyword its filtered script selects on.
  - Source: Aria, who read it as a future hole. It was already live: `TransactionLogo.snapshot.test.tsx` titled its `describe` without `snapshot`, so `test:visual` **skipped both its snapshots** (`↓ 2 tests | 2 skipped`). Resolution: `4801f80` — guard added, title fixed; the file now runs (`✓ 2 tests`).

- [NIT] Gate assertions were all "the gap list is empty", which is also what an enumeration returning nothing produces — a renamed folder would have read as green.
  - Source: Lead. Resolution: `4801f80` — floors on the enumeration.

#### Dismissed

- [MINOR] ~7 of the new captures freeze web-only CSS (`:focus-visible`, `::after`, `@keyframes`, `border-collapse`, literal-pixel blobs) with no React Native equivalent, which weakens the baseline for FR-56 — its stated purpose.
  - Source: Aria. Measured at review: **11 component sources** inject raw `<style>` blocks, `PekuloSkeleton` among them (outside this story's 23). This is the DS's deliberate implementation pattern — injected CSS keeps the primitives RSC-safe without a CSS-module dependency, documented in `PekuloButton.tsx:4-10`. Fixing it means re-architecting the styling layer, and the NFR-24 fix above **added one more**. That trade-off belongs to the G1 `aped-arch` re-run that gates `10-2`, not to a review pass.
  - Rationale: not fixable inside a review pass — it is an architecture decision about the DS styling layer, owned by the G1 `aped-arch` re-run that gates `10-2`. Carried forward so `10-2` does not assume these captures constitute a portable parity baseline.

- [NIT] `.aped/aped-review/scripts/git-audit.sh` looks for `### File List`; stories write `## File List`. With `set -euo pipefail`, the empty `grep` kills the script, which **exits 0 printing nothing** — indistinguishable from "audit clean". The Lead audited by hand instead.
  - Source: Lead.
  - Rationale: `.aped/` is the immutable engine per `CLAUDE.md`; patching it here would be overwritten by the next APED update. Belongs upstream in APED. Flagged to the user.

### Verification

Captured fresh at the end of the fix cycle, not carried over from an earlier turn:

```
$ bun --filter='@pekulo/ui' run typecheck        exit 0
$ bun run lint                                   exit 0 — 4 warnings, 0 errors (all 4 pre-existing, none in this diff)
$ cd packages/ui && bun run test                 exit 0 — Test Files 158 passed | Tests 294 passed | 1 skipped (295)
$ cd packages/ui && bun run test:visual          exit 0 — Test Files 77 passed | Tests 137 passed
$ cd packages/ui && bun run test:axe             exit 0 — Test Files 77 passed | Tests 130 passed
```

Counts moved 287 → 294 passing: 3 `PekuloToastViewport` snapshots, 1 viewport a11y spec, 3 new gate assertions. `test:visual` moved 130 → 137, which includes the 2 `TransactionLogo` snapshots the keyword bug had been skipping.

Gate probes, each cleaned up and the tree verified clean afterwards:

| Probe | Before | After |
|---|---|---|
| Public component added to `src/toast/` | passed | fails naming `PekuloZzGateProbe` |
| New module added to the root barrel | passed | fails naming `__zzmod` |
| Spec titled without its keyword | passed | fails naming the file |
| Public component added to `src/primitives/` | fails (control) | fails (control) |

**Visual verification:** Aria ran **degraded — React Grab MCP unavailable in this session**, as it was for the dev (deviation 8). Verdict rests on captured snapshot strings, component sources, and `docs/ux-preview/src/App.tsx` citations; no rendered-pixel comparison was performed. The three reference-divergence findings (`m2`, `m3`, `m4`) were fixed against ux-preview line ranges rather than against pixels, and are worth a live pass when the MCP is available.

**One correction to the auditors' reports for the record:** Aria counted "25 test cases" across the 23 new snapshot files; the actual figure is 43. Its no-identical-pairs conclusion was independently confirmed by the Lead across all 43 and stands.
