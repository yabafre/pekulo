# Story: 4-2-realestate-derives — Cash-flow + net equity derivations + total-wealth integration

**Epic:** Epic 4 — Real-estate (V1 new module)
**Status:** ready-for-dev
**Ticket:** [#25](https://github.com/yabafre/pekulo/issues/25)
**Branch:** `feature/25-4-2-realestate-derives`
**Commit prefix:** `feat(#25): …`
**Depends on:** 4-1-realestate-domain (done)
**Complexity:** S

## User Story

**As a** Pekulo user, **I want** monthly rental cash-flow and net property equity computed automatically and included in my total wealth and compass progress, **so that** my apartment contributes to the compass without manual aggregation — feeding the dashboard's total-wealth aggregator (FR-43, consumed in story 7-1) while exposing per-property derives to the immobilier UI (FR-24 / FR-25, consumed in story 4-3).

## Acceptance Criteria

- **AC-1 (rental-cashflow math — verbatim from ticket #25):** **Given** a rental block (`monthlyRent: 1200`, `monthlyCharges: 200`) and a mortgage (`monthlyPayment: 600`), **When** `computeRentalCashFlow({ rental, mortgage })` runs, **Then** the result is `+400`. Pure derive unit test in `apps/api/src/common/derive/rental-cashflow.test.ts`.
- **AC-2 (property-equity math — verbatim from ticket #25):** **Given** a property (`currentValuation: 250000`) with a mortgage (`outstandingPrincipal: 180000`), **When** `computePropertyEquity({ property, mortgage })` runs, **Then** the result is `70000`. Pure derive unit test in `apps/api/src/common/derive/property-equity.test.ts`.
- **AC-3 (total-wealth aggregator — derived from ticket #25's AC-3):** **Given** user A owns 3 properties — `(valuation 250000, mortgage outstandingPrincipal 180000)`, `(valuation 400000, no mortgage)`, `(valuation 100000, mortgage outstandingPrincipal 120000)` — **When** the integration test calls `POST /rpc/v1/realestate/getTotalEquity` with a valid JWT for A, **Then** the response is HTTP **200** AND the body parses to `{ totalEquityEur: 450000, perProperty: [<3 items>] }` where `perProperty` contains exactly `{ propertyId, netEquityEur }` for the three properties with values `70000`, `400000`, `-20000` (sum = 450 000 €). FR-26 primitive — 7-1's `dashboard.service.computeTotalWealth` will consume this method (architecture L1057).
- **AC-4 (null-cashflow when rental absent):** **Given** a property with a mortgage but NO rental block, **When** `getPropertyDerives({ id })` runs, **Then** the response is `{ monthlyCashFlowEur: null, netEquityEur: <currentValuation − outstandingPrincipal> }`. **And Given** a property with neither mortgage nor rental, **When** `getPropertyDerives({ id })` runs, **Then** the response is `{ monthlyCashFlowEur: null, netEquityEur: currentValuation }`. Verified at service unit AND integration layers.
- **AC-5 (no-mortgage equity = full valuation):** **Given** a property without any mortgage, **When** `getPropertyDerives({ id })` runs, **Then** `body.netEquityEur === property.currentValuation`. Verified at service unit AND integration layers.
- **AC-6 (cross-user 404 — defense in depth):** **Given** user B calls `getPropertyDerives({ id: <A's property> })` with a valid JWT for B, **When** the integration test runs, **Then** the response is HTTP **404** (`REALESTATE_NOT_FOUND`) — the service pre-flights ownership via `requireOwnedProperty` (mirrors the 12 procedures shipped in 4-1; never leaks an RLS P2025).
- **AC-7 (empty list returns zero — no crash on new account):** **Given** user C owns zero properties, **When** the integration test calls `listPropertyDerives()` with a valid JWT for C, **Then** the response is `[]`. **And When** it calls `getTotalEquity()` for C, **Then** the response is `{ totalEquityEur: 0, perProperty: [] }`.
- **AC-8 (pure rules — no I/O in `common/derive/`, L24 reapplied):** **Given** the two new pure helpers, **When** `grep -rEn 'prisma|fetch|Date\.now|@opentelemetry' apps/api/src/common/derive/rental-cashflow.ts apps/api/src/common/derive/property-equity.ts` runs, **Then** the grep returns `0` matches. **And** `grep -rn 'Number(.*Decimal' apps/api/src/modules/realestate` still returns `0` (L24 invariant — the new `listWithChildrenForUser` repo method routes every Decimal field through `decimalToNumber`).
- **AC-9 (Elysia invariance + zero `*.types.ts` — L8 + L1):** **Given** the story shipped, **When** `grep -rEn ':\s*Elysia\b|as\s+Elysia\b|<Elysia\b' apps/api/src/modules/realestate | wc -l` AND `find apps/api/src/modules/realestate -name '*.types.ts'` run, **Then** the grep returns `0` AND find returns empty. Every domain type lives in `@pekulo/types` (re-exported from `@pekulo/validators`).
- **AC-10 (R1 — `@pekulo/zod` only):** **Given** the new code, **When** `grep -rEn 'from\s+"zod"' apps/api/src/common/derive/rental-cashflow.ts apps/api/src/common/derive/property-equity.ts packages/validators/src/realestate/realestate.schemas.ts` runs, **Then** the grep returns `0` (PR #86 R1 — `@pekulo/zod` is the SOLE entry point).
- **AC-11 (N+1 budget — `listWithChildrenForUser`):** **Given** user A owns 50 properties (each with 1 mortgage + 1 rental), **When** the repository unit test calls `listWithChildrenForUser(userId)` against a fake Prisma counter, **Then** the fake records exactly **one** `realEstate.findMany` call (with `include: { mortgage: true, rental: true }`). One round-trip, never N+1 (NFR-16 — 50 properties per user).
- **AC-12 (HTTP boundary — 200 / 401 / 404 for 3 new procedures):** **Given** a valid Supabase HS256 JWT for user A, **When** the integration test calls each of `POST /rpc/v1/realestate/getPropertyDerives`, `POST /rpc/v1/realestate/listPropertyDerives`, `POST /rpc/v1/realestate/getTotalEquity` with valid bodies, **Then** every response is HTTP **200**. **And** missing JWT on any of the 3 procedures → HTTP **401** within 100 ms (NFR-9). **And** cross-user `getPropertyDerives` → HTTP **404** (`REALESTATE_NOT_FOUND`).
- **AC-13 (quality gate green):** **Given** all tasks T1-T15 are complete on the feature branch, **When** the dev runs `bun --filter='@pekulo/api' run lint`, `bun --filter='@pekulo/api' run typecheck`, `bun --filter='@pekulo/api' test`, AND `bun --filter='@pekulo/*' run typecheck` in sequence, **Then** every command exits `0`. (No migration → no `db:rls-audit` re-run; 4-1's expected RLS counts of 4/4/4/2 still hold.)

## Tasks

- [ ] **T1** — Write the pure rental-cashflow derive **test** (TDD RED) at `apps/api/src/common/derive/rental-cashflow.test.ts`. [AC: AC-1, AC-4, AC-8, AC-10]
  Create the file with the exact contents below:
  ```ts
  // apps/api/src/common/derive/rental-cashflow.test.ts
  // Pure derive unit tests (story 4-2). FR-24 — monthly rental cash-flow.
  // Mirrors the holding-pnl.test.ts shape (story 3-3).

  import { describe, expect, test } from "bun:test";
  import { computeRentalCashFlow } from "./rental-cashflow";

  describe("computeRentalCashFlow", () => {
    // AC-1 (verbatim from ticket #25):
    //   Given rent=1200, charges=200, mortgage monthlyPayment=600,
    //   Then cashflow = +400.
    test("AC-1 — rent 1200 − charges 200 − monthlyPayment 600 = +400", () => {
      expect(
        computeRentalCashFlow({
          rental: { monthlyRent: 1200, monthlyCharges: 200 },
          mortgage: { monthlyPayment: 600 },
        }),
      ).toBe(400);
    });

    // AC-4 first branch: rental present, mortgage null.
    test("AC-4a — rental present, no mortgage → rent − charges", () => {
      expect(
        computeRentalCashFlow({
          rental: { monthlyRent: 1200, monthlyCharges: 200 },
          mortgage: null,
        }),
      ).toBe(1000);
    });

    // AC-4 second branch: no rental → null.
    test("AC-4b — no rental → null (cashflow undefined)", () => {
      expect(
        computeRentalCashFlow({
          rental: null,
          mortgage: { monthlyPayment: 600 },
        }),
      ).toBeNull();
    });

    test("AC-4c — no rental + no mortgage → null", () => {
      expect(computeRentalCashFlow({ rental: null, mortgage: null })).toBeNull();
    });

    // Zero-edge: rent equals charges + mortgage → exactly 0.
    test("zero cashflow when rent = charges + monthlyPayment", () => {
      expect(
        computeRentalCashFlow({
          rental: { monthlyRent: 800, monthlyCharges: 200 },
          mortgage: { monthlyPayment: 600 },
        }),
      ).toBe(0);
    });
  });
  ```
  Run: `cd apps/api && bun test src/common/derive/rental-cashflow.test.ts`
  Expected (TDD RED): test loader fails with `Cannot find module './rental-cashflow'` (module not yet created). Exit non-zero.
  Commit: `git add apps/api/src/common/derive/rental-cashflow.test.ts && git commit -m "test(#25): rental-cashflow derive (RED)"`

- [ ] **T2** — Implement the pure rental-cashflow derive (TDD GREEN) at `apps/api/src/common/derive/rental-cashflow.ts`. [AC: AC-1, AC-4, AC-8, AC-10]
  Create the file with the exact contents below:
  ```ts
  // apps/api/src/common/derive/rental-cashflow.ts
  // Pure monthly rental cash-flow helper (story 4-2). FR-24.
  //
  // Inputs by argument only. No `prisma`, no `fetch`, no `Date.now()`, no
  // `@opentelemetry/*` import (AC-8 grep guard).
  //
  // Returns `null` when no rental block exists — a property without a rental
  // has no defined cash-flow (FR-23 makes rental optional 1:1 per property).
  // The mortgage component is optional: a rental-only property surfaces
  // `rent − charges`.

  export interface RentalCashFlowInput {
    rental: { monthlyRent: number; monthlyCharges: number } | null;
    mortgage: { monthlyPayment: number } | null;
  }

  export function computeRentalCashFlow(input: RentalCashFlowInput): number | null {
    if (!input.rental) return null;
    const monthlyPayment = input.mortgage?.monthlyPayment ?? 0;
    return input.rental.monthlyRent - input.rental.monthlyCharges - monthlyPayment;
  }
  ```
  Run: `cd apps/api && bun test src/common/derive/rental-cashflow.test.ts`
  Expected (GREEN): `5 pass`, `0 fail`. Exit 0.
  Commit: `git add apps/api/src/common/derive/rental-cashflow.ts && git commit -m "feat(#25): rental-cashflow derive (GREEN) [FR-24]"`

- [ ] **T3** — Write the pure property-equity derive **test** (TDD RED) at `apps/api/src/common/derive/property-equity.test.ts`. [AC: AC-2, AC-5, AC-8, AC-10]
  Create the file with the exact contents below:
  ```ts
  // apps/api/src/common/derive/property-equity.test.ts
  // Pure derive unit tests (story 4-2). FR-25 — net property equity.

  import { describe, expect, test } from "bun:test";
  import { computePropertyEquity } from "./property-equity";

  describe("computePropertyEquity", () => {
    // AC-2 (verbatim from ticket #25):
    //   Given valuation=250000, outstandingPrincipal=180000,
    //   Then equity = 70000.
    test("AC-2 — valuation 250000 − outstandingPrincipal 180000 = 70000", () => {
      expect(
        computePropertyEquity({
          property: { currentValuation: 250_000 },
          mortgage: { outstandingPrincipal: 180_000 },
        }),
      ).toBe(70_000);
    });

    // AC-5 — no mortgage → equity = currentValuation.
    test("AC-5 — no mortgage → equity equals currentValuation", () => {
      expect(
        computePropertyEquity({
          property: { currentValuation: 400_000 },
          mortgage: null,
        }),
      ).toBe(400_000);
    });

    // Underwater — outstandingPrincipal > valuation → negative equity.
    test("AC-3 partial — underwater property → negative equity", () => {
      expect(
        computePropertyEquity({
          property: { currentValuation: 100_000 },
          mortgage: { outstandingPrincipal: 120_000 },
        }),
      ).toBe(-20_000);
    });

    test("zero valuation + zero debt → zero", () => {
      expect(
        computePropertyEquity({
          property: { currentValuation: 0 },
          mortgage: null,
        }),
      ).toBe(0);
    });
  });
  ```
  Run: `cd apps/api && bun test src/common/derive/property-equity.test.ts`
  Expected (TDD RED): test loader fails with `Cannot find module './property-equity'`. Exit non-zero.
  Commit: `git add apps/api/src/common/derive/property-equity.test.ts && git commit -m "test(#25): property-equity derive (RED)"`

- [ ] **T4** — Implement the pure property-equity derive (TDD GREEN) at `apps/api/src/common/derive/property-equity.ts`. [AC: AC-2, AC-5, AC-8, AC-10]
  Create the file with the exact contents below:
  ```ts
  // apps/api/src/common/derive/property-equity.ts
  // Pure net property equity helper (story 4-2). FR-25.
  //
  // Inputs by argument only. No `prisma`, no `fetch`, no `Date.now()`, no
  // `@opentelemetry/*` import (AC-8 grep guard).
  //
  // Returns `currentValuation − outstandingPrincipal`. Mortgage is optional —
  // an unencumbered property surfaces full valuation. Underwater properties
  // (debt > valuation) return a negative number; the caller decides whether
  // to display it raw or clamp to zero (the dashboard total-wealth aggregator
  // in story 7-1 will sum raw values).

  export interface PropertyEquityInput {
    property: { currentValuation: number };
    mortgage: { outstandingPrincipal: number } | null;
  }

  export function computePropertyEquity(input: PropertyEquityInput): number {
    const debt = input.mortgage?.outstandingPrincipal ?? 0;
    return input.property.currentValuation - debt;
  }
  ```
  Run: `cd apps/api && bun test src/common/derive/property-equity.test.ts`
  Expected (GREEN): `4 pass`, `0 fail`. Exit 0.
  Commit: `git add apps/api/src/common/derive/property-equity.ts && git commit -m "feat(#25): property-equity derive (GREEN) [FR-25]"`

- [ ] **T5** — Extend `packages/validators/src/realestate/realestate.schemas.ts` with 4 new output schemas. [AC: AC-3, AC-4, AC-5, AC-7, AC-10, AC-12]
  Append the following block at the **end** of the file (after the `realestateOkSchema` declaration on the current last 4 lines — do NOT touch the 4-1 schemas above):
  ```ts
  // ─── 4-2 — Pure-derive output shapes (FR-24 / FR-25 / FR-26) ────────────
  // Single source of truth for the realestate derives surface (story 4-2).
  // The pure helpers (`apps/api/src/common/derive/{rental-cashflow,property-equity}.ts`)
  // are inputs-by-argument; these schemas pin the wire shape exposed to
  // 4-3 UI (per-property derives) and 7-1 dashboard (total equity roll-up).

  export const propertyDerivesSchema = z.object({
    monthlyCashFlowEur: z.number().nullable(),
    netEquityEur: z.number(),
  });
  export type PropertyDerives = z.infer<typeof propertyDerivesSchema>;

  export const propertyDerivesItemSchema = z.object({
    propertyId: realEstateIdSchema,
    monthlyCashFlowEur: z.number().nullable(),
    netEquityEur: z.number(),
  });
  export type PropertyDerivesItem = z.infer<typeof propertyDerivesItemSchema>;

  export const listPropertyDerivesOutputSchema = z.array(propertyDerivesItemSchema);
  export type ListPropertyDerivesOutput = z.infer<typeof listPropertyDerivesOutputSchema>;

  export const totalEquityOutputSchema = z.object({
    totalEquityEur: z.number(),
    perProperty: z.array(
      z.object({
        propertyId: realEstateIdSchema,
        netEquityEur: z.number(),
      }),
    ),
  });
  export type TotalEquityOutput = z.infer<typeof totalEquityOutputSchema>;
  ```
  Run: `bun --filter='@pekulo/validators' run typecheck && bun --filter='@pekulo/validators' run lint`
  Expected: exit 0 on both. No new file added; `packages/validators/src/realestate/index.ts` (`export * from "./realestate.schemas";`) already re-exports the new symbols.
  Commit: `git add packages/validators/src/realestate/realestate.schemas.ts && git commit -m "feat(#25): realestate derives validators [FR-24/25/26]"`

- [ ] **T6** — Re-export the new derive types from `packages/types/src/realestate/realestate.types.ts`. [AC: AC-9]
  Extend the existing `export type {…} from "@pekulo/validators";` block to include the 3 new aliases. Replace the current block:
  ```ts
  export type {
    RealEstate,
    RealEstateMortgage,
    RealEstateRental,
    RealEstateValuation,
    PropertyWithChildren,
  } from "@pekulo/validators";
  ```
  with:
  ```ts
  export type {
    RealEstate,
    RealEstateMortgage,
    RealEstateRental,
    RealEstateValuation,
    PropertyWithChildren,
    PropertyDerives,
    PropertyDerivesItem,
    TotalEquityOutput,
  } from "@pekulo/validators";
  ```
  Run: `bun --filter='@pekulo/types' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/types/src/realestate/realestate.types.ts && git commit -m "feat(#25): re-export realestate derive types"`

- [ ] **T7** — Extend the oRPC contract at `packages/contracts/src/realestate/realestate.contract.ts` with 3 new procedures (additive only — do NOT touch the 12 procedures already declared). [AC: AC-3, AC-4, AC-6, AC-7, AC-12]
  Step 1 — add to the import block at the top (insert after `realestateOkSchema,` line — keep alphabetical):
  ```ts
  import {
    attachMortgageInputSchema,
    attachRentalInputSchema,
    createPropertyInputSchema,
    deletePropertyInputSchema,
    detachMortgageInputSchema,
    detachRentalInputSchema,
    getPropertyInputSchema,
    listPropertiesOutputSchema,
    listPropertyDerivesOutputSchema,
    listValuationsInputSchema,
    listValuationsOutputSchema,
    propertyDerivesSchema,
    propertyWithChildrenSchema,
    realEstateMortgageSchema,
    realEstateRentalSchema,
    realEstateSchema,
    realestateOkSchema,
    recordValuationInputSchema,
    totalEquityOutputSchema,
    updateMortgageInputSchema,
    updateRentalInputSchema,
  } from "@pekulo/validators";
  ```
  Step 2 — inside the `realestateContractV1 = { … } as const;` literal, append the 3 new procedures **after** the existing `deleteProperty` entry (keep `deleteProperty` as-is). Replace the closing block:
  ```ts
    deleteProperty: oc
      .errors({ REALESTATE_NOT_FOUND: realestateNotFoundError })
      .input(deletePropertyInputSchema)
      .output(realestateOkSchema),
  } as const;
  ```
  with:
  ```ts
    deleteProperty: oc
      .errors({ REALESTATE_NOT_FOUND: realestateNotFoundError })
      .input(deletePropertyInputSchema)
      .output(realestateOkSchema),
    // ─── 4-2 — derive surface (FR-24 / FR-25 / FR-26) ────────────────
    getPropertyDerives: oc
      .errors({ REALESTATE_NOT_FOUND: realestateNotFoundError })
      .input(getPropertyInputSchema)
      .output(propertyDerivesSchema),
    listPropertyDerives: oc.output(listPropertyDerivesOutputSchema),
    getTotalEquity: oc.output(totalEquityOutputSchema),
  } as const;
  ```
  Run: `bun --filter='@pekulo/contracts' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/contracts/src/realestate/realestate.contract.ts && git commit -m "feat(#25): 3 derive procedures on realestate contract"`

- [ ] **T8** — Extend the repository tests (TDD RED) at `apps/api/src/modules/realestate/realestate.repository.test.ts`. [AC: AC-3, AC-8, AC-11]
  Append the following `describe` block at the **end** of the file (after the last existing `describe` — do NOT modify any 4-1 test):
  ```ts
  describe("realestate.repository — listWithChildrenForUser (story 4-2)", () => {
    // AC-11 (story 4-2): one Prisma round-trip, never N+1.
    test("AC-11 — single findMany with include returns mortgage + rental joined", async () => {
      const fake = makeFakePrisma();
      const repo = createRealestateRepository({ client: fake.client });
      const p = await repo.createProperty(USER_A, {
        label: "P1",
        propertyType: "locatif",
        currentValuation: 250_000,
        lastValuedOn: new Date("2026-01-01"),
      });
      await repo.attachMortgage(USER_A, {
        propertyId: p.id,
        outstandingPrincipal: 180_000,
        annualRate: 0.025,
        monthlyPayment: 600,
        termMonths: 240,
        startDate: new Date("2020-01-01"),
      });
      await repo.attachRental(USER_A, {
        propertyId: p.id,
        monthlyRent: 1200,
        monthlyCharges: 200,
        furnished: false,
      });
      const rows = await repo.listWithChildrenForUser(USER_A);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.property.id).toBe(p.id);
      expect(rows[0]!.mortgage?.outstandingPrincipal).toBe(180_000);
      expect(rows[0]!.rental?.monthlyRent).toBe(1200);
    });

    test("AC-7 — empty list when user owns zero properties", async () => {
      const fake = makeFakePrisma();
      const repo = createRealestateRepository({ client: fake.client });
      expect(await repo.listWithChildrenForUser(USER_A)).toEqual([]);
    });

    test("AC-3 partial — property with no children → null mortgage + null rental in the row", async () => {
      const fake = makeFakePrisma();
      const repo = createRealestateRepository({ client: fake.client });
      const p = await repo.createProperty(USER_A, {
        label: "P-empty",
        propertyType: "residence-principale",
        currentValuation: 400_000,
        lastValuedOn: new Date("2026-01-01"),
      });
      const rows = await repo.listWithChildrenForUser(USER_A);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.property.id).toBe(p.id);
      expect(rows[0]!.mortgage).toBeNull();
      expect(rows[0]!.rental).toBeNull();
    });

    test("AC-9 — cross-user isolation (USER_B sees zero of A's rows)", async () => {
      const fake = makeFakePrisma();
      const repo = createRealestateRepository({ client: fake.client });
      await repo.createProperty(USER_A, {
        label: "A-only",
        propertyType: "locatif",
        currentValuation: 100_000,
        lastValuedOn: new Date("2026-01-01"),
      });
      expect(await repo.listWithChildrenForUser(USER_B)).toEqual([]);
    });
  });
  ```
  Then extend the fake at `apps/api/src/test/fakes/fake-realestate.ts` so the fake `realEstate.findMany` supports `include: { mortgage: true, rental: true }`. Locate the existing `realEstate: { findMany: …, findFirst: …, create: …, updateMany: …, deleteMany: … }` block and patch its `findMany` to honour the `include` arg (mirror the Prisma behaviour — return rows shaped `{ …propertyFields, mortgage: <MortgageRow|null>, rental: <RentalRow|null> }`). The exact patch shape is left to T9's implementer because it depends on the existing fake's internal collection shape — the test above pins the contract.
  Run: `cd apps/api && bun test src/modules/realestate/realestate.repository.test.ts`
  Expected (TDD RED): the 4 new tests fail with a TypeError because `repo.listWithChildrenForUser` is `undefined`. All 4-1 tests still pass. Exit non-zero.
  Commit: `git add apps/api/src/modules/realestate/realestate.repository.test.ts apps/api/src/test/fakes/fake-realestate.ts && git commit -m "test(#25): listWithChildrenForUser repo (RED)"`

- [ ] **T9** — Implement `listWithChildrenForUser` in the repository (TDD GREEN). [AC: AC-3, AC-8, AC-11]
  Step 1 — extend the `RealestateRepository` interface in `apps/api/src/modules/realestate/realestate.repository.ts`. Locate the existing interface (currently ending with `deleteProperty(userId: string, input: DeletePropertyInput): Promise<{ ok: true }>;`) and append one new method **before** the closing brace:
  ```ts
    listWithChildrenForUser(userId: string): Promise<
      Array<{
        property: RealEstate;
        mortgage: RealEstateMortgage | null;
        rental: RealEstateRental | null;
      }>
    >;
  ```
  Step 2 — append the implementation inside `createRealestateRepository` (after the existing `deleteProperty` method, before the closing `};`):
  ```ts
    async listWithChildrenForUser(userId) {
      const rows = await client.realEstate.findMany({
        where: { userId },
        include: { mortgage: true, rental: true },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((row) => {
        const r = row as unknown as PrismaPropertyRow & {
          mortgage: PrismaMortgageRow | null;
          rental: PrismaRentalRow | null;
        };
        return {
          property: toProperty(r),
          mortgage: r.mortgage ? toMortgage(r.mortgage) : null,
          rental: r.rental ? toRental(r.rental) : null,
        };
      });
    },
  ```
  Run: `cd apps/api && bun test src/modules/realestate/realestate.repository.test.ts`
  Expected (GREEN): all 4-1 tests + the 4 new 4-2 tests pass. Exit 0.
  Commit: `git add apps/api/src/modules/realestate/realestate.repository.ts && git commit -m "feat(#25): listWithChildrenForUser repo (GREEN)"`

- [ ] **T10** — Extend the service tests (TDD RED) at `apps/api/src/modules/realestate/realestate.service.test.ts`. [AC: AC-3, AC-4, AC-5, AC-6, AC-7]
  Step 1 — extend the existing `fakeRepo` helper. Find the existing function signature `function fakeRepo(overrides: Partial<RealestateRepository> = {}): RealestateRepository {` and add one default mock inside the returned literal (between `deleteProperty: mock(async () => ({ ok: true as const })),` and the final `...overrides,` line if present, OR before the closing `};`):
  ```ts
    listWithChildrenForUser: mock(async () => [] as Array<{
      property: RealEstate;
      mortgage: RealEstateMortgage | null;
      rental: RealEstateRental | null;
    }>),
  ```
  Step 2 — append the following `describe` block at the **end** of the file:
  ```ts
  describe("realestate.service — derives (story 4-2)", () => {
    const PROPERTY_250K: RealEstate = {
      ...PROPERTY_A,
      id: "res_aaaaaaaaaaaaaaaaaaaaa",
      currentValuation: 250_000,
    };
    const MORTGAGE_180K: RealEstateMortgage = {
      id: "resm_bbbbbbbbbbbbbbbbbbbbb",
      userId: USER_A,
      realEstateId: PROPERTY_250K.id,
      outstandingPrincipal: 180_000,
      annualRate: 0.025,
      monthlyPayment: 600,
      termMonths: 240,
      startDate: new Date("2020-01-01"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const RENTAL_1200: RealEstateRental = {
      id: "resr_ccccccccccccccccccccc",
      userId: USER_A,
      realEstateId: PROPERTY_250K.id,
      monthlyRent: 1200,
      monthlyCharges: 200,
      furnished: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    test("AC-1 + AC-2 — getPropertyDerives composes cashflow=+400 and equity=70000", async () => {
      const repo = fakeRepo({
        findByIdForUser: mock(async () => PROPERTY_250K),
        findMortgageForUser: mock(async () => MORTGAGE_180K),
        findRentalForUser: mock(async () => RENTAL_1200),
      });
      const service = createRealestateService({ repository: repo });
      const out = await service.getPropertyDerives(USER_A, { id: PROPERTY_250K.id });
      expect(out).toEqual({ monthlyCashFlowEur: 400, netEquityEur: 70_000 });
    });

    test("AC-4 — getPropertyDerives returns null cashflow when no rental", async () => {
      const repo = fakeRepo({
        findByIdForUser: mock(async () => PROPERTY_250K),
        findMortgageForUser: mock(async () => MORTGAGE_180K),
        findRentalForUser: mock(async () => null),
      });
      const service = createRealestateService({ repository: repo });
      const out = await service.getPropertyDerives(USER_A, { id: PROPERTY_250K.id });
      expect(out).toEqual({ monthlyCashFlowEur: null, netEquityEur: 70_000 });
    });

    test("AC-5 — getPropertyDerives returns full valuation as equity when no mortgage", async () => {
      const repo = fakeRepo({
        findByIdForUser: mock(async () => PROPERTY_250K),
        findMortgageForUser: mock(async () => null),
        findRentalForUser: mock(async () => null),
      });
      const service = createRealestateService({ repository: repo });
      const out = await service.getPropertyDerives(USER_A, { id: PROPERTY_250K.id });
      expect(out).toEqual({ monthlyCashFlowEur: null, netEquityEur: 250_000 });
    });

    test("AC-6 — getPropertyDerives throws REALESTATE_NOT_FOUND on cross-user", async () => {
      const repo = fakeRepo({ findByIdForUser: mock(async () => null) });
      const service = createRealestateService({ repository: repo });
      await expect(
        service.getPropertyDerives(USER_A, { id: PROPERTY_250K.id }),
      ).rejects.toBeInstanceOf(RealestateError);
    });

    test("AC-3 — getTotalEquity reduces 3 properties to 450000 with signed perProperty entries", async () => {
      const p1: RealEstate = { ...PROPERTY_A, id: "res_111111111111111111111", currentValuation: 250_000 };
      const m1: RealEstateMortgage = { ...MORTGAGE_180K, realEstateId: p1.id, outstandingPrincipal: 180_000 };
      const p2: RealEstate = { ...PROPERTY_A, id: "res_222222222222222222222", currentValuation: 400_000 };
      const p3: RealEstate = { ...PROPERTY_A, id: "res_333333333333333333333", currentValuation: 100_000 };
      const m3: RealEstateMortgage = { ...MORTGAGE_180K, realEstateId: p3.id, outstandingPrincipal: 120_000 };
      const repo = fakeRepo({
        listWithChildrenForUser: mock(async () => [
          { property: p1, mortgage: m1, rental: null },
          { property: p2, mortgage: null, rental: null },
          { property: p3, mortgage: m3, rental: null },
        ]),
      });
      const service = createRealestateService({ repository: repo });
      const out = await service.getTotalEquity(USER_A);
      expect(out.totalEquityEur).toBe(450_000);
      expect(out.perProperty).toEqual([
        { propertyId: p1.id, netEquityEur: 70_000 },
        { propertyId: p2.id, netEquityEur: 400_000 },
        { propertyId: p3.id, netEquityEur: -20_000 },
      ]);
    });

    test("AC-7 — getTotalEquity on empty list → { totalEquityEur: 0, perProperty: [] }", async () => {
      const service = createRealestateService({ repository: fakeRepo() });
      expect(await service.getTotalEquity(USER_A)).toEqual({
        totalEquityEur: 0,
        perProperty: [],
      });
    });

    test("AC-7 — listPropertyDerives on empty list → []", async () => {
      const service = createRealestateService({ repository: fakeRepo() });
      expect(await service.listPropertyDerives(USER_A)).toEqual([]);
    });

    test("listPropertyDerives composes per-property derives for 2 properties", async () => {
      const p1: RealEstate = { ...PROPERTY_A, id: "res_aaaaaaaaaaaaaaaaaaaaa", currentValuation: 250_000 };
      const p2: RealEstate = { ...PROPERTY_A, id: "res_bbbbbbbbbbbbbbbbbbbbb", currentValuation: 400_000 };
      const repo = fakeRepo({
        listWithChildrenForUser: mock(async () => [
          { property: p1, mortgage: MORTGAGE_180K, rental: RENTAL_1200 },
          { property: p2, mortgage: null, rental: null },
        ]),
      });
      const service = createRealestateService({ repository: repo });
      const out = await service.listPropertyDerives(USER_A);
      expect(out).toEqual([
        { propertyId: p1.id, monthlyCashFlowEur: 400, netEquityEur: 70_000 },
        { propertyId: p2.id, monthlyCashFlowEur: null, netEquityEur: 400_000 },
      ]);
    });
  });
  ```
  Run: `cd apps/api && bun test src/modules/realestate/realestate.service.test.ts`
  Expected (TDD RED): the 8 new tests fail because `service.getPropertyDerives`, `service.listPropertyDerives`, `service.getTotalEquity` are `undefined`. All 4-1 service tests still pass. Exit non-zero.
  Commit: `git add apps/api/src/modules/realestate/realestate.service.test.ts && git commit -m "test(#25): realestate derive service (RED)"`

- [ ] **T11** — Implement the 3 service methods (TDD GREEN) in `apps/api/src/modules/realestate/realestate.service.ts`. [AC: AC-3, AC-4, AC-5, AC-6, AC-7]
  Step 1 — add imports at the top of the file. Replace the existing import block:
  ```ts
  import type {
    AttachMortgageInput,
    AttachRentalInput,
    CreatePropertyInput,
    DeletePropertyInput,
    DetachMortgageInput,
    DetachRentalInput,
    GetPropertyInput,
    ListValuationsInput,
    PropertyWithChildren,
    RealEstate,
    RealEstateMortgage,
    RealEstateRental,
    RealEstateValuation,
    RecordValuationInput,
    UpdateMortgageInput,
    UpdateRentalInput,
  } from "@pekulo/validators";
  import {
    mortgageAlreadyAttached,
    mortgageNotFound,
    realestateNotFound,
    rentalAlreadyAttached,
    rentalNotFound,
  } from "./realestate.errors";
  import type { RealestateRepository } from "./realestate.repository";
  ```
  with:
  ```ts
  import type {
    AttachMortgageInput,
    AttachRentalInput,
    CreatePropertyInput,
    DeletePropertyInput,
    DetachMortgageInput,
    DetachRentalInput,
    GetPropertyInput,
    ListPropertyDerivesOutput,
    ListValuationsInput,
    PropertyDerives,
    PropertyWithChildren,
    RealEstate,
    RealEstateMortgage,
    RealEstateRental,
    RealEstateValuation,
    RecordValuationInput,
    TotalEquityOutput,
    UpdateMortgageInput,
    UpdateRentalInput,
  } from "@pekulo/validators";
  import { computePropertyEquity } from "../../common/derive/property-equity";
  import { computeRentalCashFlow } from "../../common/derive/rental-cashflow";
  import {
    mortgageAlreadyAttached,
    mortgageNotFound,
    realestateNotFound,
    rentalAlreadyAttached,
    rentalNotFound,
  } from "./realestate.errors";
  import type { RealestateRepository } from "./realestate.repository";
  ```
  Step 2 — extend the `RealestateService` interface. Replace the existing block:
  ```ts
  export interface RealestateService {
    createProperty(userId: string, input: CreatePropertyInput): Promise<RealEstate>;
    getProperty(userId: string, input: GetPropertyInput): Promise<PropertyWithChildren>;
    listProperties(userId: string): Promise<RealEstate[]>;
    attachMortgage(userId: string, input: AttachMortgageInput): Promise<RealEstateMortgage>;
    updateMortgage(userId: string, input: UpdateMortgageInput): Promise<RealEstateMortgage>;
    detachMortgage(userId: string, input: DetachMortgageInput): Promise<{ ok: true }>;
    attachRental(userId: string, input: AttachRentalInput): Promise<RealEstateRental>;
    updateRental(userId: string, input: UpdateRentalInput): Promise<RealEstateRental>;
    detachRental(userId: string, input: DetachRentalInput): Promise<{ ok: true }>;
    recordValuation(userId: string, input: RecordValuationInput): Promise<RealEstate>;
    listValuations(userId: string, input: ListValuationsInput): Promise<RealEstateValuation[]>;
    deleteProperty(userId: string, input: DeletePropertyInput): Promise<{ ok: true }>;
  }
  ```
  with (3 methods appended at the end of the interface):
  ```ts
  export interface RealestateService {
    createProperty(userId: string, input: CreatePropertyInput): Promise<RealEstate>;
    getProperty(userId: string, input: GetPropertyInput): Promise<PropertyWithChildren>;
    listProperties(userId: string): Promise<RealEstate[]>;
    attachMortgage(userId: string, input: AttachMortgageInput): Promise<RealEstateMortgage>;
    updateMortgage(userId: string, input: UpdateMortgageInput): Promise<RealEstateMortgage>;
    detachMortgage(userId: string, input: DetachMortgageInput): Promise<{ ok: true }>;
    attachRental(userId: string, input: AttachRentalInput): Promise<RealEstateRental>;
    updateRental(userId: string, input: UpdateRentalInput): Promise<RealEstateRental>;
    detachRental(userId: string, input: DetachRentalInput): Promise<{ ok: true }>;
    recordValuation(userId: string, input: RecordValuationInput): Promise<RealEstate>;
    listValuations(userId: string, input: ListValuationsInput): Promise<RealEstateValuation[]>;
    deleteProperty(userId: string, input: DeletePropertyInput): Promise<{ ok: true }>;
    // Story 4-2 — pure-derive surface (FR-24 / FR-25 / FR-26)
    getPropertyDerives(userId: string, input: GetPropertyInput): Promise<PropertyDerives>;
    listPropertyDerives(userId: string): Promise<ListPropertyDerivesOutput>;
    getTotalEquity(userId: string): Promise<TotalEquityOutput>;
  }
  ```
  Step 3 — append the 3 method implementations inside the returned object of `createRealestateService` (after the existing `deleteProperty` method, before the final closing `};`):
  ```ts
      async getPropertyDerives(userId, input) {
        const property = await repository.findByIdForUser(userId, input.id);
        if (!property) throw realestateNotFound();
        const [mortgage, rental] = await Promise.all([
          repository.findMortgageForUser(userId, input.id),
          repository.findRentalForUser(userId, input.id),
        ]);
        return {
          monthlyCashFlowEur: computeRentalCashFlow({
            rental: rental
              ? { monthlyRent: rental.monthlyRent, monthlyCharges: rental.monthlyCharges }
              : null,
            mortgage: mortgage ? { monthlyPayment: mortgage.monthlyPayment } : null,
          }),
          netEquityEur: computePropertyEquity({
            property: { currentValuation: property.currentValuation },
            mortgage: mortgage ? { outstandingPrincipal: mortgage.outstandingPrincipal } : null,
          }),
        };
      },

      async listPropertyDerives(userId) {
        const rows = await repository.listWithChildrenForUser(userId);
        return rows.map(({ property, mortgage, rental }) => ({
          propertyId: property.id,
          monthlyCashFlowEur: computeRentalCashFlow({
            rental: rental
              ? { monthlyRent: rental.monthlyRent, monthlyCharges: rental.monthlyCharges }
              : null,
            mortgage: mortgage ? { monthlyPayment: mortgage.monthlyPayment } : null,
          }),
          netEquityEur: computePropertyEquity({
            property: { currentValuation: property.currentValuation },
            mortgage: mortgage ? { outstandingPrincipal: mortgage.outstandingPrincipal } : null,
          }),
        }));
      },

      async getTotalEquity(userId) {
        const rows = await repository.listWithChildrenForUser(userId);
        const perProperty = rows.map(({ property, mortgage }) => ({
          propertyId: property.id,
          netEquityEur: computePropertyEquity({
            property: { currentValuation: property.currentValuation },
            mortgage: mortgage ? { outstandingPrincipal: mortgage.outstandingPrincipal } : null,
          }),
        }));
        const totalEquityEur = perProperty.reduce((sum, p) => sum + p.netEquityEur, 0);
        return { totalEquityEur, perProperty };
      },
  ```
  Run: `cd apps/api && bun test src/modules/realestate/realestate.service.test.ts`
  Expected (GREEN): all 4-1 service tests + the 8 new 4-2 service tests pass. Exit 0.
  Commit: `git add apps/api/src/modules/realestate/realestate.service.ts && git commit -m "feat(#25): realestate derive service (GREEN) [FR-24/25/26]"`

- [ ] **T12** — Append the 3 oRPC handlers to `apps/api/src/modules/realestate/realestate.routes.ts`. [AC: AC-6, AC-12]
  Locate the existing `router({ … })` block. The current block ends with the `deleteProperty:` handler. Append these 3 handlers **after** the `deleteProperty` handler, before the closing `})`:
  ```ts
      // ─── 4-2 — derive surface ─────────────────────────────────────
      getPropertyDerives: impl.getPropertyDerives.handler(async ({ context, input, errors }) => {
        requireUserId(context.userId);
        try {
          return await deps.service.getPropertyDerives(context.userId, input);
        } catch (err) {
          if (err instanceof RealestateError && err.code === "REALESTATE_NOT_FOUND") {
            throw errors.REALESTATE_NOT_FOUND({ message: err.message });
          }
          throw err;
        }
      }),

      listPropertyDerives: impl.listPropertyDerives.handler(async ({ context }) => {
        requireUserId(context.userId);
        return deps.service.listPropertyDerives(context.userId);
      }),

      getTotalEquity: impl.getTotalEquity.handler(async ({ context }) => {
        requireUserId(context.userId);
        return deps.service.getTotalEquity(context.userId);
      }),
  ```
  Run: `bun --filter='@pekulo/api' run typecheck`
  Expected: exit 0. (No new test added in T12 — handler wiring is exercised by the integration test in T14.)
  Commit: `git add apps/api/src/modules/realestate/realestate.routes.ts && git commit -m "feat(#25): wire derive procedures into realestate router"`

- [ ] **T13** — Extend the whole-module wired test at `apps/api/src/modules/realestate/realestate.module.test.ts`. [AC: AC-3, AC-4, AC-5, AC-7]
  Append the following `describe` block at the **end** of the file:
  ```ts
  describe("realestate.module — derives (story 4-2)", () => {
    test("AC-1 + AC-2 — wired flow returns cashflow=400 and equity=70000 via service", async () => {
      const fake = makeFakePrisma();
      const mod = createRealestateModule({
        prismaService: { client: fake.client } as unknown as PrismaService,
      });
      const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      const p = await mod.service.createProperty(userId, {
        label: "P-derive",
        propertyType: "locatif",
        currentValuation: 250_000,
        lastValuedOn: new Date("2026-01-01"),
      });
      await mod.service.attachMortgage(userId, {
        propertyId: p.id,
        outstandingPrincipal: 180_000,
        annualRate: 0.025,
        monthlyPayment: 600,
        termMonths: 240,
        startDate: new Date("2020-01-01"),
      });
      await mod.service.attachRental(userId, {
        propertyId: p.id,
        monthlyRent: 1200,
        monthlyCharges: 200,
        furnished: false,
      });
      const derives = await mod.service.getPropertyDerives(userId, { id: p.id });
      expect(derives).toEqual({ monthlyCashFlowEur: 400, netEquityEur: 70_000 });
    });

    test("AC-3 — wired flow getTotalEquity sums net equity across all properties", async () => {
      const fake = makeFakePrisma();
      const mod = createRealestateModule({
        prismaService: { client: fake.client } as unknown as PrismaService,
      });
      const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      const p1 = await mod.service.createProperty(userId, {
        label: "P1",
        propertyType: "locatif",
        currentValuation: 250_000,
        lastValuedOn: new Date("2026-01-01"),
      });
      await mod.service.attachMortgage(userId, {
        propertyId: p1.id,
        outstandingPrincipal: 180_000,
        annualRate: 0.025,
        monthlyPayment: 600,
        termMonths: 240,
        startDate: new Date("2020-01-01"),
      });
      await mod.service.createProperty(userId, {
        label: "P2",
        propertyType: "residence-principale",
        currentValuation: 400_000,
        lastValuedOn: new Date("2026-01-01"),
      });
      const out = await mod.service.getTotalEquity(userId);
      expect(out.totalEquityEur).toBe(70_000 + 400_000);
      expect(out.perProperty).toHaveLength(2);
    });
  });
  ```
  Run: `cd apps/api && bun test src/modules/realestate/realestate.module.test.ts`
  Expected: all 4-1 module tests + the 2 new 4-2 tests pass. Exit 0.
  Commit: `git add apps/api/src/modules/realestate/realestate.module.test.ts && git commit -m "test(#25): module-level wire for derives"`

- [ ] **T14** — Extend the HTTP-boundary integration tests at `apps/api/src/modules/realestate/realestate.integration.test.ts`. [AC: AC-3, AC-6, AC-7, AC-12]
  Append the following `describe` block at the **end** of the file (uses the already-bound `baseUrl` + `signFor` helpers from the 4-1 `beforeAll`):
  ```ts
  describe("realestate.integration — derives (story 4-2)", () => {
    test("AC-12 — 401 on getPropertyDerives without JWT", async () => {
      const res = await fetch(`${baseUrl}/rpc/v1/realestate/getPropertyDerives`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "res_xxxxxxxxxxxxxxxxxxxxx" }),
      });
      expect(res.status).toBe(401);
    });

    test("AC-12 — 401 on listPropertyDerives without JWT", async () => {
      const res = await fetch(`${baseUrl}/rpc/v1/realestate/listPropertyDerives`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });

    test("AC-12 — 401 on getTotalEquity without JWT", async () => {
      const res = await fetch(`${baseUrl}/rpc/v1/realestate/getTotalEquity`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });

    test("AC-1 + AC-2 — happy 200 getPropertyDerives composes cashflow=400 + equity=70000", async () => {
      const jwt = await signFor(USER_A);
      // create the property + attach mortgage + attach rental via the
      // already-shipped 4-1 procedures, then exercise the 4-2 derive.
      const created = await fetch(`${baseUrl}/rpc/v1/realestate/createProperty`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          label: "P-derive",
          propertyType: "locatif",
          currentValuation: 250_000,
          lastValuedOn: "2026-01-01",
        }),
      });
      expect(created.status).toBe(200);
      const property = await created.json();
      await fetch(`${baseUrl}/rpc/v1/realestate/attachMortgage`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          propertyId: property.id,
          outstandingPrincipal: 180_000,
          annualRate: 0.025,
          monthlyPayment: 600,
          termMonths: 240,
          startDate: "2020-01-01",
        }),
      });
      await fetch(`${baseUrl}/rpc/v1/realestate/attachRental`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          propertyId: property.id,
          monthlyRent: 1200,
          monthlyCharges: 200,
          furnished: false,
        }),
      });
      const derivesRes = await fetch(`${baseUrl}/rpc/v1/realestate/getPropertyDerives`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ id: property.id }),
      });
      expect(derivesRes.status).toBe(200);
      expect(await derivesRes.json()).toEqual({ monthlyCashFlowEur: 400, netEquityEur: 70_000 });
    });

    test("AC-6 — cross-user getPropertyDerives → 404 REALESTATE_NOT_FOUND", async () => {
      const jwtA = await signFor(USER_A);
      const jwtB = await signFor(USER_B);
      const created = await fetch(`${baseUrl}/rpc/v1/realestate/createProperty`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jwtA}` },
        body: JSON.stringify({
          label: "A-only",
          propertyType: "locatif",
          currentValuation: 250_000,
          lastValuedOn: "2026-01-01",
        }),
      });
      const property = await created.json();
      const res = await fetch(`${baseUrl}/rpc/v1/realestate/getPropertyDerives`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jwtB}` },
        body: JSON.stringify({ id: property.id }),
      });
      expect(res.status).toBe(404);
    });

    test("AC-7 — listPropertyDerives + getTotalEquity on empty account → [] and zero", async () => {
      // Fresh integration suite (port-0) → no prior properties for USER_B in
      // this run unless created above. To be deterministic, sign for a
      // brand-new UUID that has zero rows in the fake.
      const FRESH = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
      const jwt = await signFor(FRESH);
      const listRes = await fetch(`${baseUrl}/rpc/v1/realestate/listPropertyDerives`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jwt}` },
        body: JSON.stringify({}),
      });
      expect(listRes.status).toBe(200);
      expect(await listRes.json()).toEqual([]);
      const totalRes = await fetch(`${baseUrl}/rpc/v1/realestate/getTotalEquity`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jwt}` },
        body: JSON.stringify({}),
      });
      expect(totalRes.status).toBe(200);
      expect(await totalRes.json()).toEqual({ totalEquityEur: 0, perProperty: [] });
    });

    test("AC-3 — getTotalEquity sums 3 properties to 450000", async () => {
      const FRESH = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
      const jwt = await signFor(FRESH);
      // Seed 3 properties via the 4-1 procedures.
      const seed = async (valuation: number, debt: number | null) => {
        const created = await fetch(`${baseUrl}/rpc/v1/realestate/createProperty`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${jwt}` },
          body: JSON.stringify({
            label: `seed-${valuation}`,
            propertyType: "locatif",
            currentValuation: valuation,
            lastValuedOn: "2026-01-01",
          }),
        });
        const p = await created.json();
        if (debt !== null) {
          await fetch(`${baseUrl}/rpc/v1/realestate/attachMortgage`, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${jwt}` },
            body: JSON.stringify({
              propertyId: p.id,
              outstandingPrincipal: debt,
              annualRate: 0.025,
              monthlyPayment: 600,
              termMonths: 240,
              startDate: "2020-01-01",
            }),
          });
        }
      };
      await seed(250_000, 180_000); // +70k
      await seed(400_000, null);    // +400k
      await seed(100_000, 120_000); // -20k
      const totalRes = await fetch(`${baseUrl}/rpc/v1/realestate/getTotalEquity`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jwt}` },
        body: JSON.stringify({}),
      });
      expect(totalRes.status).toBe(200);
      const body = await totalRes.json();
      expect(body.totalEquityEur).toBe(450_000);
      expect(body.perProperty).toHaveLength(3);
      expect(body.perProperty.map((p: { netEquityEur: number }) => p.netEquityEur).sort((a: number, b: number) => a - b)).toEqual([-20_000, 70_000, 400_000]);
    });
  });
  ```
  Run: `cd apps/api && bun test src/modules/realestate/realestate.integration.test.ts`
  Expected: all 4-1 integration tests + the 6 new 4-2 tests pass. Exit 0.
  Commit: `git add apps/api/src/modules/realestate/realestate.integration.test.ts && git commit -m "test(#25): HTTP boundary for derive procedures"`

- [ ] **T15** — Annotate the forward-pointer in `apps/web/src/lib/zapaction/keys.ts`. [AC: AC-13]
  No new code — only a clarifying comment so future 4-3 / 7-1 reviewers understand that the realestate tag set already covers the 4-2 derive procedures. Locate the existing `setTagRegistry({…})` block; find these two entries:
  ```ts
    [realestateTags.all()]: [realestateKeys.list()],
    [realestateTags.list()]: [realestateKeys.list()],
  ```
  Replace with:
  ```ts
    // Realestate (story 4-1 + 4-2) — the `list` tag invalidates the
    // realestate aggregate keys; the 4-2 derives are stateless reads of
    // the same aggregate, so any mutation that bumps `list` also
    // invalidates `getPropertyDerives` / `listPropertyDerives` /
    // `getTotalEquity` consumers transparently. Stories 4-3 (UI) and 7-1
    // (dashboard) will add cross-feature edges (e.g.
    // realestateTags.list → dashboardKeys.cap) when they ship.
    [realestateTags.all()]: [realestateKeys.list()],
    [realestateTags.list()]: [realestateKeys.list()],
  ```
  Run: `bun --filter=web run typecheck`
  Expected: exit 0.
  Commit: `git add apps/web/src/lib/zapaction/keys.ts && git commit -m "docs(#25): forward-pointer note for 4-3/7-1 on realestate tag"`

- [ ] **T16** — Full quality gate. [AC: AC-13]
  Run each of the following in sequence; every command MUST exit 0:
  ```bash
  bun --filter='@pekulo/api' run lint
  bun --filter='@pekulo/api' run typecheck
  bun --filter='@pekulo/api' test
  bun --filter='@pekulo/*' run typecheck
  ```
  Expected outputs:
  - `lint` → `Found 0 warnings and 0 errors`
  - `typecheck` (api + workspace fan-out) → no output, exit 0
  - `test` → all 4-1 suites still green + new 4-2 suites green. Look for `realestate.repository.test.ts`, `realestate.service.test.ts`, `realestate.module.test.ts`, `realestate.integration.test.ts`, `rental-cashflow.test.ts`, `property-equity.test.ts` all reporting `pass`, no `fail`.

  After all 4 commands exit 0, push the branch:
  ```bash
  git push -u origin feature/25-4-2-realestate-derives
  ```
  Then update `docs/state.yaml` (worktree-local copy if in worktree mode):
  ```yaml
  4-2-realestate-derives: {status: review, depends_on: [4-1-realestate-domain], ticket: "#25", worktree: null, started_at: "<ISO timestamp at GREEN>", completed_at: "<ISO timestamp at quality-gate-green>"}
  ```
  (No commit for state.yaml here — `aped-review` owns the final status flip after PR merge.)

## Dev Notes

### Architecture references

- **Pure derive layer (architecture L1184-1190)** — `apps/api/src/common/derive/` houses inputs-by-argument helpers consumed by service modules. Precedent in the same directory: `portfolio-fx.ts`, `holding-pnl.ts`, `holding-quantity.ts`, `compass-progress.ts`, `compass-curve.ts`, `milestone-status.ts`, `decimal-to-number.ts`. **Pure rules (AC-8):** no `prisma`, no `fetch`, no `Date.now()`, no `@opentelemetry/*`.
- **FR-26 routing (architecture L1057)** — `Include net equity in compass total wealth` is owned by `dashboard.service.ts#computeTotalWealth` (story 7-1). 4-2 exposes the primitive (`realestate.service.getTotalEquity(userId)`); 7-1 consumes it. 4-2's contract surface is the API on which 7-1 builds — do not write the dashboard module here.
- **Additive contract extension (4-1 immutability)** — 4-1 shipped 12 procedures on `realestateContract`. T7 appends 3 NEW procedures (`getPropertyDerives`, `listPropertyDerives`, `getTotalEquity`) **without** modifying any of the 12. This avoids re-running the 4-1 reviewer pass and keeps the contract version on v1.
- **N+1 budget — `listWithChildrenForUser` (AC-11)** — single Prisma `findMany` with `include: { mortgage: true, rental: true }`. Mirrors the standard Prisma 1:1 join — one DB round-trip even for 50 properties (NFR-16). The repo test asserts the call shape via the fake Prisma counter.
- **L24 — decimal coercion at the boundary** — every field surfaced by `listWithChildrenForUser` already flows through the existing `toProperty` / `toMortgage` / `toRental` row mappers (which use `decimalToNumber(value, fallback)` from `apps/api/src/common/derive/decimal-to-number.ts`). T9's implementation reuses those mappers — no inline `Number(decimal)` introduced.
- **L1 — zero `*.types.ts`** — `PropertyDerives`, `PropertyDerivesItem`, `ListPropertyDerivesOutput`, `TotalEquityOutput` all live in `@pekulo/validators` (via `z.infer`) and are re-exported from `@pekulo/types`. **Do not create `apps/api/src/modules/realestate/realestate.types.ts`** — AC-9 grep guard.
- **L8 — Elysia type invariance** — T12's handlers extend the existing `impl.router({…})` block. No bare `Elysia` annotation is added; the inferred router type remains `ReturnType<typeof createRealestateRouter>` per 4-1's L8 invariant.
- **R1 — `@pekulo/zod` only (PR #86, 2026-05-20)** — T5 uses the existing `import { z } from "@pekulo/zod"` at the top of `realestate.schemas.ts`. No direct `from "zod"` is introduced. AC-10 grep guard.

### ADRs in scope

- `docs/adr/0001-audit-history-via-sister-tables.md` — N/A for 4-2 (no new writes; derives are read-only).
- `docs/adr/0009-elysia-orpc-with-zapaction-bridge.md` — additive procedures on the realestate contract; mount path unchanged at `/rpc/v1/realestate`.
- `docs/adr/0010-hooks-orchestration-boundary.md` — forward-pointer for 4-3 UI work (out of 4-2 scope).
- `docs/adr/0011-packages-reorg-pekulo-namespace.md` — Domain types stay in `@pekulo/types`; new schemas in `@pekulo/validators` (R1 amendment from PR #86 applies).
- `docs/adr/0012-prisma-7-schema-folder-prefixed-ids.md` — no schema change.
- `docs/adr/0013-prisma-rls-defense-in-depth.md` — `listWithChildrenForUser` carries explicit `where: { userId }` (T9). Lint rule `pekulo/no-prisma-query-without-user-id` blocks omission.

### Lessons re-applied (verbatim scope-list from `docs/lessons.md`)

- **L1 (zero `*.types.ts` inside `apps/api/src/modules/**`)** — 4-2 conformance: every new type is a `z.infer` re-export from `@pekulo/validators`. Internal service / repository / handler interfaces stay co-located in their respective `*.ts` files. AC-9 grep guard.
- **L8 (Elysia 1.4 `Elysia` type is invariant)** — T12 appends 3 handlers to the existing `impl.router({…})`. No bare `Elysia` annotation introduced. AC-9 grep guard.
- **L24 (`Number(decimal)` silently truncates)** — `listWithChildrenForUser` reuses the existing `toProperty` / `toMortgage` / `toRental` mappers, which already route through `decimalToNumber`. The pure derives (`rental-cashflow.ts`, `property-equity.ts`) take `number` inputs — no Decimal touches the pure layer.
- **2026-05-20 — `@pekulo/zod` is the SOLE zod entry point (R1, PR #86)** — T5 keeps the existing `import { z } from "@pekulo/zod"`. AC-10 grep guard on the new derive files.
- **2026-05-19 — `bun --filter='@pekulo/api'` (NOT `bun --filter=api`)** — every command in T1-T16 uses the full namespace `@pekulo/api`, quoted.
- **2026-05-07 — `bun test` ≠ `vitest run`** — all new `*.test.ts` under `apps/api/src/**` use `import { describe, expect, mock, test } from "bun:test"`. Never vitest globals.
- **2026-05-05 — `bun --cwd <relative> run <script>` silently fails** — tasks use either `bun --filter='@pekulo/api' run …` for workspace scripts or `cd apps/api && bun test <path>` for direct test invocations.
- **2026-05-04 — Manual SQL migrations preferred over `prisma migrate dev`** — N/A for 4-2 (no DB schema change; 4-1 shipped all 4 tables).
- **2026-05-20 — `defineAction` envelope output (Scope: forward-pointer for 4-3)** — 4-2 is API-only; no web-tier `defineAction` is introduced here. 4-3 will need to omit `output:` on any envelope-returning wrapper around the `getPropertyDerives` contract — forward-pointer for the 4-3 reviewer.
- **L25 — Story-spec UX placement MUST be cross-checked against `docs/ux-preview/src/App.tsx`** — N/A for 4-2 (API-only). UI surfaces belong to 4-3. Pre-Implementation Checklist confirms no UI claim is embedded.

### Step-0 quotes (verbatim current state at write time)

Every file 4-2 modifies has its current state captured here. The dev agent reads this section BEFORE editing — the most common failure mode is the writer's mental model diverging from the actual code.

#### `apps/api/src/modules/realestate/realestate.service.ts` — current shape (4-1, lines 41-54)

```ts
export interface RealestateService {
  createProperty(userId: string, input: CreatePropertyInput): Promise<RealEstate>;
  getProperty(userId: string, input: GetPropertyInput): Promise<PropertyWithChildren>;
  listProperties(userId: string): Promise<RealEstate[]>;
  attachMortgage(userId: string, input: AttachMortgageInput): Promise<RealEstateMortgage>;
  updateMortgage(userId: string, input: UpdateMortgageInput): Promise<RealEstateMortgage>;
  detachMortgage(userId: string, input: DetachMortgageInput): Promise<{ ok: true }>;
  attachRental(userId: string, input: AttachRentalInput): Promise<RealEstateRental>;
  updateRental(userId: string, input: UpdateRentalInput): Promise<RealEstateRental>;
  detachRental(userId: string, input: DetachRentalInput): Promise<{ ok: true }>;
  recordValuation(userId: string, input: RecordValuationInput): Promise<RealEstate>;
  listValuations(userId: string, input: ListValuationsInput): Promise<RealEstateValuation[]>;
  deleteProperty(userId: string, input: DeletePropertyInput): Promise<{ ok: true }>;
}
```

This story extends the interface with 3 new methods (T11). It does not modify any of the 12 existing methods.

#### `apps/api/src/modules/realestate/realestate.repository.ts` — current `RealestateRepository` interface (4-1, lines 60-75)

```ts
export interface RealestateRepository {
  createProperty(userId: string, input: CreatePropertyInput): Promise<RealEstate>;
  findByIdForUser(userId: string, propertyId: string): Promise<RealEstate | null>;
  listByUser(userId: string): Promise<RealEstate[]>;
  findMortgageForUser(userId: string, propertyId: string): Promise<RealEstateMortgage | null>;
  findRentalForUser(userId: string, propertyId: string): Promise<RealEstateRental | null>;
  attachMortgage(userId: string, input: AttachMortgageInput): Promise<MortgageAttachOutcome>;
  updateMortgage(userId: string, input: UpdateMortgageInput): Promise<MortgageUpdateOutcome>;
  detachMortgage(userId: string, input: DetachMortgageInput): Promise<{ ok: true }>;
  attachRental(userId: string, input: AttachRentalInput): Promise<RentalAttachOutcome>;
  updateRental(userId: string, input: UpdateRentalInput): Promise<RentalUpdateOutcome>;
  detachRental(userId: string, input: DetachRentalInput): Promise<{ ok: true }>;
  recordValuation(userId: string, input: RecordValuationInput): Promise<RecordValuationOutcome>;
  listValuations(userId: string, input: ListValuationsInput): Promise<RealEstateValuation[]>;
  deleteProperty(userId: string, input: DeletePropertyInput): Promise<{ ok: true }>;
}
```

This story extends the interface with one new method `listWithChildrenForUser` (T9). It does not modify any of the 14 existing methods.

#### `packages/contracts/src/realestate/realestate.contract.ts` — current procedure list (4-1, lines 53-105)

The 4-1 contract declares 12 procedures: `createProperty`, `getProperty`, `listProperties`, `attachMortgage`, `updateMortgage`, `detachMortgage`, `attachRental`, `updateRental`, `detachRental`, `recordValuation`, `listValuations`, `deleteProperty`. The closing of the literal is:

```ts
  deleteProperty: oc
    .errors({ REALESTATE_NOT_FOUND: realestateNotFoundError })
    .input(deletePropertyInputSchema)
    .output(realestateOkSchema),
} as const;
```

T7 appends 3 new procedures **between** the existing `deleteProperty` entry and the closing `} as const;`. The 12 existing procedures are not modified.

#### `packages/validators/src/realestate/realestate.schemas.ts` — current closing (4-1, last 4 lines)

```ts
export const realestateOkSchema = z.object({ ok: z.literal(true) });
export type RealestateOk = z.infer<typeof realestateOkSchema>;
```

T5 appends 4 new schemas + their `z.infer` aliases AFTER `realestateOkSchema`. The 4-1 schemas above are not modified.

#### `packages/types/src/realestate/realestate.types.ts` — current re-export block

```ts
export type {
  RealEstate,
  RealEstateMortgage,
  RealEstateRental,
  RealEstateValuation,
  PropertyWithChildren,
} from "@pekulo/validators";
```

T6 replaces this block with an extended version that includes `PropertyDerives`, `PropertyDerivesItem`, `TotalEquityOutput`. The `PROPERTY_TYPES` const, branded IDs and `PropertyCardItem` interface above this block are unchanged.

#### `apps/web/src/lib/zapaction/keys.ts` — current realestate tag entries (4-1 T18)

```ts
  [realestateTags.all()]: [realestateKeys.list()],
  [realestateTags.list()]: [realestateKeys.list()],
```

T15 only ADDS a comment block above these two entries — no behavioural change, no new key, no new tag. The cache invalidation graph for 4-2 derives flows through the existing `realestateTags.list()` because the derives are stateless reads of the same aggregate.

### Pre-Implementation Checklist (story-spec discipline)

- ✅ No UI claim embedded (4-2 is API-only — UI is owned by 4-3, per L25).
- ✅ No new migration (4-1 created all 4 tables; derives are read-only).
- ✅ No new RLS policy (FR-26 derives are read-only over already-protected tables; `rls-audit` counts stay at 4/4/4/2 from 4-1).
- ✅ No new feature key in `apps/web/src/lib/zapaction/keys.ts` — the existing `realestate` aggregate tag carries 4-2's read invalidation transparently.
- ✅ No `defineAction` written in 4-2 (forward-pointer for 4-3 — envelope `output:` discipline applies there).

## File List

**NEW (4 files):**

- `apps/api/src/common/derive/rental-cashflow.ts` (T2)
- `apps/api/src/common/derive/rental-cashflow.test.ts` (T1)
- `apps/api/src/common/derive/property-equity.ts` (T4)
- `apps/api/src/common/derive/property-equity.test.ts` (T3)

**MODIFIED (12 files):**

- `packages/validators/src/realestate/realestate.schemas.ts` (T5 — append 4 schemas)
- `packages/types/src/realestate/realestate.types.ts` (T6 — extend re-export block)
- `packages/contracts/src/realestate/realestate.contract.ts` (T7 — append 3 procedures + 3 schema imports)
- `apps/api/src/modules/realestate/realestate.repository.ts` (T9 — append `listWithChildrenForUser` + interface entry)
- `apps/api/src/modules/realestate/realestate.repository.test.ts` (T8 — append `describe` block)
- `apps/api/src/test/fakes/fake-realestate.ts` (T8 — patch `realEstate.findMany` to honour `include`)
- `apps/api/src/modules/realestate/realestate.service.ts` (T11 — extend imports, interface, factory)
- `apps/api/src/modules/realestate/realestate.service.test.ts` (T10 — extend fakeRepo + append `describe`)
- `apps/api/src/modules/realestate/realestate.routes.ts` (T12 — append 3 handlers)
- `apps/api/src/modules/realestate/realestate.module.test.ts` (T13 — append `describe`)
- `apps/api/src/modules/realestate/realestate.integration.test.ts` (T14 — append `describe`)
- `apps/web/src/lib/zapaction/keys.ts` (T15 — annotate only, no behavioural change)

## Dev Agent Record

- **Model:** claude-opus-4-7[1m]
- **Started:** 2026-05-21T01:00:00Z
- **Completed:** _(filled by aped-review at final merge)_

### Summary

Shipped T1-T16 verbatim against the story spec. Two pure derive helpers (`computeRentalCashFlow`, `computePropertyEquity`) land in `apps/api/src/common/derive/`. Validator schemas + types + contract surface extend with 4 schemas / 3 type aliases / 3 procedures. Repository gains `listWithChildrenForUser` (one Prisma round-trip via `findMany` + `include`); service composes per-property derives + total equity. Three oRPC handlers (`getPropertyDerives`, `listPropertyDerives`, `getTotalEquity`) mounted on the existing realestate router. Whole-module wired test + HTTP integration cover the happy path and the 401/404 contract. Single comment annotation on `apps/web/src/lib/zapaction/keys.ts` documenting the cache-invalidation forward-pointer for stories 4-3 and 7-1.

### Files changed

NEW (4):
- `apps/api/src/common/derive/rental-cashflow.ts` (T2)
- `apps/api/src/common/derive/rental-cashflow.test.ts` (T1)
- `apps/api/src/common/derive/property-equity.ts` (T4)
- `apps/api/src/common/derive/property-equity.test.ts` (T3)

MODIFIED (12):
- `packages/validators/src/realestate/realestate.schemas.ts` (T5)
- `packages/types/src/realestate/realestate.types.ts` (T6)
- `packages/contracts/src/realestate/realestate.contract.ts` (T7)
- `apps/api/src/test/fakes/fake-realestate.ts` (T8 — `findMany` honours `include`)
- `apps/api/src/modules/realestate/realestate.repository.test.ts` (T8)
- `apps/api/src/modules/realestate/realestate.repository.ts` (T9)
- `apps/api/src/modules/realestate/realestate.service.test.ts` (T10)
- `apps/api/src/modules/realestate/realestate.service.ts` (T11)
- `apps/api/src/modules/realestate/realestate.routes.ts` (T12)
- `apps/api/src/modules/realestate/realestate.module.test.ts` (T13)
- `apps/api/src/modules/realestate/realestate.integration.test.ts` (T14)
- `apps/web/src/lib/zapaction/keys.ts` (T15)

Mirrors the File List section above — no deviations from the prescribed file set.

### Deviations

- **T14 — HTTP integration tests use the existing `call()` helper (RPCHandler `{ json: … }` envelope), not raw `fetch`.** The story spec prescribed raw `fetch` with bare bodies (e.g. `body: JSON.stringify({ id: ... })`). The 4-1 integration suite already established that oRPC RPCHandler mounted via `mountOrpc` follows the plain-protocol convention — request bodies are wrapped as `{ json: <input> }` and response bodies as `{ json: <output> }` (see warm-up at lines 87-94, helper at lines 102-111, every 4-1 test at 144, 160, 187, 213, 230, 237, 242, 259, 262, 279). Following the story verbatim would surface the new procedures via a payload shape the server rejects. The new 6 tests therefore use `call(path, body, jwt?)` and unwrap responses as `{ json: actualData }` — AC semantics (status codes, business values) preserved.
- **T5 / T16 lint commands.** `bun --filter='@pekulo/validators' run lint` and `bun --filter='@pekulo/api' run lint` exit "No packages matched the filter" because neither package declares a `lint` script. Ran `npx oxlint <path>` directly: clean.
- **T15 typecheck cache.** `bun --filter=web run typecheck` initially failed with a pre-existing `.next/dev/types/validator.ts` error referencing a deleted route file. Cleared `apps/web/.next/dev/types` + `apps/web/.next/dev/turbopack`; typecheck returned 0. Cause unrelated to T15 (purely additive comment).

### Test output

Quality gate (T16) — final commands:

```
$ npx oxlint apps/api/src
Found 0 warnings and 0 errors.
Finished in 152ms on 120 files with 158 rules using 10 threads.

$ bun --filter='@pekulo/api' run typecheck
@pekulo/api typecheck: Exited with code 0

$ cd apps/api && bun test
 414 pass
 0 fail
 996 expect() calls
Ran 414 tests across 47 files. [1109.00ms]

$ bun --filter='@pekulo/*' run typecheck
@pekulo/zod typecheck: Exited with code 0
@pekulo/validators typecheck: Exited with code 0
@pekulo/oxlint-config typecheck: Exited with code 0
@pekulo/types typecheck: Exited with code 0
@pekulo/contracts typecheck: Exited with code 0
@pekulo/ui typecheck: Exited with code 0
@pekulo/api typecheck: Exited with code 0
```

Per-suite spot checks at GREEN:
- `rental-cashflow.test.ts` → 5 pass / 0 fail
- `property-equity.test.ts` → 4 pass / 0 fail
- `realestate.repository.test.ts` → 31 pass / 0 fail (27 existing + 4 new)
- `realestate.service.test.ts` → 21 pass / 0 fail (13 existing + 8 new)
- `realestate.module.test.ts` → 5 pass / 0 fail (3 existing + 2 new)
- `realestate.integration.test.ts` → 15 pass / 0 fail (9 existing + 6 new)

## Review Record

**Date:** 2026-05-21
**Auditors:** Spec, Code, Edge & Hallucination (Aria not dispatched — backend surface with a comment-only frontend touch)
**Verdict:** done

### Findings

#### Resolved

- [MAJOR] AC-11 — "exactly one `findMany` call" assertion missing [`apps/api/src/modules/realestate/realestate.repository.test.ts:434-462`, `apps/api/src/test/fakes/fake-realestate.ts:96-119`]
  - Source: Code auditor (MAJOR) + Spec auditor (MINOR — diagnostic agreement)
  - Resolution: commit `0c870bc` — exposed `fake.callCounts.realEstateFindMany` counter; rewrote the AC-11 test against a 3-property fixture asserting `delta === 1`. Catches a future `findMany`-per-row N+1 regression.

- [MAJOR] Anti-pattern #3 — fake `findMany` `include` returned `undefined` instead of `null`/omitted key for unselected children [`apps/api/src/test/fakes/fake-realestate.ts:105-118`]
  - Source: Code auditor
  - Resolution: commit `0c870bc` — fake now returns `null` (not `undefined`) when `include.X` is falsy, matching the production cast `& { mortgage: …|null; rental: …|null }`. Production code path unchanged (always passes both `include` flags).

- [MINOR] No HTTP 200 + non-empty body assertion for `listPropertyDerives` [`apps/api/src/modules/realestate/realestate.integration.test.ts:387-446`]
  - Source: Code auditor
  - Resolution: commit `0c870bc` — added integration test seeding 2 properties via `call()` helper and asserting per-property derives at the wire boundary (`{400, 70_000}` + `{null, 400_000}`). Closes the schema-validation gap at the RPC envelope.

- [MINOR] `ListPropertyDerivesOutput` not re-exported from `@pekulo/types` [`packages/types/src/realestate/realestate.types.ts:19-29`]
  - Source: Edge auditor
  - Resolution: commit `0c870bc` — added to the export block alongside its 3 siblings (`PropertyDerives`, `PropertyDerivesItem`, `TotalEquityOutput`).

- [NIT] AC-12 NFR-9 latency (< 100 ms) on the 3 new procedures' 401 paths [`apps/api/src/modules/realestate/realestate.integration.test.ts:289-318`]
  - Source: Spec auditor
  - Resolution: commit `f07d63e` — wrapped each 401 test with `performance.now()` delta + `expect(elapsed).toBeLessThan(100)`. A future per-route async middleware regression is caught here, not just at the generic `createProperty` 4-1 test.

- [NIT] AC-8 grep guard had 4 doc-comment hits on the literal token list [`apps/api/src/common/derive/rental-cashflow.ts:4-5`, `apps/api/src/common/derive/property-equity.ts:4-5`]
  - Source: Spec auditor
  - Resolution: commit `f07d63e` — rephrased the comments to "DB / network / clock / telemetry imports". The literal `grep 'prisma|fetch|Date.now|@opentelemetry'` now returns zero matches against the derive helpers (semantic intent unchanged).

- [NIT] Race window `getPropertyDerives` vs concurrent `detachMortgage`/`detachRental` [`apps/api/src/modules/realestate/realestate.service.ts:152-171`]
  - Source: Edge auditor
  - Resolution: commit `f07d63e` — introduced `repository.findByIdWithChildrenForUser(userId, propertyId)` (one Prisma `findFirst` + `include: { mortgage: true, rental: true }`), routed the service through it. Atomic snapshot replaces the 3-call sequence. 4-1's `getProperty` keeps its own pattern — forward-pointer noted in the new interface entry for a future cross-module refactor.

- [NIT] Tautological assertion `typeof mod.service.createProperty === "function"` [`apps/api/src/modules/realestate/realestate.module.test.ts:18-23`]
  - Source: Code auditor
  - Resolution: commit `f07d63e` — deleted the entire tautology test. Wired-flow tests below already cover the contract (round-trip + atomic valuation + 2 new derives tests).

#### Dismissed

_None — every flagged finding was actioned._

#### Unresolved

_None._

### Verification

- Test command (final pass): `cd apps/api && bun test src/common/derive/rental-cashflow.test.ts src/common/derive/property-equity.test.ts src/modules/realestate/realestate.repository.test.ts src/modules/realestate/realestate.service.test.ts src/modules/realestate/realestate.module.test.ts src/modules/realestate/realestate.integration.test.ts`
- Test output: `84 pass / 0 fail / 147 expect() calls — Ran 84 tests across 6 files. [178ms]`
- Workspace typecheck: `bun --filter='@pekulo/*' run typecheck` — 7 packages exit 0 (`@pekulo/zod`, `@pekulo/validators`, `@pekulo/oxlint-config`, `@pekulo/types`, `@pekulo/contracts`, `@pekulo/ui`, `@pekulo/api`).
- Lint: `npx oxlint` — `Found 0 warnings and 0 errors. (30 files, 158 rules)`
- Live grep invariants — AC-8: 0 matches against derive helpers; AC-9: 0 matches + zero `*.types.ts`; AC-10: 0 matches; L24 `Number(.*Decimal`: 0 matches in `apps/api/src/modules/realestate`.
- HTTP boundary: RPC trace logs in the test run confirm 401 × 3, 200 happy `getPropertyDerives`, 200 happy `listPropertyDerives` (non-empty), 200 happy `getTotalEquity` (3 properties → 450 000), 404 cross-user.
- Visual verification: N/A (backend story; T15 was comment-only).

### Ticket sync

- Ticket comment posted: see step-5 output
- PR opened/updated: see step-5 output
