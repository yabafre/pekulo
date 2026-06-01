# Story: 6-8-category-taxonomy-expansion — Expand category taxonomy + category icons (DR-13)

**Epic:** Epic 6 — LLM auto-categorisation
**Status:** done
**Ticket:** none — a GitHub issue is created when this story enters a sprint (`sprint.stories.6-8.ticket: null`)
**Branch:** feature/none-6-8-category-taxonomy-expansion
**Covered FRs:** none (implements **DR-13** — richer category taxonomy + per-category display icons; no compass/budget remap)
**Binds:** DR-13 (taxonomy + icons, NO compass remap) · NFR-8 (RLS unchanged — no schema change) · NFR-12 (prompt allowlist derives from the suggestable set) · NFR-22/23/24 (icons are `aria-hidden`; categories announced via text label) · the 2026-05-30 enum-narrowing lesson (new categories enter the suggestable subset AND the closed enum, never a forged audit route)
**Commit prefix:** `feat(6-8): …` (no ticket — references DR-13 in bodies)

## User Story

**As a** Pekulo user, **I want** richer categories (factures, restauration, abonnements, retrait) each with an icon, **so that** the AI categorisation covers my real spending and the UI is readable.

> **Scope guard (locked at aped-story step 04):** this story ships DR-13 only — (1) **four new categories** (`factures`, `restauration`, `abonnements`, `retrait`) added to the closed `TRANSACTION_CATEGORIES` enum, its French label map, and the `SUGGESTABLE_TRANSACTION_CATEGORIES` subset in `@pekulo/validators`; (2) a **per-category lucide icon** map + `<CategoryIcon>` component in `@pekulo/ui`, surfaced in **`CategoryPicker`**, **`PekuloSuggestionRow`**, the **activity rows** (Récentes), and the **create/edit transaction selects** (user chose "icônes partout" at step 04); (3) a one-line **SSOT consolidation** so `apps/api` imports the validators suggestable set instead of re-deriving it (kills the prompt-allowlist drift risk). It does **NOT** ship: any DB schema/migration (the `transactions.category` column is already a free `String` — see Step-0); any compass/budget/monthly-aggregate remap (DR-13 forbids it); merchant logos (→ story **6-10**, which falls back to these icons); new categories outside the four named above.

## Acceptance Criteria

- **AC-1 (LLM may suggest the four new categories — DR-13)** — **Given** the expanded taxonomy, **When** the LLM categorises a non-transfer transaction, **Then** `factures` / `restauration` / `abonnements` / `retrait` are valid suggestion targets — they appear in the categorisation prompt's allowed-category list, and a completion returning one of them is accepted as the suggestion (no longer discarded as out-of-list).
- **AC-2 (Every category renders its icon — DR-13)** — **Given** the category picker, the suggestion rows, the Récentes activity rows, and the create/edit category selects, **When** a category is displayed, **Then** its lucide icon is rendered `aria-hidden` (categories stay announced via their text label), with a neutral fallback glyph for any unmapped category. A `transfer` row still shows the left-right arrow (story 5-3 AC-8 caption glyph preserved).
- **AC-3 (No CHECK / RLS regression — NFR-8)** — **Given** `prisma:check` and `db:rls-audit`, **When** the gate runs, **Then** both pass with **no schema change**: `prisma format --check && prisma validate` is clean (`category` stays a free `String`, no enum/CHECK constraint exists or is added) and every table's RLS policy count is unchanged.
- **AC-4 (Type-level taxonomy guards hold — compile-time)** — **Given** `turbo run typecheck`, **When** it runs, **Then** the taxonomy's compile-time guards hold for all 17 values — every category has a French label and every suggestable value is a member of the closed enum — and all `apps/api` / `apps/web` / `@pekulo/ui` consumers compile against the widened category union.
- **AC-5 (DR-13 — no compass/budget remap)** — **Given** this story's diff, **When** reviewed, **Then** it touches **no** compass, monthly-tracking, or budget aggregation file; the new categories carry display semantics only.
- **AC-6 (Iron-Law gates)** — **Given** the branch, **When** the full gate set runs, **Then** all pass: `oxlint` → 0 ; `turbo run typecheck` → 0 ; `bun:test` (api, incl. the new taxonomy test) → all pass ; `vitest` (`@pekulo/ui` + `@pekulo/web`, incl. the new `CategoryIcon` test and the updated suggestion snapshot) → all pass ; `prisma:check` → valid ; `db:rls-audit` → exit 0, policy counts unchanged.

## Tasks

> Every task is self-contained — full code, the literal run command, expected output and the literal commit live under **Dev Notes → Task-by-task implementation code**. Run each on `feature/none-6-8-category-taxonomy-expansion`. `apps/api` tests are `bun:test`; `@pekulo/ui` + `@pekulo/web` tests are `vitest`. Every workspace command uses the fully-qualified quoted name `bun --filter='@pekulo/<pkg>'` (NEVER `=api`, NEVER `--cwd` — lessons 2026-05-19 / 2026-05-05). `apps/web` runs a non-standard Next.js — read `node_modules/next/dist/docs/` before changing routing/RSC shapes (apps/web/AGENTS.md); the patterns below are copied from already-passing 6-4 code. The four new categories propagate to every dropdown automatically (the selects iterate the enum / suggestable set) — the only net-new work is the icon component + its call sites + the data additions.

- [x] **T1** — Add `factures`/`restauration`/`abonnements`/`retrait` to `TRANSACTION_CATEGORIES`, `TRANSACTION_CATEGORY_LABELS`, `SUGGESTABLE_TRANSACTION_CATEGORIES` in `@pekulo/validators` [AC: AC-1, AC-4]
- [x] **T2** — New `@pekulo/ui` `CategoryIcon` component + `CATEGORY_ICONS` map + barrel + `components/index.ts` export + unit test [AC: AC-2]
- [x] **T3** — Add an optional leading-`icon` slot to `PekuloSelect.Item` (primitive) [AC: AC-2]
- [x] **T4** — `CategoryPicker` renders `<CategoryIcon category={opt.value} />` per item [AC: AC-2]
- [x] **T5** — `PekuloSuggestionRow` gains a `categoryIcon?` prop (rendered after the Sparkles AI marker) + new snapshot case [AC: AC-2]
- [x] **T6** — `apps/api` `transactions.service.ts` imports the validators suggestable SSOT (drop the re-derivation) + new `transaction-categories.test.ts` [AC: AC-1, AC-3, AC-4]
- [x] **T7** — Web: pass `categoryIcon` in `transactions-suggestions-section.tsx`; resolve `categoryPrefix` via `<CategoryIcon>` for all rows in `transactions-recent-section.tsx` [AC: AC-2]
- [x] **T8** — Web: render `<CategoryIcon>` in the `transaction-create-form.tsx` + `transaction-edit-form.tsx` category selects [AC: AC-2]
- [x] **T9** — Full Iron-Law gate (`oxlint`, `turbo run typecheck`, api `bun:test`, ui+web `vitest`, `prisma:check`, `db:rls-audit`) + push [AC: AC-3, AC-5, AC-6]

## Dev Notes

### Architecture & decisions

- **PRIMARY ADRs — 0011 (`@pekulo/*` namespace, domain types in `@pekulo/types`, validators are the zod SSOT), 0007 (Tamagui Core / `@pekulo/ui` only), 0010 (Component → Hook → Server Action → … boundary — only data + presentational changes here), 0013 (explicit `where:{userId}` — untouched, no repository change).**
- **No DB migration.** `transactions.category` is a free Postgres `String` with **no enum and no CHECK constraint** (Step-0 below + a migrations grep returned nothing). New enum values are new *string* values the column already accepts. AC-3 is therefore a **regression guard**, not a change — `prisma:check` and `db:rls-audit` must stay green with policy counts unchanged.
- **Decisions locked at step 04 (this story):**
  - **Q1 — Where does the category→icon map live?** In **`@pekulo/ui`** (`CategoryIcon/CategoryIcon.tsx`), keyed by the **raw category value** (plain string literals). `@pekulo/ui` stays free of a `@pekulo/validators` import (the map carries no type dependency — it is a `Record<string, IconComponent>` with a `Tag` fallback), matching the CategoryPicker "presentation-only" rule. Rows receive the *label* (not the key) so the **consumer** resolves the icon from the raw DTO key and passes the element in; `CategoryPicker` and the form selects have the raw `value`/`c` so they resolve it themselves.
  - **Q2 — Suggestion chip placement (user choice).** Keep the **`Sparkles` AI marker AND add the category icon** before the label: `✨ 🛒 Courses`. Both 12 px grayscale (`var(--colorSecondary)`), TR-strict (no `$accent`/emerald on LLM chrome — lesson 2026-05-07).
  - **Q3 — Icon mapping (user-confirmed, all 17 categories).** `salaire→Banknote · freelance→Laptop · remote→MonitorSmartphone · bonus→Gift · loyer→House · courses→ShoppingCart · transport→TramFront · sorties→Martini · voyage→Plane · sante→HeartPulse · imprevu→TriangleAlert · autre→Tag (= fallback) · transfer→ArrowLeftRight · factures→ReceiptText · restauration→Utensils · abonnements→RefreshCw · retrait→Landmark`. All names verified present in the installed `lucide-react@1.11.0` (see Dev Agent Record → Deviations; `1.14.0` lives only in `docs/ux-preview/`).
  - **Q4 — Icons "partout" (user choice).** The create/edit transaction selects (raw `PekuloSelect`, not `CategoryPicker`) also get icons → `PekuloSelect.Item` grows an optional leading-`icon` slot (T3) used by `CategoryPicker` + both forms.
  - **Q5 — SSOT consolidation (proposed + validated).** `apps/api` `transactions.service.ts` currently re-derives `SUGGESTABLE_CATEGORIES = TRANSACTION_CATEGORIES.filter(c => c !== "transfer" && c !== "autre")`. Replace with an import of `SUGGESTABLE_TRANSACTION_CATEGORIES` from `@pekulo/validators` (identical set) so the LLM prompt allowlist can never drift from `confirmCategorisation`'s narrowed input. `TRANSACTION_CATEGORIES` was used only by that filter (line 42 import, line 107 use) — swap the import, no orphan.
- **`llm-prompt-builder.ts` is NOT edited.** It is category-agnostic — `buildCategorisationPrompt(envelope, categories)` takes the allowlist as a parameter. The allowlist flows from `transactions.service.ts#SUGGESTABLE_CATEGORIES`, so adding to the enum (+ T6) threads the four new categories through automatically.
- **Lessons applied:** 2026-05-30 (enum-narrowing) — new categories go in the suggestable subset (a trusted write) AND the full enum; the FoundationModels `attestLlmCallSchema.route` literal is untouched. 2026-05-24 (tamagui.generated.css) — `CategoryIcon` adds **no** `styled()`/token/variant (it renders a raw lucide SVG), so **no CSS regen** is required. 2026-05-19 / 2026-05-05 — workspace-filter + no `--cwd` in commands. 2026-05-31 (doc-sync) — this is scoped work, `epics.md`/the epic-6 cache already describe it; no ADR.

### Step-0 — existing code at write time (verbatim)

**`packages/validators/src/transactions/transactions.schemas.ts`** (current — 13-value enum, 11-value suggestable; header comment is already stale at "12 closed enum"):
```ts
// covering the DTO + 5 inputs + cursor pagination + ok envelope. Categories
// (12 closed enum) + French labels exported for UI consumers.
// (unchanged lines omitted)
export const TRANSACTION_CATEGORIES = [
  "salaire", "freelance", "remote", "bonus", "loyer", "courses",
  "transport", "sorties", "voyage", "sante", "imprevu", "autre", "transfer",
] as const;

export const TRANSACTION_CATEGORY_LABELS: Record<(typeof TRANSACTION_CATEGORIES)[number], string> =
  {
    salaire: "Salaire", freelance: "Freelance", remote: "Remote", bonus: "Bonus",
    loyer: "Loyer", courses: "Courses", transport: "Transport", sorties: "Sorties",
    voyage: "Voyage", sante: "Santé", imprevu: "Imprévu", autre: "Autre", transfer: "Transfert",
  };
// (unchanged lines omitted)
export const SUGGESTABLE_TRANSACTION_CATEGORIES = [
  "salaire", "freelance", "remote", "bonus", "loyer", "courses",
  "transport", "sorties", "voyage", "sante", "imprevu",
] as const;
// Compile-time guard: every suggestable value is a real TransactionCategory.
const suggestableSubsetGuard: readonly TransactionCategory[] = SUGGESTABLE_TRANSACTION_CATEGORIES;
void suggestableSubsetGuard;
```

**`apps/api/src/modules/transactions/transactions.service.ts:42` + `:104-109`** (current — re-derives the suggestable set; `TRANSACTION_CATEGORIES` is imported only for this):
```ts
import { TRANSACTION_CATEGORIES } from "@pekulo/validators";
// (unchanged lines omitted)
// Categories the LLM may suggest — the closed transaction enum minus the two
// system values: 'transfer' (rule-owned, story 5-3) and 'autre' (the fallback
// the suggestion would replace).
const SUGGESTABLE_CATEGORIES: readonly string[] = TRANSACTION_CATEGORIES.filter(
  (c) => c !== "transfer" && c !== "autre",
);
```

**`apps/api/prisma/schema/transactions.prisma:17`** (current — free String, no enum/CHECK ⇒ no migration for new values):
```prisma
  category              String
```

**`packages/ui/src/primitives/PekuloSelect.tsx:180-207`** (current `Item` — `children` land *inside* `<TamaSelect.ItemText>`, so an icon must be a sibling before it, not a child):
```tsx
function Item({
  children,
  ...props
}: ComponentProps<typeof TamaSelect.Item> & { children: ReactNode }) {
  return (
    <TamaSelect.Item
      data-slot="select-item"
      paddingHorizontal="$2"
      paddingVertical="$2"
      paddingRight={28}
      borderRadius="$md"
      cursor="pointer"
      flexDirection="row"
      alignItems="center"
      gap="$2"
      hoverStyle={{ backgroundColor: "$backgroundMuted" }}
      focusStyle={{ backgroundColor: "$backgroundMuted" }}
      {...props}
    >
      <TamaSelect.ItemText color="$color" fontSize="$bodySm">
        {children}
      </TamaSelect.ItemText>
      <TamaSelect.ItemIndicator marginLeft="auto">
        <Check size={14} aria-hidden={true} color="var(--color)" />
      </TamaSelect.ItemIndicator>
    </TamaSelect.Item>
  );
}
```

**`packages/ui/src/components/CategoryPicker/CategoryPicker.tsx:39-46`** (current — maps options to plain Items, no icon):
```tsx
        <PekuloSelect.Group>
          {options.map((opt, i) => (
            <PekuloSelect.Item key={opt.value} value={opt.value} index={i}>
              {opt.label}
            </PekuloSelect.Item>
          ))}
        </PekuloSelect.Group>
```

**`packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.tsx:58-66` + chip `:95-101`** (current — props + the chip that shows Sparkles + the suggested-category text):
```tsx
export interface PekuloSuggestionRowProps {
  tx: Suggestion;
  onConfirm?: () => void;
  onEdit?: () => void;
  disabled?: boolean;
}

export function PekuloSuggestionRow({ tx, onConfirm, onEdit, disabled }: PekuloSuggestionRowProps) {
  const Arrow = tx.direction === "in" ? ArrowDownRight : ArrowUpRight;
  // (unchanged lines omitted)
          {/* Sparkles is chrome (icon next to a label), not a perf delta — TR-strict
              keeps it on the grayscale ramp. */}
          <Sparkles size={12} color="var(--colorSecondary)" />
          <Text color="$colorSecondary" fontSize="$xs">
            {tx.suggestedCategory}
          </Text>
```

**`apps/web/.../transactions-recent-section.tsx:17` + `:179-191`** (current — transfer-only prefix; `tx.category` here is the RAW DTO key):
```tsx
import { ArrowLeftRight, MoreHorizontal, Search, Upload } from "lucide-react";
// (unchanged lines omitted)
            const categoryPrefix =
              tx.category === "transfer" ? (
                <ArrowLeftRight
                  size={14}
                  color="var(--colorTertiary)"
                  aria-hidden
                  style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}
                />
              ) : undefined;
            return (
              <View key={tx.id} role="listitem" flexDirection="row" alignItems="center" gap="$3">
                <View flex={1} minWidth={0}>
                  <PekuloActivityRow tx={activity} categoryPrefix={categoryPrefix} />
                </View>
```

**`apps/web/.../transactions-suggestions-section.tsx:160-169`** (current — builds the `Suggestion` and renders the row; `tx.suggestedCategory` is the RAW DTO key, the label is set on the `suggestion` object):
```tsx
              return (
                <View key={tx.id} role="listitem">
                  <PekuloSuggestionRow
                    tx={suggestion}
                    disabled={confirm.isPending}
                    onConfirm={() =>
                      tx.suggestedCategory && runConfirm(tx.id, tx.suggestedCategory)
                    }
                    onEdit={() => openOverride(tx)}
                  />
                </View>
              );
```

**`apps/web/.../transaction-create-form.tsx:219-223`** and **`apps/web/.../transaction-edit-form.tsx:183-187`** (current — identical item shape, mapping over `TRANSACTION_CATEGORIES`):
```tsx
                      {TRANSACTION_CATEGORIES.map((c, i) => (
                        <PekuloSelect.Item key={c} value={c} index={i}>
                          {TRANSACTION_CATEGORY_LABELS[c]}
                        </PekuloSelect.Item>
                      ))}
```

**New files (no prior state):** `packages/ui/src/components/CategoryIcon/CategoryIcon.tsx`, `…/CategoryIcon/index.ts`, `…/CategoryIcon/CategoryIcon.test.tsx`, `apps/api/src/modules/transactions/transaction-categories.test.ts`.

### File decisions (one responsibility each)

| File | Responsibility | In / Out |
|------|----------------|----------|
| `packages/validators/src/transactions/transactions.schemas.ts` (MOD) | Zod SSOT for the transactions aggregate, incl. the category taxonomy + labels + suggestable subset. | imports `@pekulo/zod`; exports `TRANSACTION_CATEGORIES`, `TRANSACTION_CATEGORY_LABELS`, `SUGGESTABLE_TRANSACTION_CATEGORIES`, schemas. |
| `packages/ui/src/components/CategoryIcon/CategoryIcon.tsx` (NEW) | Presentational category-value → lucide icon resolution, with `Tag` fallback, free of `@pekulo/validators`. | imports `lucide-react`; exports `CATEGORY_ICONS`, `CategoryIcon`. |
| `packages/ui/src/components/CategoryIcon/index.ts` (NEW) | Barrel. | `export * from "./CategoryIcon"`. |
| `packages/ui/src/components/index.ts` (MOD) | `@pekulo/ui` components barrel. | + `export * from "./CategoryIcon"` (alphabetical, before CategoryPicker). |
| `packages/ui/src/primitives/PekuloSelect.tsx` (MOD) | shadcn-parity Select on Tamagui; `Item` gains an optional leading-icon slot. | + `icon?: ReactNode` on `Item`, rendered before `ItemText`. |
| `packages/ui/src/components/CategoryPicker/CategoryPicker.tsx` (MOD) | Shared category `<select>` for the override flow; now shows each option's icon. | resolves `<CategoryIcon category={opt.value} />` internally. |
| `packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.tsx` (MOD) | LLM-pending suggestion row; chip now shows `✨ <icon> <label>`. | + `categoryIcon?: ReactNode` prop. |
| `apps/api/src/modules/transactions/transactions.service.ts` (MOD) | Transactions domain logic; LLM allowlist now = validators SSOT. | import `SUGGESTABLE_TRANSACTION_CATEGORIES`, drop the filter. |
| `apps/web/.../transactions-suggestions-section.tsx` (MOD) | Suggestions IA section — pass the category icon to the row. | + `categoryIcon={<CategoryIcon … />}`. |
| `apps/web/.../transactions-recent-section.tsx` (MOD) | Récentes list — category icon prefix for every row. | `categoryPrefix` resolved via `<CategoryIcon>`; drop `ArrowLeftRight` import. |
| `apps/web/.../transaction-create-form.tsx` + `transaction-edit-form.tsx` (MOD) | Manual create/edit category selects — icons in items. | + `icon={<CategoryIcon … />}` on each Item. |
| `apps/api/.../transaction-categories.test.ts` (NEW) | Runtime guard: 4 new ∈ enum + label + suggestable; suggestable = enum − {transfer, autre}. | `bun:test`, imports `@pekulo/validators`. |
| `…/CategoryIcon.test.tsx` (NEW) + `PekuloSuggestionRow.snapshot.test.tsx` (MOD) | Icon coverage + suggestion-chip snapshot with icon. | `vitest`. |

### Task-by-task implementation code

#### T1 — Extend the taxonomy in `@pekulo/validators`

In `packages/validators/src/transactions/transactions.schemas.ts`:

1. Fix the stale header comment (line ~4): replace `// (12 closed enum) + French labels exported for UI consumers.` with:
```ts
// (17 closed enum) + French labels exported for UI consumers.
```

2. Replace the `TRANSACTION_CATEGORIES` constant with (four new values inserted after `imprevu`, before the system values `autre`/`transfer` so the suggestable block stays contiguous):
```ts
export const TRANSACTION_CATEGORIES = [
  "salaire",
  "freelance",
  "remote",
  "bonus",
  "loyer",
  "courses",
  "transport",
  "sorties",
  "voyage",
  "sante",
  "imprevu",
  "factures",
  "restauration",
  "abonnements",
  "retrait",
  "autre",
  "transfer",
] as const;
```

3. Replace the `TRANSACTION_CATEGORY_LABELS` map with (four new French labels added — completeness is enforced by the `Record<(typeof TRANSACTION_CATEGORIES)[number], string>` type, so a missing label fails typecheck):
```ts
export const TRANSACTION_CATEGORY_LABELS: Record<(typeof TRANSACTION_CATEGORIES)[number], string> =
  {
    salaire: "Salaire",
    freelance: "Freelance",
    remote: "Remote",
    bonus: "Bonus",
    loyer: "Loyer",
    courses: "Courses",
    transport: "Transport",
    sorties: "Sorties",
    voyage: "Voyage",
    sante: "Santé",
    imprevu: "Imprévu",
    factures: "Factures",
    restauration: "Restauration",
    abonnements: "Abonnements",
    retrait: "Retrait",
    autre: "Autre",
    transfer: "Transfert",
  };
```

4. Replace the `SUGGESTABLE_TRANSACTION_CATEGORIES` constant with (the four new values added — they are real user-spend categories the LLM should suggest; `suggestableSubsetGuard` below stays unchanged and enforces each is a real `TransactionCategory`):
```ts
export const SUGGESTABLE_TRANSACTION_CATEGORIES = [
  "salaire",
  "freelance",
  "remote",
  "bonus",
  "loyer",
  "courses",
  "transport",
  "sorties",
  "voyage",
  "sante",
  "imprevu",
  "factures",
  "restauration",
  "abonnements",
  "retrait",
] as const;
```

Run: `bun --filter='@pekulo/validators' run typecheck`
Expected: no output, exit 0 (label completeness + suggestable-subset guards hold).
Commit: `git add packages/validators/src/transactions/transactions.schemas.ts && git commit -m "feat(6-8): add factures/restauration/abonnements/retrait to category taxonomy (DR-13)"`

#### T2 — `CategoryIcon` component + map + barrel + export + test

Create `packages/ui/src/components/CategoryIcon/CategoryIcon.tsx`:
```tsx
"use client";

import type { ComponentType, CSSProperties } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Gift,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Martini,
  MonitorSmartphone,
  Plane,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  Tag,
  TramFront,
  TriangleAlert,
  Utensils,
} from "lucide-react";

// lucide icon component shape (the subset of props we pass + a style passthrough).
type IconProps = {
  size?: number | string;
  color?: string;
  style?: CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
};
type IconComponent = ComponentType<IconProps>;

// Per-category display icon (DR-13). Keyed by the RAW category value (the
// @pekulo/validators string literals) so @pekulo/ui carries no
// @pekulo/validators dependency — the keys are plain strings. Any key absent
// here (or a future un-mapped value) falls back to <Tag>. 'transfer' maps to
// ArrowLeftRight, preserving the story 5-3 AC-8 caption glyph.
export const CATEGORY_ICONS: Record<string, IconComponent> = {
  salaire: Banknote,
  freelance: Laptop,
  remote: MonitorSmartphone,
  bonus: Gift,
  loyer: House,
  courses: ShoppingCart,
  transport: TramFront,
  sorties: Martini,
  voyage: Plane,
  sante: HeartPulse,
  imprevu: TriangleAlert,
  autre: Tag,
  transfer: ArrowLeftRight,
  factures: ReceiptText,
  restauration: Utensils,
  abonnements: RefreshCw,
  retrait: Landmark,
};

export interface CategoryIconProps {
  /** Raw category value (e.g. "courses"), NOT the display label. */
  category: string;
  size?: number;
  color?: string;
  style?: CSSProperties;
}

// Presentational category → lucide icon. Always aria-hidden: rows / pickers
// announce the category via its text label, never the glyph (NFR-22/24).
// Unknown keys render <Tag> so a category added to the enum without a map
// entry still renders something neutral instead of crashing.
export function CategoryIcon({
  category,
  size = 14,
  color = "var(--colorTertiary)",
  style,
}: CategoryIconProps) {
  const Icon = CATEGORY_ICONS[category] ?? Tag;
  return <Icon size={size} color={color} style={style} aria-hidden={true} />;
}
```

Create `packages/ui/src/components/CategoryIcon/index.ts`:
```ts
export * from "./CategoryIcon";
```

In `packages/ui/src/components/index.ts`, add the export in alphabetical order — immediately **before** the `CategoryPicker` line (`CategoryIcon` < `CategoryPicker`):
```ts
export * from "./CategoryIcon";
export * from "./CategoryPicker";
```

Create `packages/ui/src/components/CategoryIcon/CategoryIcon.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { CategoryIcon, CATEGORY_ICONS } from "./CategoryIcon";

describe("CategoryIcon", () => {
  it("maps every known category (incl. the four new) to an icon", () => {
    const keys = [
      "salaire", "freelance", "remote", "bonus", "loyer", "courses",
      "transport", "sorties", "voyage", "sante", "imprevu", "autre",
      "transfer", "factures", "restauration", "abonnements", "retrait",
    ] as const;
    for (const k of keys) {
      expect(CATEGORY_ICONS[k]).toBeDefined();
    }
  });

  it("renders an aria-hidden svg for a known category", () => {
    const { container } = renderWithTamagui(<CategoryIcon category="courses" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("class")).toContain("lucide-shopping-cart");
  });

  it("falls back to the Tag icon for an unknown category", () => {
    const { container } = renderWithTamagui(<CategoryIcon category="does-not-exist" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("lucide-tag");
  });

  it("maps transfer to arrow-left-right (preserves 5-3 AC-8 glyph)", () => {
    const { container } = renderWithTamagui(<CategoryIcon category="transfer" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "lucide-arrow-left-right",
    );
  });
});
```

Run: `bun --filter='@pekulo/ui' run test -- CategoryIcon`
Expected: `Test Files  1 passed`, `Tests  4 passed`, exit 0.
Commit: `git add packages/ui/src/components/CategoryIcon packages/ui/src/components/index.ts && git commit -m "feat(6-8): add CategoryIcon (lucide per-category map) to @pekulo/ui (DR-13)"`

#### T3 — Optional leading-`icon` slot on `PekuloSelect.Item`

In `packages/ui/src/primitives/PekuloSelect.tsx`, replace the `Item` function (lines ~180-207) with (destructure `icon` out of props so it never leaks onto `TamaSelect.Item`, render it before `ItemText`; when `undefined` it renders nothing → existing snapshots unchanged):
```tsx
function Item({
  children,
  icon,
  ...props
}: ComponentProps<typeof TamaSelect.Item> & { children: ReactNode; icon?: ReactNode }) {
  return (
    <TamaSelect.Item
      data-slot="select-item"
      paddingHorizontal="$2"
      paddingVertical="$2"
      paddingRight={28}
      borderRadius="$md"
      cursor="pointer"
      flexDirection="row"
      alignItems="center"
      gap="$2"
      hoverStyle={{ backgroundColor: "$backgroundMuted" }}
      focusStyle={{ backgroundColor: "$backgroundMuted" }}
      {...props}
    >
      {icon}
      <TamaSelect.ItemText color="$color" fontSize="$bodySm">
        {children}
      </TamaSelect.ItemText>
      <TamaSelect.ItemIndicator marginLeft="auto">
        <Check size={14} aria-hidden={true} color="var(--color)" />
      </TamaSelect.ItemIndicator>
    </TamaSelect.Item>
  );
}
```

Run: `bun --filter='@pekulo/ui' run test -- PekuloSelect`
Expected: the existing `PekuloSelect.snapshot.test.tsx` + `PekuloSelect.a11y.test.tsx` still pass (no test passes `icon`), `Tests  … passed`, exit 0.
Commit: `git add packages/ui/src/primitives/PekuloSelect.tsx && git commit -m "feat(6-8): add optional leading-icon slot to PekuloSelect.Item (DR-13)"`

#### T4 — `CategoryPicker` renders the per-option icon

In `packages/ui/src/components/CategoryPicker/CategoryPicker.tsx`:

1. Add the import below the existing `PekuloSelect` import:
```tsx
import { CategoryIcon } from "../CategoryIcon";
```

2. Replace the options `.map(...)` (lines ~40-44) with (resolve the icon internally from the raw `opt.value`):
```tsx
          {options.map((opt, i) => (
            <PekuloSelect.Item
              key={opt.value}
              value={opt.value}
              index={i}
              icon={<CategoryIcon category={opt.value} size={16} />}
            >
              {opt.label}
            </PekuloSelect.Item>
          ))}
```

Run: `bun --filter='@pekulo/ui' run test -- CategoryPicker`
Expected: `CategoryPicker.a11y.test.tsx` passes — trigger is still a `combobox` `<button>`, axe reports 0 serious/critical (the icons are `aria-hidden`). `Tests  1 passed`, exit 0.
Commit: `git add packages/ui/src/components/CategoryPicker/CategoryPicker.tsx && git commit -m "feat(6-8): show category icons in CategoryPicker options (DR-13)"`

#### T5 — `PekuloSuggestionRow` `categoryIcon` prop + snapshot case

In `packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.tsx`:

1. Add `categoryIcon` to the props interface:
```tsx
export interface PekuloSuggestionRowProps {
  tx: Suggestion;
  onConfirm?: () => void;
  onEdit?: () => void;
  disabled?: boolean;
  // Story 6-8 — category glyph rendered after the Sparkles AI marker in the
  // chip. The consumer resolves <CategoryIcon> from the raw category key (the
  // row's `tx.suggestedCategory` is the display label, not the key).
  categoryIcon?: ReactNode;
}
```

2. Destructure it in the function signature:
```tsx
export function PekuloSuggestionRow({
  tx,
  onConfirm,
  onEdit,
  disabled,
  categoryIcon,
}: PekuloSuggestionRowProps) {
```

3. Render it between the `Sparkles` icon and the category `Text` in the chip:
```tsx
          {/* Sparkles is chrome (icon next to a label), not a perf delta — TR-strict
              keeps it on the grayscale ramp. */}
          <Sparkles size={12} color="var(--colorSecondary)" />
          {categoryIcon}
          <Text color="$colorSecondary" fontSize="$xs">
            {tx.suggestedCategory}
          </Text>
```

In `packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.snapshot.test.tsx`:

4. Add the `CategoryIcon` import at the top (after the existing imports):
```tsx
import { CategoryIcon } from "../CategoryIcon";
```

5. Add a third test case before the closing `});` of the `describe` block (leave the inline snapshot empty — `vitest run` auto-populates it on first run):
```tsx
  it("renders the category icon when provided", () => {
    const { container } = renderWithTamagui(
      <PekuloSuggestionRow
        tx={{
          label: "Netflix",
          account: "CB Bourso",
          dateLabel: "03 mai",
          direction: "out",
          amountEur: 14,
          suggestedCategory: "Abonnements",
          confidence: 0.88,
          route: "ollama",
        }}
        categoryIcon={
          <CategoryIcon category="abonnements" size={12} color="var(--colorSecondary)" />
        }
        onConfirm={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(container.querySelector("svg.lucide-refresh-cw")).not.toBeNull();
    expect(container.innerHTML).toMatchInlineSnapshot();
  });
```

Run: `bun --filter='@pekulo/ui' run test -- PekuloSuggestionRow`
Expected: the two existing cases still pass unchanged (they pass no `categoryIcon`); the new case populates its inline snapshot and passes. `Tests  3 passed`, exit 0.
Commit: `git add packages/ui/src/components/PekuloSuggestionRow && git commit -m "feat(6-8): add categoryIcon slot to PekuloSuggestionRow chip (DR-13)"`

#### T6 — `apps/api` SSOT consolidation + taxonomy test

In `apps/api/src/modules/transactions/transactions.service.ts`:

1. Replace the line-42 import:
```ts
import { TRANSACTION_CATEGORIES } from "@pekulo/validators";
```
with:
```ts
import { SUGGESTABLE_TRANSACTION_CATEGORIES } from "@pekulo/validators";
```

2. Replace the `SUGGESTABLE_CATEGORIES` derivation (lines ~104-109) with the imported SSOT:
```ts
// Categories the LLM may suggest — the validators SSOT (the closed transaction
// enum minus the two system values 'transfer'/'autre'). Story 6-8 stopped
// re-deriving this here so the prompt allowlist can never drift from
// confirmCategorisation's narrowed input schema.
const SUGGESTABLE_CATEGORIES: readonly string[] = SUGGESTABLE_TRANSACTION_CATEGORIES;
```

Create `apps/api/src/modules/transactions/transaction-categories.test.ts`:
```ts
// bun:test — category taxonomy guard (story 6-8, DR-13). Proves the four new
// categories are wired into the closed enum, labelled, and LLM-suggestable,
// and that the suggestable subset stays = enum minus the two system values.
import { describe, it, expect } from "bun:test";
import {
  TRANSACTION_CATEGORIES,
  TRANSACTION_CATEGORY_LABELS,
  SUGGESTABLE_TRANSACTION_CATEGORIES,
} from "@pekulo/validators";

const NEW_CATEGORIES = ["factures", "restauration", "abonnements", "retrait"] as const;

describe("category taxonomy (story 6-8, DR-13)", () => {
  it("registers the four new categories in the closed enum", () => {
    for (const c of NEW_CATEGORIES) {
      expect(TRANSACTION_CATEGORIES).toContain(c);
    }
  });

  it("gives every category a non-empty French label", () => {
    for (const c of TRANSACTION_CATEGORIES) {
      expect(typeof TRANSACTION_CATEGORY_LABELS[c]).toBe("string");
      expect(TRANSACTION_CATEGORY_LABELS[c].length).toBeGreaterThan(0);
    }
  });

  it("makes the four new categories LLM-suggestable", () => {
    for (const c of NEW_CATEGORIES) {
      expect(SUGGESTABLE_TRANSACTION_CATEGORIES).toContain(c);
    }
  });

  it("keeps the two system values out of the suggestable subset", () => {
    expect(SUGGESTABLE_TRANSACTION_CATEGORIES).not.toContain("transfer");
    expect(SUGGESTABLE_TRANSACTION_CATEGORIES).not.toContain("autre");
  });

  it("suggestable subset equals the enum minus transfer + autre (no drift)", () => {
    const expected = TRANSACTION_CATEGORIES.filter((c) => c !== "transfer" && c !== "autre");
    expect([...SUGGESTABLE_TRANSACTION_CATEGORIES]).toEqual([...expected]);
  });
});
```

Run: `bun --filter='@pekulo/api' run test transaction-categories`
Expected: `5 pass`, `0 fail`, exit 0. (Re-run the existing `bun --filter='@pekulo/api' run test llm-categorisation-prompt` + `llm-categoriser` to confirm no regression — they pass explicit `categories` arrays so they stay green.)
Commit: `git add apps/api/src/modules/transactions/transactions.service.ts apps/api/src/modules/transactions/transaction-categories.test.ts && git commit -m "feat(6-8): api uses validators suggestable SSOT + taxonomy guard test (DR-13)"`

#### T7 — Web: suggestion + recent sections

In `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.tsx`:

1. Add `CategoryIcon` to the existing `@pekulo/ui` import block (the one importing `CategoryPicker`, `PekuloSuggestionRow`, …):
```tsx
  CategoryIcon,
```

2. Pass `categoryIcon` to the row (resolve from the RAW `tx.suggestedCategory` key, not the label that lives on `suggestion`):
```tsx
              return (
                <View key={tx.id} role="listitem">
                  <PekuloSuggestionRow
                    tx={suggestion}
                    categoryIcon={
                      tx.suggestedCategory ? (
                        <CategoryIcon
                          category={tx.suggestedCategory}
                          size={12}
                          color="var(--colorSecondary)"
                        />
                      ) : undefined
                    }
                    disabled={confirm.isPending}
                    onConfirm={() =>
                      tx.suggestedCategory && runConfirm(tx.id, tx.suggestedCategory)
                    }
                    onEdit={() => openOverride(tx)}
                  />
                </View>
              );
```

In `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx`:

3. Replace the lucide import (line 17 — drop the now-unused `ArrowLeftRight`):
```tsx
import { MoreHorizontal, Search, Upload } from "lucide-react";
```

4. Add `CategoryIcon` to the existing `@pekulo/ui` import block (the one importing `PekuloActivityRow`, …):
```tsx
  CategoryIcon,
```

5. Replace the transfer-only `categoryPrefix` block (lines ~175-187) with a universal category icon (transfer still renders `ArrowLeftRight` via the map; `tx.category` is the raw DTO key):
```tsx
            // Story 6-8 (DR-13) — every row shows its category icon as an
            // inline caption prefix (14 px / colorTertiary / aria-hidden so SR
            // readers announce only the category label). 'transfer' resolves to
            // ArrowLeftRight via CATEGORY_ICONS, preserving story 5-3 AC-8.
            const categoryPrefix = (
              <CategoryIcon
                category={tx.category}
                size={14}
                color="var(--colorTertiary)"
                style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}
              />
            );
```

Run: `bun --filter='@pekulo/web' run test -- transactions-suggestions-section transactions-recent-section`
Expected: the suggestion `.envelope` test and the recent-section `.a11y` test pass — axe stays clean (icons `aria-hidden`), the transfer row still announces "Transfert". `Tests  … passed`, exit 0. **If** a `.a11y`/`.envelope` assertion is an inline snapshot that legitimately changed (icon added), re-run with `-u`; do NOT `-u` an axe failure — investigate it.
Commit: `git add apps/web/src/app/\(cap\)/dashboard/transactions/_components/transactions-suggestions-section.tsx apps/web/src/app/\(cap\)/dashboard/transactions/_components/transactions-recent-section.tsx && git commit -m "feat(6-8): category icons in Suggestions IA + Récentes rows (DR-13)"`

#### T8 — Web: create + edit category selects

In **both** `apps/web/.../transaction-create-form.tsx` and `apps/web/.../transaction-edit-form.tsx`:

1. Add `CategoryIcon` to the existing `@pekulo/ui` import block (the one importing `PekuloSelect`):
```tsx
  CategoryIcon,
```

2. Replace the category `.map(...)` (create-form ~219-223 / edit-form ~183-187) with the icon-bearing Item:
```tsx
                      {TRANSACTION_CATEGORIES.map((c, i) => (
                        <PekuloSelect.Item
                          key={c}
                          value={c}
                          index={i}
                          icon={<CategoryIcon category={c} size={16} />}
                        >
                          {TRANSACTION_CATEGORY_LABELS[c]}
                        </PekuloSelect.Item>
                      ))}
```

Run: `bun --filter='@pekulo/web' run test -- transaction-create-form transaction-edit-form`
Expected: the form tests pass (they exercise submit/validation, not dropdown-item DOM); `Tests  … passed`, exit 0. If a form has no dedicated test, the gate's full `vitest` run in T9 covers it.
Commit: `git add apps/web/src/app/\(cap\)/dashboard/transactions/_components/transaction-create-form.tsx apps/web/src/app/\(cap\)/dashboard/transactions/_components/transaction-edit-form.tsx && git commit -m "feat(6-8): category icons in create/edit transaction selects (DR-13)"`

#### T9 — Full Iron-Law gate + push

Run, in order, from the repo root:
```bash
bun run lint
turbo run typecheck
bun --filter='@pekulo/api' run test
bun --filter='@pekulo/ui' run test
bun --filter='@pekulo/web' run test
bun run prisma:check
bun run db:rls-audit
```
Expected:
- `bun run lint` (oxlint) → `Found 0 warnings and 0 errors`, exit 0 (no orphan `ArrowLeftRight` import).
- `turbo run typecheck` → all packages exit 0 (label completeness + `suggestableSubsetGuard` + widened union compile).
- api `bun:test` → all pass incl. `category taxonomy (story 6-8, DR-13) … 5 pass`.
- `@pekulo/ui` `vitest` → all pass incl. `CategoryIcon … 4 passed` + `PekuloSuggestionRow … 3 passed`.
- `@pekulo/web` `vitest` → all pass.
- `bun run prisma:check` → `prisma format --check` clean + `prisma validate` → `The schema is valid`, exit 0 (AC-3 — no schema change).
- `bun run db:rls-audit` → exit 0, RLS policy counts unchanged (AC-3 — no new table/policy).

Then push the branch:
```bash
git push -u origin feature/none-6-8-category-taxonomy-expansion
```
Commit (only if the gate produced incidental fixes, e.g. a regenerated inline snapshot): `git add -A && git commit -m "chore(6-8): Iron-Law gate green (DR-13)"`

## File List

**Created**

- `packages/ui/src/components/CategoryIcon/CategoryIcon.tsx`
- `packages/ui/src/components/CategoryIcon/index.ts`
- `packages/ui/src/components/CategoryIcon/CategoryIcon.test.tsx`
- `apps/api/src/modules/transactions/transaction-categories.test.ts`

**Modified**

- `packages/validators/src/transactions/transactions.schemas.ts`
- `packages/ui/src/components/index.ts`
- `packages/ui/src/primitives/PekuloSelect.tsx`
- `packages/ui/src/components/CategoryPicker/CategoryPicker.tsx`
- `packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.tsx`
- `packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.snapshot.test.tsx`
- `apps/api/src/modules/transactions/transactions.service.ts`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-create-form.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-edit-form.tsx`
- `docs/state.yaml`

## Dev Agent Record

- **Model:** claude-opus-4-8 (1M context)
- **Started:** 2026-06-01T12:07:37Z
- **Completed:** 2026-06-01T12:31:41Z

### Summary

Shipped DR-13: the four new categories (`factures`/`restauration`/`abonnements`/`retrait`) were added to the closed `TRANSACTION_CATEGORIES` enum, its French label map, and the `SUGGESTABLE_TRANSACTION_CATEGORIES` subset, and a per-category lucide `CategoryIcon` now renders in `CategoryPicker`, the `PekuloSuggestionRow` chip, the Récentes rows, and the create/edit category selects. `apps/api` stopped re-deriving the suggestable set and imports the validators SSOT so the LLM prompt allowlist can't drift. No DB migration, no compass/budget/monthly remap — display + suggestion semantics only.

### Files changed

- `packages/validators/src/transactions/transactions.schemas.ts`
- `packages/ui/src/components/CategoryIcon/CategoryIcon.tsx`
- `packages/ui/src/components/CategoryIcon/index.ts`
- `packages/ui/src/components/CategoryIcon/CategoryIcon.test.tsx`
- `packages/ui/src/components/index.ts`
- `packages/ui/src/primitives/PekuloSelect.tsx`
- `packages/ui/src/components/CategoryPicker/CategoryPicker.tsx`
- `packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.tsx`
- `packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.snapshot.test.tsx`
- `apps/api/src/modules/transactions/transactions.service.ts`
- `apps/api/src/modules/transactions/transaction-categories.test.ts`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-create-form.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-edit-form.tsx`
- `docs/state.yaml`

### Deviations

- **lucide-react version (doc nit, no impact).** Dev Notes cite `1.14.0`; the version actually resolved for `@pekulo/ui` + `apps/web` is `1.11.0` (`1.14.0` only lives in `docs/ux-preview/`). All 17 icon names were verified present in the installed `1.11.0`, so the icon map is valid as written.
- **T3/T4 — no isolated unit test.** Select `Item`s render inside a Tamagui Select portal that only mounts on open, which the existing closed-dropdown unit tests don't exercise; the icon slot's behaviour is covered by the `CategoryIcon` unit test + the unchanged a11y/snapshot regression guards + runtime. Chose this over fabricating an unreliable open-the-portal test.
- **T6 — RED witnessed via break-it.** The taxonomy guard test passed on first write (T1 already landed), so RED was witnessed by temporarily removing `retrait` from the suggestable set (2 fail) then restoring.
- **Visual verification deferred.** `react-grab-mcp` was unavailable this session (offline through epic 6, as in 6-3/6-4); deferred to `aped-review`'s static design pass.

### Test output

```
bun run lint                          → Found 0 warnings and 0 errors (786 files)
bun run typecheck (turbo)             → 8 successful, 8 total
bun --filter='@pekulo/api' run test   → 745 pass, 0 fail (88 files; incl. taxonomy 5 pass)
bun --filter='@pekulo/ui' run test    → 206 passed | 1 skipped (122 files)
bun --filter='@pekulo/web' run test   → 146 passed (70 files)
bun run prisma:check                  → format clean + schema valid (no schema change)
bun run db:rls-audit                  → exit 0, 19 tables, policy counts unchanged
```

## Review Record

**Date:** 2026-06-01
**Auditors:** Spec, Code, Edge & Hallucination (Aria — deferred, see Verification)
**Verdict:** done

### Findings

#### Resolved

- **[MINOR] AC-2 — no call-site assertion that `CategoryPicker` renders each option's icon** [`packages/ui/src/components/CategoryPicker/CategoryPicker.tsx`]
  - Source: Spec
  - Resolution: `7d3be8f` — added `CategoryPicker.wiring.test.tsx`. The real items mount inside a Tamagui Select portal that does **not** mount in happy-dom (probe-confirmed: open via click or `open` prop yields 0 item SVGs), so the test stubs **our own** `PekuloSelect` wrapper (not Tamagui internals) to render items inline, then asserts the **real** `<CategoryIcon>` lucide SVG resolved per raw `opt.value` (`lucide-shopping-cart`/`lucide-refresh-cw`/`lucide-landmark`) + every glyph `aria-hidden` + the `Tag` fallback for an unmapped value. Verified a real-behaviour test (not mock-the-behaviour).

- **[NIT] Category glyph rendered inside the running-text caption `<Text>`** [`packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.tsx`]
  - Source: Code
  - Resolution: `b346af3` — moved the optional `categoryPrefix` glyph to a flex sibling between the account-separator span and the category span; reading order + the 5-3 AC-8 visual (glyph before the category label) preserved, icon stays `aria-hidden`. Updated `PekuloActivityRow` + `PekuloRecentActivityCard` snapshots (caption is now a 2-span flex row; visible text + colours unchanged).

- **[NIT] Dev Notes cite `lucide-react@1.14.0`; installed version is `1.11.0`** [`docs/stories/6-8-category-taxonomy-expansion.md:49`]
  - Source: Spec + Code + Edge (converged)
  - Resolution: this doc commit — corrected the Q3 citation to `1.11.0`. All 17 icon names verified present in the installed version by direct package inspection (ESM exports + `.d.ts` + per-icon source files).

- **[NIT] Story header `Status` said `ready-for-dev` while `state.yaml` (canonical) said `review`** [`docs/stories/6-8-category-taxonomy-expansion.md:3`]
  - Source: Lead (git/state cross-check)
  - Resolution: this doc commit — header set to `done` at finalize.

#### Dismissed

none

#### Unresolved

none — story flips to `done`.

### Verification

Fresh tool output captured in the review session (Iron-Law gate):

```
bun run lint                          → Found 0 warnings and 0 errors (788 files)
turbo run typecheck                   → 8 successful, 8 total
bun --filter='@pekulo/api' run test   → 745 pass, 0 fail (incl. taxonomy 5 pass)
bun --filter='@pekulo/ui' run test    → 208 passed | 1 skipped (123 files; incl. CategoryIcon 4, PekuloSuggestionRow snapshot 3 + a11y 2, CategoryPicker wiring 2)
bun --filter='@pekulo/web' run test   → 146 passed (70 files)
bun run prisma:check                  → format clean + schema valid (no schema change — AC-3)
bun run db:rls-audit                  → exit 0, 19 tables, policy counts unchanged (AC-3)
```

- **Auditor verdicts:** Spec APPROVED (HIGH), Code APPROVED (HIGH), Edge & Hallucination APPROVED (HIGH). The hallucination pass verified all 17 lucide icon imports are real named exports of the installed `lucide-react@1.11.0` (the four new: `ReceiptText`/`Utensils`/`RefreshCw`/`Landmark`). Git audit: every changed file ∈ the story File List, no out-of-scope code change, no missing expected change.
- **Post-fix verification (HEAD `7d3be8f`):** both fixes RESOLVED, no regressions, fix #1 judged a real-behaviour test.
- **Visual verification:** deferred — React Grab MCP unavailable at 2026-06-01T14:00Z (Aria waived by user, consistent with 6-3/6-4). Static design-law pass clean: TR-strict grayscale on all category chrome (`var(--colorSecondary)` / `var(--colorTertiary)`, no `$accent`/emerald — lesson 2026-05-07), icons `aria-hidden` at every call site, neutral `Tag` fallback, `transfer` glyph (5-3 AC-8) preserved. No new Tamagui token/variant → no `tamagui.generated.css` regen (lesson 2026-05-24; pre-commit regen produced no diff).
- **Forced-fix note (user call):** the Lead flagged finding #1 as infeasible without a fake test (the Tamagui Select portal won't mount in happy-dom) and finding #3 as out of 6-8's scope (`PekuloActivityRow.tsx` is a shared 5-3 component, absent from this story's File List) with visual verification waived. The user directed fixing both anyway. #1 was implemented as an honest wrapper-seam wiring test; #3 restructured the shared caption and updated two consumer snapshots. **Residual risk:** #3's visual was not Aria-verified (MCP offline) — the snapshot diff confirms the text/colour/a11y are unchanged, but the rendered layout of the two-span flex caption was not visually confirmed in a browser.

### Ticket sync

- Ticket: none — story carries no GitHub issue (`sprint.stories.6-8.ticket: null`).
- PR: #112 (base `main`) — title/body refreshed, marked ready.
