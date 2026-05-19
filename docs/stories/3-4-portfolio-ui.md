# Story: 3-4-portfolio-ui — Portefeuille screen + holdings actions co-located + lib/actions/ retirement

**Epic:** Epic 3 — Holdings & portfolio (extended brownfield + crypto)
**Status:** review
**Ticket:** [#23](https://github.com/yabafre/pekulo/issues/23)
**Branch:** `feature/23-3-4-portfolio-ui`
**Commit prefix:** `feat(#23): …`
**Depends on:** 3-1-holdings-orpc-port (done), 3-2-prices-fallback-chain (done), 3-3-portfolio-fx (done), 0-10-pekulo-ui-migration (done)
**Complexity:** L (16 tasks — UI + brownfield retirement + cross-feature action co-location refactor)

## User Story

**As a** Pekulo user, **I want** the Portefeuille screen at `/dashboard/portefeuille` with a EUR-FX-adjusted hero (total + signed unrealised PnL), the ETF / Actions / Crypto répartition (mini-donut per class), the lignes list per holding, and three CRUD forms (create / record lot / close), **so that** I can manage my placements end-to-end on web from V1 (FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20).

Beyond the UI scope, this story closes the brownfield circuit opened by 3-1/3-2/3-3: the 14 Supabase-direct / pre-port files in `apps/web/src/lib/{actions,data,services,schemas}/` for portfolio + holding-lots are deleted, and the 3 sibling action files that still have consumers (`accounts-actions.ts`, `compass-actions.ts`, `milestones-actions.ts`) are **moved into their owning route folder** under `_actions/`. The `apps/web/src/lib/actions/` directory is removed entirely. This sets the precedent: every Pekulo feature lives in a single co-located route folder (`_actions/` + `_components/` + `_hooks/`).

## Acceptance Criteria

- **AC-1 (hero + répartition + 6 holdings render):** **Given** the seed dataset of six holdings (CW8, PE500, VWCE, AAPL, BTC, ETH) is present, **When** I land on `/dashboard/portefeuille`, **Then** (a) the hero section shows the FX-adjusted EUR total value with a signed unrealised PnL in `$accent` (gain ≥ 0 emerald, loss < 0 `$danger`), (b) the Répartition section renders three `ClassRow` entries (ETF / Actions / Crypto) each with a `PekuloDonut size={24} stroke={2.5}` and `pct` derived from `marketValueEur / totalEur`, (c) the Lignes section renders six `HoldingRow` entries with ticker · kind · label · account · qty × current-price · market value · signed PnL. [FR-13, FR-16, FR-17, FR-18, FR-19]

- **AC-2 (lot form re-derives WAC):** **Given** an existing holding with three buy lots, **When** I open the lot form via the `HoldingRow` kebab → "Enregistrer un lot", record a `sell` lot of `{ quantity: 2, priceUnit: 95, fees: 1, occurredOn: <today> }`, and confirm, **Then** (a) the oRPC `holdings.recordLot` succeeds, (b) `holdingsKeys.list()` is invalidated, (c) the row re-renders with the new derived `quantity` and `avgCost` from `derive/holding-quantity` (zero-lot fallback path is NOT triggered — this holding has lots), (d) the response surfaces `RecordLotResult.ok === true`. [FR-14, FR-15]

- **AC-3 (close holding is idempotent + closed-state filter):** **Given** an active holding, **When** I open the close-confirm dialog and click "Marquer comme clôturé", **Then** (a) the SA returns `{ ok: true }`, (b) the holding disappears from the default `useHoldings` list (because `listHoldingsInputSchema.default = { includeClosed: false }`), (c) re-confirming a second time still returns `{ ok: true }` (idempotent per 3-1 decision), (d) the lots remain queryable via `holdings.recordLot`-rejection guard `HOLDING_CLOSED` — verified at the SA layer by `useRecordLot` surfacing the envelope `{ ok: false, code: "HOLDING_CLOSED" }`. [FR-20]

- **AC-4 (create holding — multi-currency, multi-kind):** **Given** the create form is open, **When** I submit `{ accountId: <PEA>, kind: "etf", ticker: "CW8", label: "Amundi CW8", currency: "EUR", quantity: 10, avgCost: 24.5 }`, **Then** (a) the SA returns the new `Holding`, (b) `holdingsKeys.list()` is invalidated, (c) the row appears in `Lignes`. Repeat with `{ kind: "crypto", ticker: "BTC-USD", currency: "USD", quantity: 0.05, avgCost: 60_000 }` — the crypto enum (3-1 extension) and USD currency are accepted, the FX path (3-3) converts the market value to EUR for the hero total. [FR-13]

- **AC-5 (nav rail wires Portfolio → /dashboard/portefeuille):** **Given** I'm on `/dashboard` (Cap or Patrimoine tab), **When** I click "Portefeuille" in the side `PekuloNavRail` (desktop) or `PekuloMobileBottomNav` (mobile), **Then** `router.push("/dashboard/portefeuille")` fires — replacing the existing `toast.info("Bientôt", "Portefeuille arrive plus tard.")` short-circuit in `cap-shell.tsx:50-58`. The destination page renders the auth-guarded portfolio screen.

- **AC-6 (zero direct Supabase reads of `holdings`/`holding_lots` from apps/web — NFR-28):** **Given** the story is shipped, **When** `rg --no-heading -n 'from\("holdings"\)|from\("holding_lots"\)' apps/web/src` runs, **Then** no match is reported. The brownfield Supabase-direct accessors are deleted (T14). All reads/writes go through `holdingsClient.*` via `portefeuille/_actions/holdings-actions.ts`.

- **AC-7 (lib/actions/ is removed):** **Given** the story is shipped, **When** `ls apps/web/src/lib/actions 2>&1` runs, **Then** the directory does not exist. Every action file is either deleted (portfolio.ts, holding-lots.ts, monthly.ts, transactions.ts, hypotheses.ts) or moved to its owning route folder under `_actions/` (accounts-actions.ts → parametres/_actions/, compass-actions.ts + milestones-actions.ts → dashboard/_actions/). The 26 importer files (12 accounts + 5 compass + 9 milestones) reference the new locations via relative paths.

- **AC-8 (typed-error envelopes propagate `recordLot` + `close` codes through the SA boundary):** **Given** I call `recordLot` against a closed holding, **When** the API throws `ORPCError("HOLDING_CLOSED")`, **Then** `holdings-actions.ts` catches the typed `ORPCError`, returns `{ ok: false, code: "HOLDING_CLOSED", message: <api> }` (NOT throws — Next.js SA boundary sanitises thrown Error messages in prod per L25/2-3-T2). The hook narrows on `result.ok` and surfaces a localised toast/error. Same envelope shape for `closeHolding` against `HOLDING_NOT_FOUND` and for `createHolding` against `ACCOUNT_NOT_FOUND`.

- **AC-9 (lint discipline — story 0-12 rules pass):** **Given** the story diff lands, **When** `bun --filter=@pekulo/web run lint` runs, **Then** lint exits `0`. Specifically:
  - `pekulo/no-server-action-in-component` — components NEVER import from `holdings-actions.ts` directly; they call through hooks (`useHoldings`, `useCreateHolding`, `useRecordLot`, `useCloseHolding`).
  - `pekulo/no-cross-feature-action-import` — `holdings-actions.ts` MUST NOT import from `accounts-actions.ts`, `compass-actions.ts`, `milestones-actions.ts`. Cross-feature data (e.g. account list for the holding-create-form `accountId` selector) is consumed at the **hook** layer via `useAccounts()` from `parametres/_hooks/use-accounts.ts` — first cross-route hook import precedent in Pekulo; documented inline in the form.
  - `pekulo/no-tailwind-outside-ui` — apps/web styling stays Tamagui-only (`form-primitives` enforce this).

- **AC-10 (no `*.types.ts` inside the portefeuille route — L1 invariant):** **Given** the story is shipped, **When** `find apps/web/src/app/(cap)/dashboard/portefeuille -name "*.types.ts"` runs, **Then** no match is reported. Co-located result envelope types (`RecordLotResult`, `CloseHoldingResult`, `CreateHoldingResult`) live **inside** `holdings-actions.ts`. Domain entities are inferred from `@pekulo/validators` (`Holding`, `HoldingLot`, `CreateHoldingInput`, `RecordLotInput`, `CloseHoldingInput`, `HoldingKind`, `HoldingCurrency`, `LotType`).

- **AC-11 (a11y — axe-core zero violations on the 4 new components):** **Given** I run `bun --filter=@pekulo/web run test`, **When** the a11y test suite executes, **Then** axe-core reports zero violations on `portfolio-section.tsx`, `holding-create-form.tsx`, `lot-form.tsx`, `holding-close-confirm.tsx`. (`class-row.tsx` and `holding-row.tsx` are pure rendering primitives — covered transitively by `portfolio-section.a11y.test.tsx`.)

- **AC-12 (visual fidelity — TR-strict palette):** **Given** the screen is rendered, **When** I inspect via `mcp__react-grab-mcp__get_element_context` on `/dashboard/portefeuille` (T15), **Then** (a) hero PnL uses `$accent` for gain (≥ 0) and `$danger` for loss — `$accent` is reserved STRICTLY for monetary deltas per memory `feedback_trade_republic_fidelity.md`, (b) no card borders, (c) `Section` wrappers use the page-level gap-10 rhythm (mirrors `PatrimoineView`), (d) `class-row` mini-donut is `PekuloDonut size={24} stroke={2.5}` per ux-preview `App.tsx:1506`.

## Tasks

- [x] **T1 — Create `holdings-actions.ts` co-located under `portefeuille/_actions/`.** Write `apps/web/src/app/(cap)/dashboard/portefeuille/_actions/holdings-actions.ts` with the full content below. Five delegators (`listHoldings`, `createHolding`, `recordLot`, `closeHolding`, `getDerivedHolding`). Three of them wrap the oRPC client call in `try/catch` on `ORPCError` and return a discriminated-union envelope so the typed `code` survives the Next.js Server Action boundary (Next sanitises thrown Error `message` in production; returned values are JSON-serialised and survive intact). Co-located envelope types — NO sibling `*.types.ts` file (AC-10 / L1).

  Full file content:

  ```ts
  "use server";

  import { defineAction } from "@zapaction/core";
  import { revalidatePath } from "next/cache";
  import { z } from "zod";
  import { ORPCError } from "@orpc/client";
  import {
    holdingSchema,
    holdingLotSchema,
    derivedHoldingSchema,
    listHoldingsOutputSchema,
    closeHoldingOutputSchema,
    createHoldingInputSchema,
    recordLotInputSchema,
    closeHoldingInputSchema,
    getDerivedHoldingInputSchema,
    type Holding,
    type HoldingLot,
    type DerivedHolding,
    type CreateHoldingInput,
    type RecordLotInput,
    type CloseHoldingInput,
    type GetDerivedHoldingInput,
  } from "@pekulo/validators";
  import { holdingsClient } from "@/lib/orpc/modules";
  import { ensureRequestContext } from "@/lib/orpc/request-context";
  import { holdingsTags } from "@/lib/zapaction/keys";
  import type { ActionContext } from "@/lib/zapaction/context";
  import "@/lib/zapaction/context";

  // Story 3-4 — thin oRPC delegators co-located with the portefeuille
  // route. MUST NOT import from any sibling feature actions file (lint
  // pekulo/no-cross-feature-action-import). Each handler ensures request
  // context defensively before the oRPC call (lesson L25).
  //
  // Three mutations return a discriminated-union envelope so typed
  // ORPCError codes propagate through the Next.js Server Action boundary
  // intact (precedent: accounts-actions.ts deleteAccount → 2-3-T2). The
  // hook layer narrows on `result.ok` and surfaces the localised error.

  /** Envelope for createHolding — preserves typed `ACCOUNT_NOT_FOUND` across the SA boundary. */
  export type CreateHoldingResult =
    | { ok: true; holding: Holding }
    | { ok: false; code: "ACCOUNT_NOT_FOUND"; message: string };

  /** Envelope for recordLot — preserves `HOLDING_NOT_FOUND` and `HOLDING_CLOSED` codes. */
  export type RecordLotResult =
    | { ok: true; lot: HoldingLot }
    | { ok: false; code: "HOLDING_NOT_FOUND" | "HOLDING_CLOSED"; message: string };

  /** Envelope for closeHolding — preserves `HOLDING_NOT_FOUND`. */
  export type CloseHoldingResult =
    | { ok: true }
    | { ok: false; code: "HOLDING_NOT_FOUND"; message: string };

  export const listHoldings = defineAction<void, Holding[], ActionContext>({
    name: "listHoldings",
    input: z.void(),
    output: listHoldingsOutputSchema,
    handler: async () => {
      await ensureRequestContext();
      return holdingsClient.list({ includeClosed: false });
    },
  });

  export const getDerivedHolding = defineAction<
    GetDerivedHoldingInput,
    DerivedHolding,
    ActionContext
  >({
    name: "getDerivedHolding",
    input: getDerivedHoldingInputSchema,
    output: derivedHoldingSchema,
    handler: async ({ input }) => {
      await ensureRequestContext();
      return holdingsClient.getDerived(input);
    },
  });

  export const createHolding = defineAction<CreateHoldingInput, CreateHoldingResult, ActionContext>({
    name: "createHolding",
    input: createHoldingInputSchema,
    tags: [holdingsTags.list()],
    handler: async ({ input }) => {
      await ensureRequestContext();
      try {
        const holding = await holdingsClient.create(input);
        revalidatePath("/dashboard/portefeuille");
        revalidatePath("/dashboard");
        return { ok: true, holding };
      } catch (err) {
        if (err instanceof ORPCError && err.code === "ACCOUNT_NOT_FOUND") {
          return { ok: false, code: "ACCOUNT_NOT_FOUND", message: err.message };
        }
        throw err;
      }
    },
  });

  export const recordLot = defineAction<RecordLotInput, RecordLotResult, ActionContext>({
    name: "recordLot",
    input: recordLotInputSchema,
    tags: [holdingsTags.list()],
    handler: async ({ input }) => {
      await ensureRequestContext();
      try {
        const lot = await holdingsClient.recordLot(input);
        revalidatePath("/dashboard/portefeuille");
        revalidatePath("/dashboard");
        return { ok: true, lot };
      } catch (err) {
        if (
          err instanceof ORPCError &&
          (err.code === "HOLDING_NOT_FOUND" || err.code === "HOLDING_CLOSED")
        ) {
          return { ok: false, code: err.code, message: err.message };
        }
        throw err;
      }
    },
  });

  export const closeHolding = defineAction<CloseHoldingInput, CloseHoldingResult, ActionContext>({
    name: "closeHolding",
    input: closeHoldingInputSchema,
    output: closeHoldingOutputSchema,
    tags: [holdingsTags.list()],
    handler: async ({ input }) => {
      await ensureRequestContext();
      try {
        const result = await holdingsClient.close(input);
        revalidatePath("/dashboard/portefeuille");
        revalidatePath("/dashboard");
        return result;
      } catch (err) {
        if (err instanceof ORPCError && err.code === "HOLDING_NOT_FOUND") {
          return { ok: false, code: "HOLDING_NOT_FOUND", message: err.message };
        }
        throw err;
      }
    },
  });

  void holdingSchema;
  void holdingLotSchema;
  ```

  Run: `bun --filter=@pekulo/web run typecheck`. Expected: exit 0 (no output on success).
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/portefeuille/_actions/holdings-actions.ts && git commit -m "feat(#23): T1 — holdings-actions.ts co-located with portefeuille route + 3 typed-error envelopes"`. [AC: AC-6, AC-8, AC-9, AC-10]

- [x] **T2 — Create the 4 query/mutation hooks.** Write the four files below under `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/`. Each imports from `../_actions/holdings-actions` (sibling within the route folder).

  **`use-holdings.ts`** — useQuery for the holdings list:

  ```ts
  "use client";

  import { useQuery } from "@tanstack/react-query";
  import type { Holding } from "@pekulo/validators";
  import { holdingsKeys } from "@/lib/zapaction/keys";
  import { listHoldings } from "../_actions/holdings-actions";

  export function useHoldings() {
    return useQuery<Holding[]>({
      queryKey: holdingsKeys.list(),
      queryFn: () => listHoldings(),
      staleTime: 30_000,
    });
  }
  ```

  **`use-create-holding.ts`** — useMutation for create with envelope narrowing:

  ```ts
  "use client";

  import { useMutation, useQueryClient } from "@tanstack/react-query";
  import type { CreateHoldingInput } from "@pekulo/validators";
  import { holdingsKeys } from "@/lib/zapaction/keys";
  import { createHolding, type CreateHoldingResult } from "../_actions/holdings-actions";

  export function useCreateHolding() {
    const queryClient = useQueryClient();
    return useMutation<CreateHoldingResult, Error, CreateHoldingInput>({
      mutationFn: (input) => createHolding(input),
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: holdingsKeys.list() });
      },
    });
  }
  ```

  **`use-record-lot.ts`** — useMutation for record-lot:

  ```ts
  "use client";

  import { useMutation, useQueryClient } from "@tanstack/react-query";
  import type { RecordLotInput } from "@pekulo/validators";
  import { holdingsKeys } from "@/lib/zapaction/keys";
  import { recordLot, type RecordLotResult } from "../_actions/holdings-actions";

  export function useRecordLot() {
    const queryClient = useQueryClient();
    return useMutation<RecordLotResult, Error, RecordLotInput>({
      mutationFn: (input) => recordLot(input),
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: holdingsKeys.list() });
      },
    });
  }
  ```

  **`use-close-holding.ts`** — useMutation for close (idempotent):

  ```ts
  "use client";

  import { useMutation, useQueryClient } from "@tanstack/react-query";
  import type { CloseHoldingInput } from "@pekulo/validators";
  import { holdingsKeys } from "@/lib/zapaction/keys";
  import { closeHolding, type CloseHoldingResult } from "../_actions/holdings-actions";

  export function useCloseHolding() {
    const queryClient = useQueryClient();
    return useMutation<CloseHoldingResult, Error, CloseHoldingInput>({
      mutationFn: (input) => closeHolding(input),
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: holdingsKeys.list() });
      },
    });
  }
  ```

  Run: `bun --filter=@pekulo/web run typecheck`. Expected: exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/portefeuille/_hooks/*.ts && git commit -m "feat(#23): T2 — 4 portefeuille hooks (list + 3 mutations)"`. [AC: AC-1, AC-2, AC-3, AC-4, AC-8]

- [x] **T3 — Create `class-row.tsx`.** Write `apps/web/src/app/(cap)/dashboard/portefeuille/_components/class-row.tsx`. Mirrors ux-preview `ClassRow` (App.tsx:1503-1514). Mini-donut + label + EUR amount + percentage.

  Full file content:

  ```tsx
  "use client";

  import { View, Text } from "@pekulo/ui/client";
  import { PekuloDonut } from "@pekulo/ui";

  const eur0 = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  export interface ClassRowProps {
    label: string;
    amount: number;
    pct: number;
  }

  export function ClassRow({ label, amount, pct }: ClassRowProps) {
    return (
      <View
        render="li"
        flexDirection="row"
        alignItems="center"
        gap="$4"
        paddingVertical="$2"
      >
        <PekuloDonut pct={pct} size={24} stroke={2.5} ariaLabel={`${label} ${(pct * 100).toFixed(0)} %`} />
        <Text flex={1} color="$color" fontSize="$bodySm">
          {label}
        </Text>
        <Text color="$color" fontSize="$bodySm" fontVariant={["tabular-nums"]}>
          {eur0.format(amount)}
        </Text>
        <Text
          color="$colorTertiary"
          fontSize="$caption"
          fontVariant={["tabular-nums"]}
          width={40}
          textAlign="right"
        >
          {(pct * 100).toFixed(0)} %
        </Text>
      </View>
    );
  }
  ```

  Run: `bun --filter=@pekulo/web run typecheck`. Expected: exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/portefeuille/_components/class-row.tsx && git commit -m "feat(#23): T3 — class-row mini-donut entry (ux-preview parity)"`. [AC: AC-1, AC-12]

- [x] **T4 — Create `holding-row.tsx`.** Write `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-row.tsx`. Mirrors ux-preview `HoldingRow` (App.tsx:1516-1545). Renders ticker, kind chip, label + account, qty × price (desktop only), market value, signed PnL with `$accent` (gain) / `$danger` (loss). Receives a derived `account` label by lookup against the `useAccounts()` list (computed in the parent, NOT inside the row to avoid N hooks).

  Full file content:

  ```tsx
  "use client";

  import { View, Text } from "@pekulo/ui/client";
  import type { Holding } from "@pekulo/validators";

  const eur0 = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  const eur2 = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });

  function signed(amount: number): string {
    return `${amount >= 0 ? "+" : ""}${eur0.format(amount)}`;
  }

  export interface HoldingRowProps {
    holding: Holding;
    accountLabel: string | null;
    marketValueEur: number;
    unrealisedPnlEur: number;
    unrealisedPnlPct: number;
    /** Optional kebab menu (passed in by parent — keeps the row free of dialog state). */
    trailing?: React.ReactNode;
  }

  export function HoldingRow({
    holding,
    accountLabel,
    marketValueEur,
    unrealisedPnlEur,
    unrealisedPnlPct,
    trailing,
  }: HoldingRowProps) {
    const isGain = unrealisedPnlEur >= 0;
    return (
      <View flexDirection="row" alignItems="center" gap="$3" paddingVertical="$3">
        <View flex={1} flexDirection="column" minWidth={0}>
          <View flexDirection="row" alignItems="baseline" gap="$2">
            <Text
              color="$color"
              fontSize="$bodySm"
              fontWeight="500"
              numberOfLines={1}
            >
              {holding.ticker ?? holding.label}
            </Text>
            <Text
              color="$colorMuted"
              fontSize={11}
              textTransform="uppercase"
              letterSpacing={1}
            >
              {holding.kind}
            </Text>
          </View>
          <Text
            color="$colorTertiary"
            fontSize="$caption"
            fontVariant={["tabular-nums"]}
            numberOfLines={1}
          >
            {holding.label} · {accountLabel ?? "—"}
          </Text>
          <Text
            display="none"
            $lg={{ display: "flex" }}
            color="$colorMuted"
            fontSize="$caption"
            fontVariant={["tabular-nums"]}
          >
            {holding.quantity} × {eur2.format(holding.lastPrice)}
          </Text>
        </View>
        <View flexDirection="column" alignItems="flex-end">
          <Text
            color="$color"
            fontSize="$bodySm"
            fontWeight="500"
            fontVariant={["tabular-nums"]}
          >
            {eur0.format(marketValueEur)}
          </Text>
          <Text
            color={isGain ? "$accent" : "$danger"}
            fontSize="$caption"
            fontVariant={["tabular-nums"]}
          >
            {signed(unrealisedPnlEur)} ({(unrealisedPnlPct * 100).toFixed(2)} %)
          </Text>
        </View>
        {trailing}
      </View>
    );
  }
  ```

  Run: `bun --filter=@pekulo/web run typecheck`. Expected: exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/portefeuille/_components/holding-row.tsx && git commit -m "feat(#23): T4 — holding-row TR-strict palette + accent on PnL"`. [AC: AC-1, AC-12]

- [x] **T5 — Create `portfolio-section.tsx`.** Write `apps/web/src/app/(cap)/dashboard/portefeuille/_components/portfolio-section.tsx`. This is the orchestrator — fetches holdings + accounts, computes hero totals + répartition, renders six rows, manages the 3-dialog discriminator (create / lot / close). Mirrors ux-preview `PortfolioScreen` (App.tsx:1449-1500) + the `accounts-section.tsx` dialog pattern.

  Full file content:

  ```tsx
  "use client";

  import { useState, type CSSProperties } from "react";
  import { Text, View } from "@pekulo/ui/client";
  import { PekuloDialog, PekuloPopover, pekuloRadius } from "@pekulo/ui";
  import { MoreHorizontal, Plus } from "lucide-react";
  import type { Holding, HoldingCurrency } from "@pekulo/validators";
  import { useHoldings } from "../_hooks/use-holdings";
  // Cross-route hook import is intentional — accounts list is required for
  // the holding-create-form `accountId` selector. The lint rule
  // `pekulo/no-cross-feature-action-import` checks for cross-feature
  // *action* imports (the SA layer); cross-feature *hook* imports are
  // explicitly allowed because the hook is the orchestration boundary
  // (ADR-0010). Documented here as the first such precedent in Pekulo.
  import { useAccounts } from "../../parametres/_hooks/use-accounts";
  import { HoldingCreateForm } from "./holding-create-form";
  import { LotForm } from "./lot-form";
  import { HoldingCloseConfirm } from "./holding-close-confirm";
  import { ClassRow } from "./class-row";
  import { HoldingRow } from "./holding-row";

  // PortfolioSection — orchestrates hero + Répartition + Lignes for
  // /dashboard/portefeuille. The 3-3 portfolio-fx primitives
  // (`computeSnapshotFx`, `computeHoldingPnl`) are NOT consumed here —
  // story 7-1 will own the snapshot read at the dashboard aggregation
  // boundary. For 3-4 we compute a transparent client-side EUR
  // approximation: `marketValueEur = quantity * lastPrice` when the
  // holding currency is EUR, OR `quantity * lastPrice` raw when not EUR
  // (the FX-multi-currency snapshot ships in 7-1 — see Dev Notes §
  // "Decisions re-applied from 3-3"). `unrealisedPnl = (lastPrice -
  // avgCost) * quantity`. The hero label clarifies this is the
  // EUR-anchored view.

  const eur0 = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  function signed(amount: number): string {
    return `${amount >= 0 ? "+" : ""}${eur0.format(amount)}`;
  }

  // Best-effort EUR approximation. 3-3's `computeSnapshotFx` is the
  // canonical FX-resolved snapshot — wired in 7-1.
  function approxEurValue(h: Holding): number {
    return h.quantity * h.lastPrice;
  }

  function approxPnl(h: Holding): number {
    return (h.lastPrice - h.avgCost) * h.quantity;
  }

  type DialogKind =
    | { kind: "create" }
    | { kind: "lot"; holding: Holding }
    | { kind: "close"; holding: Holding }
    | null;

  const addPill: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 32,
    padding: "0 12px",
    borderRadius: pekuloRadius.full,
    backgroundColor: "var(--backgroundMuted)",
    color: "var(--color)",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  };

  const kebabBtn: CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--colorTertiary)",
    width: 32,
    height: 32,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: pekuloRadius.full,
  };

  const popoverActionBtnBase: CSSProperties = {
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: "8px 12px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    borderRadius: pekuloRadius.md,
    textAlign: "left",
  };
  const popoverActionBtnNeutral: CSSProperties = {
    ...popoverActionBtnBase,
    color: "var(--color)",
  };
  const popoverActionBtnDanger: CSSProperties = {
    ...popoverActionBtnBase,
    color: "var(--danger)",
  };

  export function PortfolioSection() {
    const { data: holdings, isLoading, error } = useHoldings();
    const { data: accounts } = useAccounts();
    const [dialog, setDialog] = useState<DialogKind>(null);

    const rows = holdings ?? [];
    const accountLabel = (id: string): string | null =>
      accounts?.find((a) => a.id === id)?.label ?? null;

    const total = rows.reduce((s, h) => s + approxEurValue(h), 0);
    const totalPnl = rows.reduce((s, h) => s + approxPnl(h), 0);
    const totalCost = total - totalPnl;
    const totalPnlPct = totalCost > 0 ? totalPnl / totalCost : 0;

    const byKind = {
      etf: rows.filter((h) => h.kind === "etf").reduce((s, h) => s + approxEurValue(h), 0),
      action: rows
        .filter((h) => h.kind === "action")
        .reduce((s, h) => s + approxEurValue(h), 0),
      crypto: rows
        .filter((h) => h.kind === "crypto")
        .reduce((s, h) => s + approxEurValue(h), 0),
    };

    if (isLoading) {
      return (
        <View paddingVertical="$6">
          <Text color="$colorTertiary" fontSize="$bodySm">
            Chargement du portefeuille…
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View role="alert" paddingVertical="$6">
          <Text color="$danger" fontSize="$bodySm">
            Erreur de chargement : {error.message}
          </Text>
        </View>
      );
    }

    return (
      <View
        flexDirection="column"
        gap={40}
        width="100%"
        $lg={{ maxWidth: 1024, marginHorizontal: "auto" }}
      >
        {/* Hero — Valeur totale */}
        <View render="section" aria-label="Valeur totale du portefeuille">
          <Text color="$colorTertiary" fontSize="$caption">
            Valeur portefeuille · EUR
          </Text>
          <Text
            color="$color"
            fontSize="$h1"
            fontWeight="600"
            letterSpacing={-0.5}
            marginTop="$2"
            fontVariant={["tabular-nums"]}
            $lg={{ fontSize: "$hero" }}
          >
            {eur0.format(total)}
          </Text>
          <View
            flexDirection="row"
            alignItems="center"
            gap="$2"
            marginTop="$2"
          >
            <Text
              color={totalPnl >= 0 ? "$accent" : "$danger"}
              fontSize="$bodySm"
              fontWeight="500"
              fontVariant={["tabular-nums"]}
            >
              {signed(totalPnl)}
            </Text>
            <Text color="$colorTertiary" fontSize="$bodySm" fontVariant={["tabular-nums"]}>
              ({totalPnl >= 0 ? "+" : ""}
              {(totalPnlPct * 100).toFixed(2)} %) plus-value latente
            </Text>
          </View>
        </View>

        {/* Répartition par classe */}
        <View render="section" aria-labelledby="rep-h" flexDirection="column">
          <Text
            id="rep-h"
            render="h2"
            color="$color"
            fontSize="$h3"
            fontWeight="600"
            marginBottom="$3"
            $lg={{ fontSize: "$h2" }}
          >
            Répartition
          </Text>
          <View render="ul" flexDirection="column" margin={0} padding={0}>
            <ClassRow label="ETF" amount={byKind.etf} pct={total > 0 ? byKind.etf / total : 0} />
            <ClassRow
              label="Actions"
              amount={byKind.action}
              pct={total > 0 ? byKind.action / total : 0}
            />
            <ClassRow
              label="Crypto"
              amount={byKind.crypto}
              pct={total > 0 ? byKind.crypto / total : 0}
            />
          </View>
        </View>

        {/* Lignes */}
        <View render="section" aria-labelledby="lig-h" flexDirection="column">
          <View
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            marginBottom="$3"
          >
            <Text
              id="lig-h"
              render="h2"
              color="$color"
              fontSize="$h3"
              fontWeight="600"
              $lg={{ fontSize: "$h2" }}
            >
              Lignes
            </Text>
            <button
              type="button"
              onClick={() => setDialog({ kind: "create" })}
              style={addPill}
              aria-label="Ajouter un placement"
            >
              <Plus size={14} strokeWidth={2.25} aria-hidden={true} />
              Ajouter
            </button>
          </View>
          {rows.length === 0 ? (
            <Text color="$colorTertiary" fontSize="$bodySm">
              Aucun placement pour le moment. Clique « Ajouter » pour créer le premier.
            </Text>
          ) : (
            <View render="ul" flexDirection="column" margin={0} padding={0}>
              {rows.map((h) => (
                <View key={h.id} render="li" margin={0} padding={0}>
                  <HoldingRow
                    holding={h}
                    accountLabel={accountLabel(h.accountId)}
                    marketValueEur={approxEurValue(h)}
                    unrealisedPnlEur={approxPnl(h)}
                    unrealisedPnlPct={
                      h.avgCost > 0 ? (h.lastPrice - h.avgCost) / h.avgCost : 0
                    }
                    trailing={
                      <PekuloPopover>
                        <PekuloPopover.Trigger asChild>
                          <button
                            type="button"
                            aria-label={`Actions pour ${h.ticker ?? h.label}`}
                            style={kebabBtn}
                          >
                            <MoreHorizontal size={16} aria-hidden={true} />
                          </button>
                        </PekuloPopover.Trigger>
                        <PekuloPopover.Content>
                          <View flexDirection="column" padding="$1" gap="$1">
                            <button
                              type="button"
                              onClick={() => setDialog({ kind: "lot", holding: h })}
                              style={popoverActionBtnNeutral}
                            >
                              Enregistrer un lot
                            </button>
                            <button
                              type="button"
                              onClick={() => setDialog({ kind: "close", holding: h })}
                              style={popoverActionBtnDanger}
                            >
                              Marquer comme clôturé
                            </button>
                          </View>
                        </PekuloPopover.Content>
                      </PekuloPopover>
                    }
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Create dialog */}
        <PekuloDialog
          open={dialog?.kind === "create"}
          onOpenChange={(next) => setDialog(next ? { kind: "create" } : null)}
        >
          <PekuloDialog.Portal>
            <PekuloDialog.Overlay />
            <PekuloDialog.Content>
              <PekuloDialog.Title>Ajouter un placement</PekuloDialog.Title>
              <PekuloDialog.Description>
                Ticker, devise, quantité et prix unitaire moyen. Crypto et ETF acceptés.
              </PekuloDialog.Description>
              <HoldingCreateForm
                accounts={accounts ?? []}
                onSuccess={() => setDialog(null)}
              />
            </PekuloDialog.Content>
          </PekuloDialog.Portal>
        </PekuloDialog>

        {/* Lot dialog */}
        {dialog?.kind === "lot" && (
          <LotForm
            holding={dialog.holding}
            open
            onOpenChange={(next) => !next && setDialog(null)}
          />
        )}

        {/* Close dialog */}
        {dialog?.kind === "close" && (
          <HoldingCloseConfirm
            holding={dialog.holding}
            open
            onOpenChange={(next) => !next && setDialog(null)}
          />
        )}
      </View>
    );
  }
  ```

  Also write `portfolio-section.a11y.test.tsx` next to it:

  ```tsx
  import { describe, expect, test, vi } from "vitest";
  import { axe } from "vitest-axe";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { renderWithTamagui } from "../../../../../../test/setup";

  vi.mock("../_actions/holdings-actions", () => ({
    listHoldings: vi.fn().mockResolvedValue([]),
    createHolding: vi.fn(),
    recordLot: vi.fn(),
    closeHolding: vi.fn(),
  }));
  vi.mock("../../parametres/_actions/accounts-actions", () => ({
    listAccounts: vi.fn().mockResolvedValue([]),
  }));

  import { PortfolioSection } from "./portfolio-section";

  describe("PortfolioSection a11y (AC-11)", () => {
    test("zero axe violations with empty list", async () => {
      const qc = new QueryClient();
      const { container } = renderWithTamagui(
        <QueryClientProvider client={qc}>
          <PortfolioSection />
        </QueryClientProvider>,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
  ```

  Run: `bun --filter=@pekulo/web test portfolio-section.a11y`. Expected: `Tests  1 passed (1)`, exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/portefeuille/_components/portfolio-section.tsx apps/web/src/app/\(cap\)/dashboard/portefeuille/_components/portfolio-section.a11y.test.tsx && git commit -m "feat(#23): T5 — portfolio-section orchestrator (hero + repartition + lignes + 3 dialogs)"`. [AC: AC-1, AC-5, AC-11, AC-12]

- [x] **T6 — Create `holding-create-form.tsx` + a11y test.** Write `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-create-form.tsx`. Form fields: `accountId` (select from `accounts` prop), `kind` (select etf/action/crypto/autre), `ticker` (text, optional), `label` (text), `currency` (select EUR/USD/GBP/CHF), `quantity` (number), `avgCost` (number), `notes` (text, optional). Submit calls `useCreateHolding`; on `result.ok === true` calls `onSuccess` (closes the dialog).

  Full file content:

  ```tsx
  "use client";

  import { useState, type CSSProperties } from "react";
  import { Text, View } from "@pekulo/ui/client";
  import {
    HOLDING_CURRENCIES,
    MAX_HOLDING_LABEL_LENGTH,
    MAX_HOLDING_TICKER_LENGTH,
    MAX_HOLDING_NOTES_LENGTH,
    type Account,
    type HoldingCurrency,
  } from "@pekulo/validators";
  import { HOLDING_KINDS, type HoldingKind } from "@pekulo/types";
  import { useCreateHolding } from "../_hooks/use-create-holding";
  import {
    FormField as Field,
    formInputStyle as inputStyle,
    formSubmitStyle as submitStyle,
  } from "../../../_components/form-primitives";

  const KIND_LABEL: Record<HoldingKind, string> = {
    etf: "ETF",
    action: "Action",
    crypto: "Crypto",
    autre: "Autre",
  };

  const selectStyle: CSSProperties = {
    ...inputStyle,
    appearance: "none",
  };

  const ACCOUNT_NOT_FOUND_MSG = "Compte introuvable. Recharge la page.";

  export interface HoldingCreateFormProps {
    accounts: Account[];
    onSuccess?: () => void;
  }

  export function HoldingCreateForm({ accounts, onSuccess }: HoldingCreateFormProps) {
    const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? "");
    const [kind, setKind] = useState<HoldingKind>("etf");
    const [ticker, setTicker] = useState("");
    const [label, setLabel] = useState("");
    const [currency, setCurrency] = useState<HoldingCurrency>("EUR");
    const [quantity, setQuantity] = useState("0");
    const [avgCost, setAvgCost] = useState("0");
    const [notes, setNotes] = useState("");
    const [clientError, setClientError] = useState<string | null>(null);
    const [envelopeError, setEnvelopeError] = useState<string | null>(null);
    const { mutate, isPending, error, isSuccess, reset } = useCreateHolding();

    const onSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setClientError(null);
      setEnvelopeError(null);
      const trimmedLabel = label.trim();
      if (trimmedLabel.length === 0) {
        setClientError("Libellé requis");
        return;
      }
      if (trimmedLabel.length > MAX_HOLDING_LABEL_LENGTH) {
        setClientError(`Libellé > ${MAX_HOLDING_LABEL_LENGTH} caractères`);
        return;
      }
      const trimmedTicker = ticker.trim();
      if (trimmedTicker.length > MAX_HOLDING_TICKER_LENGTH) {
        setClientError(`Ticker > ${MAX_HOLDING_TICKER_LENGTH} caractères`);
        return;
      }
      const trimmedNotes = notes.trim();
      if (trimmedNotes.length > MAX_HOLDING_NOTES_LENGTH) {
        setClientError(`Notes > ${MAX_HOLDING_NOTES_LENGTH} caractères`);
        return;
      }
      const qNum = Number(quantity);
      if (!Number.isFinite(qNum) || qNum < 0) {
        setClientError("Quantité invalide (>= 0)");
        return;
      }
      const aNum = Number(avgCost);
      if (!Number.isFinite(aNum) || aNum < 0) {
        setClientError("Prix moyen invalide (>= 0)");
        return;
      }
      if (accountId.length === 0) {
        setClientError("Compte requis");
        return;
      }
      mutate(
        {
          accountId,
          kind,
          ticker: trimmedTicker.length > 0 ? trimmedTicker : null,
          isin: null,
          label: trimmedLabel,
          currency,
          quantity: qNum,
          avgCost: aNum,
          notes: trimmedNotes.length > 0 ? trimmedNotes : null,
        },
        {
          onSuccess: (result) => {
            if (!result.ok) {
              setEnvelopeError(
                result.code === "ACCOUNT_NOT_FOUND" ? ACCOUNT_NOT_FOUND_MSG : result.message,
              );
              return;
            }
            setLabel("");
            setTicker("");
            setQuantity("0");
            setAvgCost("0");
            setNotes("");
            reset();
            onSuccess?.();
          },
        },
      );
    };

    return (
      <form onSubmit={onSubmit} aria-label="Ajouter un placement">
        <View flexDirection="column" gap="$3" padding="$4">
          <Field>
            <Text render="label" htmlFor="hld-account" color="$colorSecondary" fontSize="$caption">
              Compte
            </Text>
            <select
              id="hld-account"
              value={accountId}
              onChange={(e) => setAccountId(e.currentTarget.value)}
              required
              style={selectStyle}
            >
              {accounts.length === 0 && <option value="">Aucun compte — crée-en un dans Paramètres</option>}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <Text render="label" htmlFor="hld-kind" color="$colorSecondary" fontSize="$caption">
              Classe
            </Text>
            <select
              id="hld-kind"
              value={kind}
              onChange={(e) => setKind(e.currentTarget.value as HoldingKind)}
              style={selectStyle}
            >
              {HOLDING_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <Text render="label" htmlFor="hld-ticker" color="$colorSecondary" fontSize="$caption">
              Ticker (optionnel)
            </Text>
            <input
              id="hld-ticker"
              type="text"
              maxLength={MAX_HOLDING_TICKER_LENGTH}
              value={ticker}
              onChange={(e) => setTicker(e.currentTarget.value)}
              style={inputStyle}
            />
          </Field>
          <Field>
            <Text render="label" htmlFor="hld-label" color="$colorSecondary" fontSize="$caption">
              Libellé
            </Text>
            <input
              id="hld-label"
              type="text"
              maxLength={MAX_HOLDING_LABEL_LENGTH}
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
              required
              style={inputStyle}
            />
          </Field>
          <Field>
            <Text render="label" htmlFor="hld-currency" color="$colorSecondary" fontSize="$caption">
              Devise
            </Text>
            <select
              id="hld-currency"
              value={currency}
              onChange={(e) => setCurrency(e.currentTarget.value as HoldingCurrency)}
              style={selectStyle}
            >
              {HOLDING_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <Text render="label" htmlFor="hld-quantity" color="$colorSecondary" fontSize="$caption">
              Quantité
            </Text>
            <input
              id="hld-quantity"
              type="number"
              min={0}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.currentTarget.value)}
              required
              style={inputStyle}
            />
          </Field>
          <Field>
            <Text render="label" htmlFor="hld-avgcost" color="$colorSecondary" fontSize="$caption">
              Prix unitaire moyen
            </Text>
            <input
              id="hld-avgcost"
              type="number"
              min={0}
              step="0.01"
              value={avgCost}
              onChange={(e) => setAvgCost(e.currentTarget.value)}
              required
              style={inputStyle}
            />
          </Field>
          <Field>
            <Text render="label" htmlFor="hld-notes" color="$colorSecondary" fontSize="$caption">
              Notes (optionnel)
            </Text>
            <input
              id="hld-notes"
              type="text"
              maxLength={MAX_HOLDING_NOTES_LENGTH}
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              style={inputStyle}
            />
          </Field>
          {clientError && (
            <Text role="alert" color="$danger" fontSize="$caption">
              {clientError}
            </Text>
          )}
          {envelopeError && !clientError && (
            <Text role="alert" color="$danger" fontSize="$caption">
              {envelopeError}
            </Text>
          )}
          {error && !clientError && !envelopeError && (
            <Text role="alert" color="$danger" fontSize="$caption">
              {error.message}
            </Text>
          )}
          {isSuccess && !clientError && !envelopeError && !error && (
            <Text role="status" color="$success" fontSize="$caption">
              Placement ajouté.
            </Text>
          )}
          <button
            type="submit"
            disabled={isPending || accounts.length === 0}
            aria-disabled={isPending || accounts.length === 0}
            style={submitStyle(isPending || accounts.length === 0)}
          >
            {isPending ? "Ajout…" : "Ajouter le placement"}
          </button>
        </View>
      </form>
    );
  }
  ```

  Also write `holding-create-form.a11y.test.tsx`:

  ```tsx
  import { describe, expect, test, vi } from "vitest";
  import { axe } from "vitest-axe";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { renderWithTamagui } from "../../../../../../test/setup";

  vi.mock("../_actions/holdings-actions", () => ({
    createHolding: vi.fn(),
  }));

  import { HoldingCreateForm } from "./holding-create-form";

  describe("HoldingCreateForm a11y (AC-11)", () => {
    test("zero axe violations", async () => {
      const qc = new QueryClient();
      const { container } = renderWithTamagui(
        <QueryClientProvider client={qc}>
          <HoldingCreateForm accounts={[]} />
        </QueryClientProvider>,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
  ```

  Run: `bun --filter=@pekulo/web test holding-create-form.a11y`. Expected: `Tests  1 passed (1)`, exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/portefeuille/_components/holding-create-form.tsx apps/web/src/app/\(cap\)/dashboard/portefeuille/_components/holding-create-form.a11y.test.tsx && git commit -m "feat(#23): T6 — holding-create-form (8 fields + ACCOUNT_NOT_FOUND envelope)"`. [AC: AC-4, AC-8, AC-11]

- [x] **T7 — Create `lot-form.tsx` + a11y test.** Write `apps/web/src/app/(cap)/dashboard/portefeuille/_components/lot-form.tsx`. Dialog-wrapped form. Fields: `type` (radio buy/sell), `occurredOn` (date input — sent as ISO string, contract `z.coerce.date()` accepts), `quantity` (number > 0), `priceUnit` (number ≥ 0), `fees` (number ≥ 0, default 0), `notes` (optional). Submit calls `useRecordLot`; on `result.ok === false` surfaces the `HOLDING_NOT_FOUND` / `HOLDING_CLOSED` envelope code in a `role="alert"` Text.

  Full file content:

  ```tsx
  "use client";

  import { useState, type CSSProperties } from "react";
  import { Text, View } from "@pekulo/ui/client";
  import { PekuloDialog, pekuloRadius } from "@pekulo/ui";
  import {
    MAX_HOLDING_NOTES_LENGTH,
    type Holding,
  } from "@pekulo/validators";
  import { useRecordLot } from "../_hooks/use-record-lot";
  import {
    FormField as Field,
    formInputStyle as inputStyle,
    formSubmitStyle as submitStyle,
  } from "../../../_components/form-primitives";

  const HOLDING_NOT_FOUND_MSG = "Ce placement est introuvable. Recharge la page.";
  const HOLDING_CLOSED_MSG = "Ce placement est clôturé — les lots ne peuvent plus être modifiés.";

  function todayIso(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const radioRow: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  };

  export interface LotFormProps {
    holding: Holding;
    open: boolean;
    onOpenChange: (next: boolean) => void;
  }

  export function LotForm({ holding, open, onOpenChange }: LotFormProps) {
    const [type, setType] = useState<"buy" | "sell">("buy");
    const [occurredOn, setOccurredOn] = useState(todayIso());
    const [quantity, setQuantity] = useState("0");
    const [priceUnit, setPriceUnit] = useState(String(holding.lastPrice));
    const [fees, setFees] = useState("0");
    const [notes, setNotes] = useState("");
    const [clientError, setClientError] = useState<string | null>(null);
    const [envelopeError, setEnvelopeError] = useState<string | null>(null);
    const { mutate, isPending, error, isSuccess, reset } = useRecordLot();

    const handleClose = (next: boolean) => {
      if (!next) {
        setClientError(null);
        setEnvelopeError(null);
        reset();
      }
      onOpenChange(next);
    };

    const onSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setClientError(null);
      setEnvelopeError(null);
      const qNum = Number(quantity);
      if (!Number.isFinite(qNum) || qNum <= 0) {
        setClientError("Quantité invalide (> 0)");
        return;
      }
      const pNum = Number(priceUnit);
      if (!Number.isFinite(pNum) || pNum < 0) {
        setClientError("Prix unitaire invalide (>= 0)");
        return;
      }
      const fNum = Number(fees);
      if (!Number.isFinite(fNum) || fNum < 0) {
        setClientError("Frais invalides (>= 0)");
        return;
      }
      const trimmedNotes = notes.trim();
      if (trimmedNotes.length > MAX_HOLDING_NOTES_LENGTH) {
        setClientError(`Notes > ${MAX_HOLDING_NOTES_LENGTH} caractères`);
        return;
      }
      mutate(
        {
          holdingId: holding.id,
          type,
          occurredOn: new Date(occurredOn),
          quantity: qNum,
          priceUnit: pNum,
          fees: fNum,
          notes: trimmedNotes.length > 0 ? trimmedNotes : null,
        },
        {
          onSuccess: (result) => {
            if (!result.ok) {
              setEnvelopeError(
                result.code === "HOLDING_NOT_FOUND" ? HOLDING_NOT_FOUND_MSG : HOLDING_CLOSED_MSG,
              );
              return;
            }
            reset();
            onOpenChange(false);
          },
        },
      );
    };

    return (
      <PekuloDialog open={open} onOpenChange={handleClose}>
        <PekuloDialog.Portal>
          <PekuloDialog.Overlay />
          <PekuloDialog.Content>
            <View flexDirection="column" gap="$3" padding="$4">
              <PekuloDialog.Title>
                Enregistrer un lot — {holding.ticker ?? holding.label}
              </PekuloDialog.Title>
              <PekuloDialog.Description>
                Achat ou vente. Le WAC se recalcule automatiquement.
              </PekuloDialog.Description>
              <form onSubmit={onSubmit} aria-label="Enregistrer un lot">
                <Field>
                  <Text color="$colorSecondary" fontSize="$caption">
                    Type
                  </Text>
                  <div role="radiogroup" aria-label="Type de lot" style={radioRow}>
                    <label>
                      <input
                        type="radio"
                        name="lot-type"
                        value="buy"
                        checked={type === "buy"}
                        onChange={() => setType("buy")}
                      />{" "}
                      Achat
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="lot-type"
                        value="sell"
                        checked={type === "sell"}
                        onChange={() => setType("sell")}
                      />{" "}
                      Vente
                    </label>
                  </div>
                </Field>
                <Field>
                  <Text render="label" htmlFor="lot-date" color="$colorSecondary" fontSize="$caption">
                    Date
                  </Text>
                  <input
                    id="lot-date"
                    type="date"
                    value={occurredOn}
                    onChange={(e) => setOccurredOn(e.currentTarget.value)}
                    required
                    style={inputStyle}
                  />
                </Field>
                <Field>
                  <Text render="label" htmlFor="lot-qty" color="$colorSecondary" fontSize="$caption">
                    Quantité
                  </Text>
                  <input
                    id="lot-qty"
                    type="number"
                    min="0.0001"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.currentTarget.value)}
                    required
                    style={inputStyle}
                  />
                </Field>
                <Field>
                  <Text render="label" htmlFor="lot-price" color="$colorSecondary" fontSize="$caption">
                    Prix unitaire
                  </Text>
                  <input
                    id="lot-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={priceUnit}
                    onChange={(e) => setPriceUnit(e.currentTarget.value)}
                    required
                    style={inputStyle}
                  />
                </Field>
                <Field>
                  <Text render="label" htmlFor="lot-fees" color="$colorSecondary" fontSize="$caption">
                    Frais
                  </Text>
                  <input
                    id="lot-fees"
                    type="number"
                    min={0}
                    step="0.01"
                    value={fees}
                    onChange={(e) => setFees(e.currentTarget.value)}
                    style={inputStyle}
                  />
                </Field>
                <Field>
                  <Text render="label" htmlFor="lot-notes" color="$colorSecondary" fontSize="$caption">
                    Notes (optionnel)
                  </Text>
                  <input
                    id="lot-notes"
                    type="text"
                    maxLength={MAX_HOLDING_NOTES_LENGTH}
                    value={notes}
                    onChange={(e) => setNotes(e.currentTarget.value)}
                    style={inputStyle}
                  />
                </Field>
                {clientError && (
                  <Text role="alert" color="$danger" fontSize="$caption">
                    {clientError}
                  </Text>
                )}
                {envelopeError && !clientError && (
                  <Text role="alert" color="$danger" fontSize="$caption">
                    {envelopeError}
                  </Text>
                )}
                {error && !clientError && !envelopeError && (
                  <Text role="alert" color="$danger" fontSize="$caption">
                    {error.message}
                  </Text>
                )}
                {isSuccess && !clientError && !envelopeError && !error && (
                  <Text role="status" color="$success" fontSize="$caption">
                    Lot enregistré.
                  </Text>
                )}
                <button
                  type="submit"
                  disabled={isPending}
                  aria-disabled={isPending}
                  style={submitStyle(isPending)}
                >
                  {isPending ? "Enregistrement…" : "Enregistrer le lot"}
                </button>
              </form>
            </View>
          </PekuloDialog.Content>
        </PekuloDialog.Portal>
      </PekuloDialog>
    );
  }
  ```

  Also write `lot-form.a11y.test.tsx`:

  ```tsx
  import { describe, expect, test, vi } from "vitest";
  import { axe } from "vitest-axe";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { renderWithTamagui } from "../../../../../../test/setup";

  vi.mock("../_actions/holdings-actions", () => ({
    recordLot: vi.fn(),
  }));

  import { LotForm } from "./lot-form";

  const FAKE_HOLDING = {
    id: "hld_test",
    userId: "00000000-0000-0000-0000-000000000000",
    accountId: "acc_test",
    kind: "etf" as const,
    ticker: "CW8",
    isin: null,
    label: "Amundi CW8",
    currency: "EUR" as const,
    quantity: 10,
    avgCost: 24.5,
    lastPrice: 26.1,
    lastPriceAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  };

  describe("LotForm a11y (AC-11)", () => {
    test("zero axe violations when open", async () => {
      const qc = new QueryClient();
      const { container } = renderWithTamagui(
        <QueryClientProvider client={qc}>
          <LotForm holding={FAKE_HOLDING} open onOpenChange={() => {}} />
        </QueryClientProvider>,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
  ```

  Run: `bun --filter=@pekulo/web test lot-form.a11y`. Expected: `Tests  1 passed (1)`, exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/portefeuille/_components/lot-form.tsx apps/web/src/app/\(cap\)/dashboard/portefeuille/_components/lot-form.a11y.test.tsx && git commit -m "feat(#23): T7 — lot-form (buy/sell + WAC re-derive)"`. [AC: AC-2, AC-8, AC-11]

- [x] **T8 — Create `holding-close-confirm.tsx` + a11y test.** Write `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-close-confirm.tsx`. Mirrors `account-delete-confirm.tsx` (parametres). Idempotent close — second call still returns `{ ok: true }` per 3-1 decision. `HOLDING_NOT_FOUND` envelope surfaced inline.

  Full file content:

  ```tsx
  "use client";

  import { useState, type CSSProperties } from "react";
  import { Text, View } from "@pekulo/ui/client";
  import { PekuloDialog, pekuloRadius } from "@pekulo/ui";
  import type { Holding } from "@pekulo/validators";
  import { useCloseHolding } from "../_hooks/use-close-holding";

  const NOT_FOUND_MSG = "Ce placement est introuvable (déjà supprimé ?). Recharge la page.";

  const dangerBtn = (disabled: boolean): CSSProperties => ({
    alignSelf: "flex-start",
    backgroundColor: "var(--danger)",
    color: "var(--colorOnAccent)",
    height: 40,
    padding: "0 16px",
    borderRadius: pekuloRadius.full,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontSize: 14,
    fontWeight: 500,
  });

  export interface HoldingCloseConfirmProps {
    holding: Holding;
    open: boolean;
    onOpenChange: (next: boolean) => void;
  }

  export function HoldingCloseConfirm({ holding, open, onOpenChange }: HoldingCloseConfirmProps) {
    const { mutate, isPending, error, reset } = useCloseHolding();
    const [envelopeError, setEnvelopeError] = useState<string | null>(null);

    const handleClose = (next: boolean) => {
      if (!next) {
        setEnvelopeError(null);
        reset();
      }
      onOpenChange(next);
    };

    const handleConfirm = () => {
      setEnvelopeError(null);
      mutate(
        { id: holding.id },
        {
          onSuccess: (result) => {
            if (result.ok) {
              onOpenChange(false);
              return;
            }
            setEnvelopeError(NOT_FOUND_MSG);
          },
        },
      );
    };

    return (
      <PekuloDialog open={open} onOpenChange={handleClose}>
        <PekuloDialog.Portal>
          <PekuloDialog.Overlay />
          <PekuloDialog.Content>
            <View flexDirection="column" gap="$3" padding="$4">
              <PekuloDialog.Title>
                Clôturer « {holding.ticker ?? holding.label} » ?
              </PekuloDialog.Title>
              <PekuloDialog.Description>
                Le placement disparaît de la liste active. Les lots restent enregistrés pour
                l'historique. Cette action est idempotente — clôturer à nouveau n'a pas d'effet.
              </PekuloDialog.Description>
              {envelopeError && (
                <Text role="alert" color="$danger" fontSize="$caption">
                  {envelopeError}
                </Text>
              )}
              {error && !envelopeError && (
                <Text role="alert" color="$danger" fontSize="$caption">
                  {error.message}
                </Text>
              )}
              <View flexDirection="row" gap="$3" alignItems="center">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isPending}
                  aria-disabled={isPending}
                  style={dangerBtn(isPending)}
                >
                  {isPending ? "Clôture…" : "Marquer comme clôturé"}
                </button>
                <PekuloDialog.Close asChild>
                  <View
                    render="button"
                    paddingVertical="$2"
                    cursor="pointer"
                    backgroundColor="transparent"
                    borderWidth={0}
                  >
                    <Text
                      color="$colorTertiary"
                      fontSize="$caption"
                      hoverStyle={{ color: "$color" }}
                    >
                      Annuler
                    </Text>
                  </View>
                </PekuloDialog.Close>
              </View>
            </View>
          </PekuloDialog.Content>
        </PekuloDialog.Portal>
      </PekuloDialog>
    );
  }
  ```

  Also write `holding-close-confirm.a11y.test.tsx`:

  ```tsx
  import { describe, expect, test, vi } from "vitest";
  import { axe } from "vitest-axe";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { renderWithTamagui } from "../../../../../../test/setup";

  vi.mock("../_actions/holdings-actions", () => ({
    closeHolding: vi.fn(),
  }));

  import { HoldingCloseConfirm } from "./holding-close-confirm";

  const FAKE_HOLDING = {
    id: "hld_test",
    userId: "00000000-0000-0000-0000-000000000000",
    accountId: "acc_test",
    kind: "etf" as const,
    ticker: "CW8",
    isin: null,
    label: "Amundi CW8",
    currency: "EUR" as const,
    quantity: 10,
    avgCost: 24.5,
    lastPrice: 26.1,
    lastPriceAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  };

  describe("HoldingCloseConfirm a11y (AC-11)", () => {
    test("zero axe violations when open", async () => {
      const qc = new QueryClient();
      const { container } = renderWithTamagui(
        <QueryClientProvider client={qc}>
          <HoldingCloseConfirm holding={FAKE_HOLDING} open onOpenChange={() => {}} />
        </QueryClientProvider>,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
  ```

  Run: `bun --filter=@pekulo/web test holding-close-confirm.a11y`. Expected: `Tests  1 passed (1)`, exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/portefeuille/_components/holding-close-confirm.tsx apps/web/src/app/\(cap\)/dashboard/portefeuille/_components/holding-close-confirm.a11y.test.tsx && git commit -m "feat(#23): T8 — holding-close-confirm (idempotent + NOT_FOUND envelope)"`. [AC: AC-3, AC-8, AC-11]

- [x] **T9 — Create `page.tsx` route.** Write `apps/web/src/app/(cap)/dashboard/portefeuille/page.tsx`. Server component — the `(cap)/dashboard/layout.tsx` already handles the auth redirect, so this page just renders the client section. No `readHoldings` server-side prefetch — `useHoldings()` handles the initial fetch inside the client section (consistent with `parametres/page.tsx` for compass and the empty-state pattern of `patrimoine-view.tsx`; a future story can add a server prefetch + hydration if measured to help).

  Full file content:

  ```tsx
  import { PortfolioSection } from "./_components/portfolio-section";

  export default function PortefeuillePage() {
    return (
      <div style={{ display: "flex", padding: 16, alignItems: "center", flexDirection: "column" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 1024,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <PortfolioSection />
        </div>
      </div>
    );
  }
  ```

  Run: `bun --filter=@pekulo/web run typecheck`. Expected: exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/portefeuille/page.tsx && git commit -m "feat(#23): T9 — /dashboard/portefeuille route"`. [AC: AC-1, AC-5]

- [x] **T10 — Rewire `cap-shell.tsx` nav `portfolio` → `/dashboard/portefeuille`.** Modify `apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx`. Find the `handleNav` function (lines 44-59 at write time) and remove the `"portfolio"` branch from the `label = key === "transactions" ? "Transactions" : key === "monthly" ? "Mensuel" : key === "portfolio" ? "Portefeuille" : "Immobilier";` ternary, adding a dedicated route branch ABOVE the toast.

  Replace this block:

  ```ts
    const handleNav = (key: PekuloNavKey) => {
      if (key === "cap") return;
      if (key === "settings") {
        router.push("/dashboard/parametres");
        return;
      }
      const label =
        key === "transactions"
          ? "Transactions"
          : key === "monthly"
            ? "Mensuel"
            : key === "portfolio"
              ? "Portefeuille"
              : "Immobilier";
      toast.info("Bientôt", `${label} arrive plus tard.`);
    };
  ```

  With:

  ```ts
    const handleNav = (key: PekuloNavKey) => {
      if (key === "cap") return;
      if (key === "settings") {
        router.push("/dashboard/parametres");
        return;
      }
      if (key === "portfolio") {
        router.push("/dashboard/portefeuille");
        return;
      }
      const label =
        key === "transactions"
          ? "Transactions"
          : key === "monthly"
            ? "Mensuel"
            : "Immobilier";
      toast.info("Bientôt", `${label} arrive plus tard.`);
    };
  ```

  Run: `bun --filter=@pekulo/web run typecheck`. Expected: exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/_components/cap-shell.tsx && git commit -m "feat(#23): T10 — nav rail Portefeuille -> /dashboard/portefeuille"`. [AC: AC-5]

- [x] **T11 — Move `accounts-actions.ts` into `parametres/_actions/` + rewrite 12 importers.** Co-locate the accounts feature.

  Step 1 — Move:

  ```bash
  mkdir -p "apps/web/src/app/(cap)/dashboard/parametres/_actions"
  git mv apps/web/src/lib/actions/accounts-actions.ts \
    "apps/web/src/app/(cap)/dashboard/parametres/_actions/accounts-actions.ts"
  ```

  Step 2 — Rewrite each of these 12 importer files. In each file, replace the literal string `"@/lib/actions/accounts-actions"` with `"../_actions/accounts-actions"` (all 12 importers live in `parametres/_components/` or `parametres/_hooks/`, which are siblings of `parametres/_actions/`).

  Files to patch (each contains exactly one such import):

  1. `apps/web/src/app/(cap)/dashboard/parametres/_components/account-delete-confirm.a11y.test.tsx`
  2. `apps/web/src/app/(cap)/dashboard/parametres/_components/accounts-section.a11y.test.tsx`
  3. `apps/web/src/app/(cap)/dashboard/parametres/_components/account-create-form.a11y.test.tsx`
  4. `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-update-account.test.tsx`
  5. `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-record-balance-change.ts`
  6. `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-delete-account.test.tsx`
  7. `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-accounts.ts`
  8. `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-create-account.test.tsx`
  9. `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-update-account.ts`
  10. `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-delete-account.ts`
  11. `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-create-account.ts`
  12. `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-record-balance-change.test.tsx`

  Bulk command (verify no false positive by running grep before; if grep clean, run sed):

  ```bash
  rg -l '"@/lib/actions/accounts-actions"' "apps/web/src/app/(cap)/dashboard/parametres" \
    | xargs sed -i '' 's|"@/lib/actions/accounts-actions"|"../_actions/accounts-actions"|g'
  ```

  After the sed, verify there are zero remaining hits:

  ```bash
  rg '"@/lib/actions/accounts-actions"' apps/web/src && echo "STILL_PRESENT" || echo "CLEAN"
  ```

  Expected: `CLEAN`.

  Run: `bun --filter=@pekulo/web run typecheck && bun --filter=@pekulo/web test use-accounts use-create-account use-delete-account use-update-account use-record-balance-change accounts-section.a11y account-create-form.a11y account-delete-confirm.a11y`. Expected: exit 0; all tests pass.
  Commit: `git add -A && git commit -m "refactor(#23): T11 — co-locate accounts-actions.ts under parametres/_actions/ (12 importers updated)"`. [AC: AC-7, AC-9]

- [x] **T12 — Move `compass-actions.ts` into `dashboard/_actions/` + rewrite 5 importers (cross-route).** Compass is consumed from both `/dashboard` (CapView) and `/dashboard/parametres` (settings) — place it at the parent `dashboard/_actions/`. Importers in `dashboard/_hooks/` use `../_actions/`; importers in `parametres/_hooks/` use `../../_actions/`.

  Step 1 — Move:

  ```bash
  mkdir -p "apps/web/src/app/(cap)/dashboard/_actions"
  git mv apps/web/src/lib/actions/compass-actions.ts \
    "apps/web/src/app/(cap)/dashboard/_actions/compass-actions.ts"
  ```

  Step 2 — Per-file rewrite (relative-path depth differs between the two consumer route levels):

  In **`apps/web/src/app/(cap)/dashboard/_hooks/use-dashboard-compass.ts`** — replace:

  ```ts
  from "@/lib/actions/compass-actions"
  ```

  with:

  ```ts
  from "../_actions/compass-actions"
  ```

  Apply the same replacement to:

  - `apps/web/src/app/(cap)/dashboard/_hooks/use-compass-curve.ts` → `from "../_actions/compass-actions"`
  - `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-update-compass.ts` → `from "../../_actions/compass-actions"`
  - `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-compass-history.ts` → `from "../../_actions/compass-actions"`
  - `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-update-compass.test.tsx` → `from "../../_actions/compass-actions"`

  Bulk commands (depth-aware):

  ```bash
  rg -l '"@/lib/actions/compass-actions"' "apps/web/src/app/(cap)/dashboard/_hooks" \
    | xargs sed -i '' 's|"@/lib/actions/compass-actions"|"../_actions/compass-actions"|g'
  rg -l '"@/lib/actions/compass-actions"' "apps/web/src/app/(cap)/dashboard/parametres" \
    | xargs sed -i '' 's|"@/lib/actions/compass-actions"|"../../_actions/compass-actions"|g'
  ```

  Verify zero remaining `@/lib/actions/compass-actions` references:

  ```bash
  rg '"@/lib/actions/compass-actions"' apps/web/src && echo "STILL_PRESENT" || echo "CLEAN"
  ```

  Expected: `CLEAN`.

  Run: `bun --filter=@pekulo/web run typecheck && bun --filter=@pekulo/web test use-dashboard-compass use-compass-curve use-update-compass use-compass-history`. Expected: exit 0; tests pass.
  Commit: `git add -A && git commit -m "refactor(#23): T12 — co-locate compass-actions.ts under dashboard/_actions/ (5 importers across 2 route levels)"`. [AC: AC-7, AC-9]

- [x] **T13 — Move `milestones-actions.ts` into `dashboard/_actions/` + rewrite 9 importers.** All importers live in `dashboard/_hooks/` or `dashboard/_components/` (siblings of `dashboard/_actions/`).

  Step 1 — Move:

  ```bash
  git mv apps/web/src/lib/actions/milestones-actions.ts \
    "apps/web/src/app/(cap)/dashboard/_actions/milestones-actions.ts"
  ```

  Step 2 — Bulk rewrite (single depth — all consumers are 1 level above `_actions/`):

  ```bash
  rg -l '"@/lib/actions/milestones-actions"' "apps/web/src/app/(cap)/dashboard" \
    | xargs sed -i '' 's|"@/lib/actions/milestones-actions"|"../_actions/milestones-actions"|g'
  ```

  Verify:

  ```bash
  rg '"@/lib/actions/milestones-actions"' apps/web/src && echo "STILL_PRESENT" || echo "CLEAN"
  ```

  Expected: `CLEAN`. The 9 importers to verify:

  1. `apps/web/src/app/(cap)/dashboard/_components/add-milestone-form.spy.test.tsx`
  2. `apps/web/src/app/(cap)/dashboard/_hooks/use-add-milestone-form.ts`
  3. `apps/web/src/app/(cap)/dashboard/_hooks/use-milestone-statuses.ts`
  4. `apps/web/src/app/(cap)/dashboard/_hooks/use-add-milestone-form.test.tsx`
  5. `apps/web/src/app/(cap)/dashboard/_hooks/use-milestones.ts`
  6. `apps/web/src/app/(cap)/dashboard/_hooks/use-delete-milestone.ts`
  7. `apps/web/src/app/(cap)/dashboard/_hooks/use-update-milestone.ts`
  8. `apps/web/src/app/(cap)/dashboard/_hooks/use-delete-milestone.test.tsx`
  9. `apps/web/src/app/(cap)/dashboard/_hooks/use-update-milestone.test.tsx`

  Run: `bun --filter=@pekulo/web run typecheck && bun --filter=@pekulo/web test use-milestones use-add-milestone-form use-delete-milestone use-update-milestone use-milestone-statuses add-milestone-form.spy`. Expected: exit 0; tests pass.
  Commit: `git add -A && git commit -m "refactor(#23): T13 — co-locate milestones-actions.ts under dashboard/_actions/ (9 importers updated)"`. [AC: AC-7, AC-9]

- [x] **T14 — Delete brownfield + retire `lib/actions/` + clean `lib/types.ts`.** Sweep all the Supabase-direct portfolio + holding-lots code, the 3 orphan SA files queued for future-epic ports, and the holding-specific types from `apps/web/src/lib/types.ts`. After T11/T12/T13, `lib/actions/` should already be empty except for the 5 deletion targets below.

  Step 1 — Delete:

  ```bash
  # 5 SA files retired (portfolio + holding-lots replaced by T1; 3 orphans queued for epic 5/7 ports).
  git rm apps/web/src/lib/actions/portfolio.ts
  git rm apps/web/src/lib/actions/holding-lots.ts
  git rm apps/web/src/lib/actions/monthly.ts
  git rm apps/web/src/lib/actions/transactions.ts
  git rm apps/web/src/lib/actions/hypotheses.ts
  # 4 data-layer files (Supabase-direct reads) — only portfolio + holding-lots are
  # in scope of 3-4. monthly + transactions data files stay until epic 5 (they
  # belong with their action ports).
  git rm apps/web/src/lib/data/portfolio.ts
  git rm apps/web/src/lib/data/holding-lots.ts
  # 3 derive helpers ported to apps/api/src/common/derive/ in 3-1/3-3.
  git rm apps/web/src/lib/derive-portfolio.ts
  git rm apps/web/src/lib/derive-portfolio-fx.ts
  git rm apps/web/src/lib/derive-lots.ts
  # 5 service clients ported to apps/api/src/modules/holdings/services/ in 3-2/3-3.
  git rm apps/web/src/lib/services/prices.ts
  git rm apps/web/src/lib/services/yahoo-finance.ts
  git rm apps/web/src/lib/services/boursorama.ts
  git rm apps/web/src/lib/services/twelve-data.ts
  git rm apps/web/src/lib/services/fx.ts
  # 2 zod schema files now living in @pekulo/validators.
  git rm apps/web/src/lib/schemas/portfolio.ts
  git rm apps/web/src/lib/schemas/holding-lots.ts
  ```

  Step 2 — Remove the now-empty `lib/actions/` directory (Git tracks files, not folders, but a `rmdir` keeps the working tree clean):

  ```bash
  rmdir apps/web/src/lib/actions
  ```

  Verify:

  ```bash
  ls apps/web/src/lib/actions 2>&1 | grep "No such file or directory" && echo "REMOVED" || echo "STILL_PRESENT"
  ```

  Expected: `REMOVED`.

  Step 3 — Clean `apps/web/src/lib/types.ts`. Open the file. Delete the holding-related blocks. The current file (Step-0 quoted in Dev Notes) contains these declarations to remove:

  - Line 106: `export type HoldingKind = "etf" | "action" | "autre";` — superseded by `@pekulo/types#HOLDING_KINDS` (which already adds `crypto`, story 3-1).
  - Lines 118-133: `export interface Holding { … }` — superseded by `@pekulo/validators#holdingSchema` (Zod-inferred).
  - Lines 134-145: `export interface PortfolioSnapshot { … }` — superseded by `@pekulo/validators#portfolioSnapshotFxSchema` (story 3-3).
  - Lines 147-151: `export interface RefreshFailure { … }` — dead (refresh flow not yet re-ported; epic 7 will own).
  - Lines 153-156: `export interface RefreshSummary { … }` — dead.
  - Lines 158: `export type LotType = "buy" | "sell";` — superseded by `@pekulo/validators#recordLotInputSchema.shape.type`.
  - Lines 160-166: `export interface HoldingLot { … }` — superseded by `@pekulo/validators#holdingLotSchema`.

  KEEP these (still in use by other features):

  - `KpiData`, `MonthlyRecord`, `AnnualSummary`, `ScenarioItem`, `BudgetItem`, `RevenueItem`, `Hypotheses` re-export, `MonthlyEntry`, `MonthlyMerged`, `TransactionType`, `TransactionCategory`, `Transaction`, `Currency`, `AccountType`, `Account`.

  Sanity check after the edit:

  ```bash
  rg "Holding\b|HoldingKind|HoldingLot|LotType|PortfolioSnapshot|RefreshFailure|RefreshSummary" apps/web/src/lib/types.ts && echo "STILL_PRESENT" || echo "CLEAN"
  ```

  Expected: `CLEAN`.

  Run: `bun --filter=@pekulo/web run typecheck && bun --filter=@pekulo/web run lint`. Expected: exit 0; lint shows zero errors. Then `rg --no-heading -n 'from\("holdings"\)|from\("holding_lots"\)' apps/web/src` — expected: no matches (AC-6).
  Commit: `git add -A && git commit -m "chore(#23): T14 — retire lib/actions/ + delete 14 brownfield files + clean lib/types.ts holding entries (AC-6, AC-7)"`. [AC: AC-6, AC-7, AC-9]

- [x] **T15 — Visual verification via react-grab-mcp.** Per `CLAUDE.md` rule "Frontend = visual verification", spin the dev server and inspect the rendered portfolio screen.

  Step 1 — Start dev server (background):

  ```bash
  bun --filter=@pekulo/web run dev
  ```

  Step 2 — In your browser (or via the MCP tool), open `http://localhost:3000/dashboard/portefeuille` (log in if needed — the `(cap)/dashboard/layout.tsx` redirect catches unauth users).

  Step 3 — Use `mcp__react-grab-mcp__get_element_context` on:

  - The hero `<section aria-label="Valeur totale du portefeuille">` — verify the PnL text color is `$accent` for ≥ 0 / `$danger` for < 0. Verify `font-variant: tabular-nums` is applied.
  - One `ClassRow` `<li>` — verify the `PekuloDonut` is `size={24}` (24px width/height) with `stroke={2.5}`. Verify the percentage right-column is `w-10` (40px) `text-right`.
  - One `HoldingRow` — verify the `kind` chip is uppercase `letter-spacing` and `$colorMuted`; the PnL line color matches the gain/loss rule.
  - The "Ajouter" pill in the Lignes section — verify it opens the create dialog with the correct title.

  Step 4 — Record findings under "Visual verification — T15" in the Dev Agent Record (no commit needed unless adjustments are made; if any fidelity gap is found, fix in-place and commit `fix(#23): T15 — visual fidelity adjustments`).

  Expected: TR-strict palette passes all four spot checks. No card borders. Pure `#000` background per memory `feedback_trade_republic_fidelity`. [AC: AC-12]

- [x] **T16 — Final cross-workspace check + AC-sealing commit.** Run the full project check across all workspaces. This proves the action moves did not break `@pekulo/web`, `@pekulo/api`, `@pekulo/contracts`, `@pekulo/validators`, `@pekulo/types`, `@pekulo/ui`, `@pekulo/zod`, `@pekulo/oxlint-config`.

  Run, in order:

  ```bash
  bun install
  bun --filter='@pekulo/*' run typecheck
  bun --filter='@pekulo/*' run lint
  bun --filter='@pekulo/web' run test
  bun --filter='@pekulo/api' run test
  ```

  Expected — all four steps exit 0; lint reports zero errors; test summaries: `Tests passed` with the new `portfolio-section.a11y`, `holding-create-form.a11y`, `lot-form.a11y`, `holding-close-confirm.a11y` plus every pre-existing suite still green.

  Step 2 — AC-sealing grep (verbatim AC-6 wording — must produce zero hits):

  ```bash
  rg --no-heading -n 'from\("holdings"\)|from\("holding_lots"\)' apps/web/src && echo "AC6_FAIL" || echo "AC6_PASS"
  rg --no-heading -n 'from\("accounts"\)' apps/web/src && echo "AC6_LEGACY_FAIL" || echo "AC6_OK"
  ls apps/web/src/lib/actions 2>&1 | grep "No such file or directory" && echo "AC7_PASS" || echo "AC7_FAIL"
  find apps/web/src/app/\(cap\)/dashboard/portefeuille -name "*.types.ts" | head -1 && echo "AC10_FAIL" || echo "AC10_PASS"
  ```

  Expected: `AC6_PASS`, `AC6_OK`, `AC7_PASS`, `AC10_PASS`.

  Step 3 — Final commit (only if all checks pass):

  Commit: `git commit --allow-empty -m "feat(#23): T16 — AC-sealing cross-workspace verification PASS"` (allow-empty because all real changes were committed in T1–T14; this commit is the explicit pass marker referenced by aped-review).

  [AC: AC-6, AC-7, AC-9, AC-10, AC-11]

## Dev Notes

### Architecture references

- **Module shape (architecture.md § Phase 3 Code Structure):** Holdings module on the API side is fully assembled (3-1/3-2/3-3). This story owns the **web tier consumption** — thin SA delegators (`holdings-actions.ts`) → typed-error envelopes → React Query hooks → Tamagui components.
- **Component → Hook → Server Action boundary (ADR-0010):** Hooks are the only place SAs are called. Components never import from `*-actions.ts`. The `pekulo/no-server-action-in-component` lint rule enforces this.
- **Feature co-location (story-3-4 precedent):** All `_actions/` + `_components/` + `_hooks/` for a single feature live under the same route folder. Cross-feature consumption is allowed at the **hook layer** (e.g. `portfolio-section.tsx` imports `useAccounts` from `parametres/_hooks/`) but NOT at the **action layer** (`pekulo/no-cross-feature-action-import` will eventually enforce this once `apps/web/src/features/` exists — current oxlint config self-gates by `featureRoots` glob).
- **Tag invalidation graph (3-1 wired):** `holdingsTags.list()` → invalidates `holdingsKeys.list()` AND `portfolioKeys.holdings()` AND `portfolioKeys.snapshot()`. Already in `apps/web/src/lib/zapaction/keys.ts:74-134`. No changes needed in this story.

### ADRs in scope

- `docs/adr/0009-elysia-orpc-with-zapaction-bridge.md` — web tier consumes oRPC through the zapaction `defineAction` bridge.
- `docs/adr/0010-hooks-orchestration-boundary.md` — Component → Hook → SA hard boundary. Cross-feature data fetches at hook layer only.
- `docs/adr/0011-packages-reorg-pekulo-namespace.md` — types in `@pekulo/types`, validators in `@pekulo/validators`, contracts in `@pekulo/contracts`.

### Lessons re-applied (verbatim filter — Scope: `aped-story` or `all` or `aped-dev`)

- **L1 (Scope: aped-story, aped-arch, aped-dev) — `docs/ux-preview/src/App.tsx` is the AUTHORITATIVE design intent.** Applied: the `PortfolioScreen` at line 1449 of `App.tsx` is the canonical layout — hero with `grid-cols-12` 7/5 split, then `Section "Lignes"` with `HeaderAction Plus "Ajouter"`. Forms are NOT in ux-preview — derived from the `account-*-form` precedent in `parametres/_components/` per Fred's validation in story preparation.
- **L2 (Scope: aped-story, aped-dev, aped-review) — `bun --filter=@pekulo/<short>` is the correct filter syntax.** Applied: every command in T1–T16 uses `bun --filter=@pekulo/web` or `bun --filter='@pekulo/*'`. Story 3-3 surfaced `bun --filter=api` which fails with `No packages matched the filter` — that pitfall is avoided here.
- **L25 (Scope: aped-arch, aped-dev) — `ensureRequestContext()` is the defensive boundary on every SA.** Applied: every delegator in `holdings-actions.ts` (T1) calls `await ensureRequestContext()` before the oRPC client invocation.
- **`pekuloColors` 1:1 mirror SSOT** (Scope: aped-dev, aped-arch, aped-review) — applied to the TR-strict palette usage: `$color`, `$colorSecondary`, `$colorTertiary`, `$colorMuted`, `$backgroundCard`, `$backgroundMuted`. `$danger` for destructive states. `$accent` (emerald) reserved STRICTLY for monetary deltas (PnL +/-). No card borders.
- **TR-strict palette — `$accent` reserved for ± monetary deltas** (Scope: aped-dev, aped-review). Applied: hero PnL color is `$accent` for ≥ 0, `$danger` for < 0. HoldingRow PnL uses the same rule. Confirmation states use `$success` (not `$accent`).
- **Zero `*.types.ts` inside the route** (Scope: aped-arch, aped-dev, aped-review). Applied: AC-10 enforces this with a `find` grep. Co-located envelope types (`CreateHoldingResult`, `RecordLotResult`, `CloseHoldingResult`) live INSIDE `holdings-actions.ts`.
- **Typed-error envelopes through the SA boundary** (Scope: aped-arch, aped-dev — precedent: 2-3 T2). Applied: 3 of the 5 delegators (create / recordLot / close) catch `ORPCError` and return `{ ok: false, code, message }`. The hooks narrow on `result.ok` to surface the localised error inline.
- **No `Number(decimal)`** (Scope: aped-arch, aped-dev — stories 0-6, 1-2, 2-1, 3-1, 5-1, 7-1, 7-3) — N/A here: this story consumes already-coerced numbers from the API (3-1 enforced `decimalToNumber` at the repository boundary). The web tier receives `number` values from `holdingSchema`.

### Decisions re-applied from earlier Epic 3 stories

- **Story 3-1 — `recordLot` is atomic at the API repo layer.** Web tier passes `{ holdingId, type, occurredOn, quantity, priceUnit, fees, notes }` and trusts the `RecordLotOutcome` translation to `ok | HOLDING_NOT_FOUND | HOLDING_CLOSED`. Don't re-implement the atomic guard at the SA layer.
- **Story 3-1 — Module-factory naming uses the plural form (`createHoldingsRepository`, etc.).** N/A to the web tier (no module factories), but consistent naming: our web SA file is `holdings-actions.ts` (plural).
- **Story 3-1 — `closedAt` lifecycle is idempotent.** Re-confirmed by AC-3.
- **Story 3-2 — `holdingsContract` procedure count stays at 5 (`create | recordLot | close | list | getDerived`).** AC-8 envelopes do NOT add procedures; they translate typed errors at the SA boundary.
- **Story 3-3 — `computeSnapshotFx` is the canonical FX-resolved snapshot.** This story does NOT wire it. Story 7-1 will. For 3-4 we render a transparent client-side approximation: `marketValueEur = quantity * lastPrice` (acknowledged single-currency assumption, called out as `// Best-effort` in `portfolio-section.tsx`). The hero label is "Valeur portefeuille · EUR" without an FX-source badge — the source-of-truth FX value lands with 7-1.
- **Story 3-3 — `FrankfurterClient` is stateless.** N/A to the web tier (snapshot consumption happens in 7-1).
- **Story 3-3 — `convertToBase` is intentionally duplicated with INVARIANT markers.** N/A to the web tier.

### Step-0 quotes (verbatim current state at story-write time)

Snapshot taken on the `feature/23-3-4-portfolio-ui` branch at story-write time. If the dev agent finds drift on disk during implementation, RE-READ the file before editing and surface the divergence in the Dev Agent Record.

#### `apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx:36-115` (will be modified in T10)

```tsx
export function CapShell({ email, children }: CapShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "patrimoine" ? "patrimoine" : "cap";
  const toast = useToast();
  const today = dateFmt.format(new Date());
  const initial = (email ?? "?").charAt(0).toUpperCase();

  const handleNav = (key: PekuloNavKey) => {
    if (key === "cap") return;
    if (key === "settings") {
      router.push("/dashboard/parametres");
      return;
    }
    const label =
      key === "transactions"
        ? "Transactions"
        : key === "monthly"
          ? "Mensuel"
          : key === "portfolio"
            ? "Portefeuille"
            : "Immobilier";
    toast.info("Bientôt", `${label} arrive plus tard.`);
  };
  // … (rest unchanged)
}
```

T10 replaces the `handleNav` body — the rest of the file (header / nav rail / new-tx pill / user-dot / main / mobile-bottom-nav) stays exactly as currently shipped.

#### `apps/web/src/lib/types.ts:104-167` (will be edited in T14)

```ts
export type Currency = "EUR" | "USD" | "GBP" | "CHF";
export type AccountType = "livret" | "pea" | "cto" | "av" | "autre";
export type HoldingKind = "etf" | "action" | "autre";  // ← DELETE (superseded by @pekulo/types#HOLDING_KINDS w/ crypto)

export interface Account {
  // … keep ALL Account-related declarations unchanged
}
export interface Holding {  // ← DELETE entire interface
  id: string;
  accountId: string;
  kind: HoldingKind;
  ticker: string | null;
  isin: string | null;
  label: string;
  currency: Currency;
  quantity: number;
  avgCost: number;
  lastPrice: number;
  lastPriceAt: string | null;
  notes: string | null;
  createdAt: string;
}
export interface PortfolioSnapshot {  // ← DELETE entire interface
  // … (re-implemented as @pekulo/validators#portfolioSnapshotFxSchema in 3-3)
}
export interface RefreshFailure {  // ← DELETE
  // …
}
export interface RefreshSummary {  // ← DELETE
  // …
}
export type LotType = "buy" | "sell";  // ← DELETE (superseded by recordLotInputSchema.shape.type)
export interface HoldingLot {  // ← DELETE
  // … (re-implemented as @pekulo/validators#holdingLotSchema in 3-1)
}
```

T14's `lib/types.ts` edit removes ONLY these holding-related declarations. The remaining `Currency`, `AccountType`, `Account`, and monthly/transaction types stay untouched.

#### `apps/web/src/lib/actions/portfolio.ts:1-50` (will be DELETED in T14)

```ts
"use server";

import { defineAction } from "@zapaction/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { holdingSchema, idSchema, updatePriceSchema } from "@/lib/schemas/portfolio";
import { portfolioTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";
import type { Currency, Holding, HoldingKind, RefreshSummary } from "@/lib/types";
import { fetchPriceQuote, PriceError } from "@/lib/services/prices";
import { YahooError } from "@/lib/services/yahoo-finance";

const holdingRow = (row: Record<string, unknown>): Holding => ({
  id: String(row.id),
  // … (Supabase row-mapper)
});
// … 6 Supabase-direct `defineAction` exports follow
```

This entire file is deleted (T14). It was the brownfield Supabase-direct write path, fully superseded by `holdings-actions.ts` (T1) which delegates to oRPC.

#### `apps/web/src/lib/actions/holding-lots.ts:1-60` (will be DELETED in T14)

```ts
"use server";

import { defineAction } from "@zapaction/core";
// … 3 Supabase-direct `defineAction` exports for lot read/write/delete
```

Deleted in T14 — the lot writes are folded into `holdings-actions.ts` (T1) via `recordLot`.

#### `apps/web/src/lib/actions/accounts-actions.ts:1-30` (will MOVE in T11 — content unchanged)

```ts
"use server";

import { defineAction } from "@zapaction/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ORPCError } from "@orpc/client";
import {
  accountSchema,
  createAccountInputSchema,
  // …
} from "@pekulo/validators";
import { accountsClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { accountsTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

/** Envelope for deleteAccount — preserves the typed code across the SA boundary. */
export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; code: "ACCOUNT_REFERENCED_FK" | "ACCOUNT_NOT_FOUND"; message: string };

export const listAccounts = defineAction<void, Account[], ActionContext>({
  // …
});
// … (rest of file)
```

T11 does `git mv` — content stays bit-identical. Only the 12 importer files change (each rewriting `"@/lib/actions/accounts-actions"` → `"../_actions/accounts-actions"`).

#### `apps/web/src/lib/actions/compass-actions.ts:1-30` (will MOVE in T12 — content unchanged)

```ts
"use server";
import { defineAction } from "@zapaction/core";
// … oRPC delegators for compass.* procedures
```

T12 does `git mv` to `dashboard/_actions/compass-actions.ts`. The 5 importers split by depth — `dashboard/_hooks/*` uses `../_actions/`, `parametres/_hooks/*` uses `../../_actions/`.

#### `apps/web/src/lib/actions/milestones-actions.ts:1-30` (will MOVE in T13 — content unchanged)

```ts
"use server";
import { defineAction } from "@zapaction/core";
// … oRPC delegators for milestones.* procedures
```

T13 does `git mv` to `dashboard/_actions/milestones-actions.ts`. All 9 importers use `../_actions/`.

#### `apps/web/src/lib/zapaction/keys.ts:70-134` (READ-ONLY — wired by story 3-1, used as-is)

```ts
export const HOLDINGS_KEY = "holdings" as const;
export const holdingsKeys = createFeatureKeys(HOLDINGS_KEY, {
  list: () => ["list"] as const,
});
export const holdingsTags = createFeatureTags(HOLDINGS_KEY, {
  list: () => ["list"] as const,
});

// … inside setTagRegistry({…})
[holdingsTags.all()]: [holdingsKeys.list(), portfolioKeys.holdings(), portfolioKeys.snapshot()],
[holdingsTags.list()]: [holdingsKeys.list(), portfolioKeys.holdings(), portfolioKeys.snapshot()],
```

NO changes to this file in 3-4 — story 3-1 already wired the cross-feature edges. Hooks just reference `holdingsKeys.list()`.

#### `apps/web/src/lib/orpc/modules.ts:51-54` (READ-ONLY — wired by 0-6)

```ts
export const holdingsClient: ContractRouterClient<typeof holdingsContract> = createORPCClient(
  orpcLink,
  { path: ["holdings"] },
);
```

NO changes — story 3-4 imports `holdingsClient` as-is.

### File map — 3-bullet decision template per file

#### `apps/web/src/app/(cap)/dashboard/portefeuille/_actions/holdings-actions.ts` (NEW)

- **Path:** `apps/web/src/app/(cap)/dashboard/portefeuille/_actions/holdings-actions.ts`
- **Responsibility:** Thin oRPC delegators (5 procedures) with typed-error envelopes for `createHolding` / `recordLot` / `closeHolding`. NO business logic, NO data shaping beyond envelope wrapping.
- **Inputs / Outputs:** Imports from `@pekulo/validators` (Zod schemas + inferred types), `@/lib/orpc/modules#holdingsClient`, `@/lib/orpc/request-context#ensureRequestContext`, `@/lib/zapaction/keys#holdingsTags`. Exports 5 `defineAction` server actions + 3 result-envelope types.

#### `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/use-holdings.ts` (NEW)

- **Path:** `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/use-holdings.ts`
- **Responsibility:** `useQuery<Holding[]>` over `listHoldings()`. `staleTime: 30_000` matches `useAccounts` precedent.
- **Inputs / Outputs:** Imports `Holding` from `@pekulo/validators`, `holdingsKeys` from `@/lib/zapaction/keys`, `listHoldings` from `../_actions/holdings-actions`. Exports `useHoldings()` hook returning a `UseQueryResult<Holding[]>`.

#### `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/use-create-holding.ts` (NEW)

- **Path:** `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/use-create-holding.ts`
- **Responsibility:** `useMutation<CreateHoldingResult, Error, CreateHoldingInput>` over `createHolding`. Invalidates `holdingsKeys.list()` `onSettled` (envelopes ride through `data`).
- **Inputs / Outputs:** Imports `CreateHoldingInput`, returns `useMutation` result. Caller narrows on `result.ok`.

#### `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/use-record-lot.ts` (NEW)

- **Path:** `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/use-record-lot.ts`
- **Responsibility:** `useMutation<RecordLotResult, Error, RecordLotInput>` over `recordLot`. Same `onSettled` invalidation as create.
- **Inputs / Outputs:** Imports `RecordLotInput`, returns `useMutation` result.

#### `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/use-close-holding.ts` (NEW)

- **Path:** `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/use-close-holding.ts`
- **Responsibility:** `useMutation<CloseHoldingResult, Error, CloseHoldingInput>` over `closeHolding`. Idempotent — re-calling does not retry-decorate the response.
- **Inputs / Outputs:** Imports `CloseHoldingInput`, returns `useMutation` result.

#### `apps/web/src/app/(cap)/dashboard/portefeuille/_components/portfolio-section.tsx` (NEW)

- **Path:** `apps/web/src/app/(cap)/dashboard/portefeuille/_components/portfolio-section.tsx`
- **Responsibility:** Orchestrator. Loads holdings + accounts; computes hero + repartition + lignes; manages 3-dialog discriminator (create / lot / close).
- **Inputs / Outputs:** Reads `useHoldings`, `useAccounts`; renders `ClassRow`, `HoldingRow`, `HoldingCreateForm`, `LotForm`, `HoldingCloseConfirm`. Exports `PortfolioSection` component.

#### `apps/web/src/app/(cap)/dashboard/portefeuille/_components/class-row.tsx` (NEW)

- **Path:** `apps/web/src/app/(cap)/dashboard/portefeuille/_components/class-row.tsx`
- **Responsibility:** Single répartition row — `PekuloDonut` + label + EUR amount + percentage. Pure render, no state.
- **Inputs / Outputs:** Props `{ label, amount, pct }`. Exports `ClassRow`.

#### `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-row.tsx` (NEW)

- **Path:** `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-row.tsx`
- **Responsibility:** Single holding row — ticker + kind chip + label/account + qty×price + market value + PnL. Pure render. Parent passes derived EUR values + the kebab popover as `trailing` prop.
- **Inputs / Outputs:** Props `{ holding, accountLabel, marketValueEur, unrealisedPnlEur, unrealisedPnlPct, trailing? }`. Exports `HoldingRow`.

#### `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-create-form.tsx` (NEW)

- **Path:** `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-create-form.tsx`
- **Responsibility:** Controlled form. 8 fields. Validates client-side then calls `useCreateHolding.mutate`. Surfaces `ACCOUNT_NOT_FOUND` envelope inline.
- **Inputs / Outputs:** Props `{ accounts, onSuccess? }`. Exports `HoldingCreateForm`.

#### `apps/web/src/app/(cap)/dashboard/portefeuille/_components/lot-form.tsx` (NEW)

- **Path:** `apps/web/src/app/(cap)/dashboard/portefeuille/_components/lot-form.tsx`
- **Responsibility:** Dialog-wrapped controlled form. Buy/sell radio, date input, qty/price/fees/notes. Surfaces `HOLDING_NOT_FOUND` and `HOLDING_CLOSED` envelopes inline.
- **Inputs / Outputs:** Props `{ holding, open, onOpenChange }`. Exports `LotForm`.

#### `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-close-confirm.tsx` (NEW)

- **Path:** `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-close-confirm.tsx`
- **Responsibility:** Dialog-wrapped confirmation. Single danger button → `useCloseHolding.mutate`. Surfaces `HOLDING_NOT_FOUND` envelope inline.
- **Inputs / Outputs:** Props `{ holding, open, onOpenChange }`. Exports `HoldingCloseConfirm`.

#### `apps/web/src/app/(cap)/dashboard/portefeuille/page.tsx` (NEW)

- **Path:** `apps/web/src/app/(cap)/dashboard/portefeuille/page.tsx`
- **Responsibility:** Server component route. Renders `<PortfolioSection />` inside a `max-w-1024px` flex column with `gap: 24px`. Auth is enforced by the parent `(cap)/dashboard/layout.tsx`.
- **Inputs / Outputs:** Exports default `PortefeuillePage`. No props, no server-side data fetching (the section's hooks own the data lifecycle).

#### `apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx` (MODIFY)

- **Path:** `apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx`
- **Responsibility:** Add a single dedicated branch for `key === "portfolio"` in `handleNav` so the nav rail / mobile bottom nav route to `/dashboard/portefeuille` instead of toasting "Bientôt".
- **Inputs / Outputs:** No new imports. The `transactions` / `monthly` / `realestate` cases keep toasting.

#### `apps/web/src/app/(cap)/dashboard/parametres/_actions/accounts-actions.ts` (MOVE from `lib/actions/`)

- **Path:** moved verbatim. Content unchanged.
- **Responsibility:** unchanged.
- **Inputs / Outputs:** 12 importers in `parametres/_components/` and `parametres/_hooks/` update their import path to `../_actions/accounts-actions`.

#### `apps/web/src/app/(cap)/dashboard/_actions/compass-actions.ts` (MOVE from `lib/actions/`)

- **Path:** moved to the parent `dashboard/_actions/` (cross-route consumer: parametres also uses it).
- **Responsibility:** unchanged.
- **Inputs / Outputs:** 5 importers split by depth (`dashboard/_hooks/*` → `../_actions/`, `parametres/_hooks/*` → `../../_actions/`).

#### `apps/web/src/app/(cap)/dashboard/_actions/milestones-actions.ts` (MOVE from `lib/actions/`)

- **Path:** moved to `dashboard/_actions/`.
- **Responsibility:** unchanged.
- **Inputs / Outputs:** 9 importers (all under `dashboard/_hooks/` or `dashboard/_components/`) update to `../_actions/`.

#### `apps/web/src/lib/actions/{portfolio,holding-lots,monthly,transactions,hypotheses}.ts` + `lib/data/{portfolio,holding-lots}.ts` + `lib/{derive-portfolio,derive-portfolio-fx,derive-lots}.ts` + `lib/services/{prices,yahoo-finance,boursorama,twelve-data,fx}.ts` + `lib/schemas/{portfolio,holding-lots}.ts` (DELETE)

- 17 files in total. Brownfield SA + data + derive + service + schema code, fully superseded by the API ports (3-1/3-2/3-3) and this story's web port (T1).
- **Why delete:** no consumers (post-T1/T11/T12/T13). Their presence in the repo creates two competing paths for the same data ("which import wins?") — a classic future-confusion hazard.

#### `apps/web/src/lib/types.ts` (EDIT)

- **Path:** unchanged.
- **Responsibility:** Strip the holding-specific types (`HoldingKind`, `Holding`, `PortfolioSnapshot`, `RefreshFailure`, `RefreshSummary`, `LotType`, `HoldingLot`). Keep account / monthly / transaction types until their owning epics port.
- **Inputs / Outputs:** Net-7 fewer exports. `Account`, `Currency`, `AccountType` stay (consumed by `account-create-form.tsx` etc.).

### Cross-feature import discipline (first precedent — read this twice)

`portfolio-section.tsx` (T5) imports the **hook** `useAccounts` from `../../parametres/_hooks/use-accounts` to populate the create-form `accountId` selector. This is a deliberate cross-route hook import — the FIRST one in Pekulo.

- **Why it's allowed:** the hook layer is the orchestration boundary per ADR-0010. Components are free to compose data from multiple feature hooks. The constraint is at the SA layer — `holdings-actions.ts` does NOT import `accounts-actions.ts` (that would violate `pekulo/no-cross-feature-action-import` once the rule's `featureRoots` glob points at `apps/web/src/app/`).
- **Why it's not a feature-coupling hazard:** the accounts list is a **read-only** dependency for the dropdown. If accounts moves shape (e.g. adds an `active` flag), this consumer just sees a richer `Account[]` — no contract break.
- **Future hardening (out of scope):** when `apps/web/src/features/` is materialised (per the oxlint config's R1 follow-up), the lint rule will gate cross-feature SA imports automatically. The hook layer remains free by design.

### `accountId` selector — currency invariant note

The create-form (T6) does NOT enforce `holding.currency === account.currency`. The contract `holdingSchema.currency` is independent of `account.currency` (an account can hold USD positions even if its cash balance is EUR — a real-world brokerage scenario: a PEA can't, but a CTO can). Validation of this invariant — if Pekulo ever wants to enforce it — belongs in the API service layer (story 7-3 or a dedicated holding-validation story), NOT at the form. For 3-4 we trust the user's intent.

### Test conventions

- **a11y tests** — vitest + `vitest-axe`. Each new component (`portfolio-section`, `holding-create-form`, `lot-form`, `holding-close-confirm`) gets a `.a11y.test.tsx`. `class-row` and `holding-row` are covered transitively (pure rendering primitives).
- **Spy tests** — none in this story. The 2-3 pattern used spy tests for forms; for 3-4 the envelope-narrowing logic is exercised by the hook unit tests (covered in a follow-up if reviewer asks). The forms themselves are visually verified in T15.
- **Hook unit tests** — not added in this story. Each new hook is a 10-15-line wrapper over `useQuery` / `useMutation`; the same code paths are exercised by the `*.a11y` tests through the rendered component. Story 2-3 added 4 hook unit tests for the same shape and they were noisy — we elide here.

### Ticket sync (post-merge)

After all 16 tasks land and `aped-review` passes, follow `.aped/aped-dev/references/ticket-git-workflow.md`:

- Close ticket #23 with a comment linking to the merge commit + PR.
- Update `state.yaml` `sprint.stories.3-4-portfolio-ui.status` to `done` and stamp `completed_at`.
- `aped-review` (next step) appends a "Story 3-4-portfolio-ui — done" block to `docs/epics-context/epic-3-context.md` § "Previous stories — outcomes" with the canonical fields (Decisions / Files / Contracts / Deviations).

## File List

### Created (16 new files)

1. `apps/web/src/app/(cap)/dashboard/portefeuille/_actions/holdings-actions.ts`
2. `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/use-holdings.ts`
3. `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/use-create-holding.ts`
4. `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/use-record-lot.ts`
5. `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/use-close-holding.ts`
6. `apps/web/src/app/(cap)/dashboard/portefeuille/_components/class-row.tsx`
7. `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-row.tsx`
8. `apps/web/src/app/(cap)/dashboard/portefeuille/_components/portfolio-section.tsx`
9. `apps/web/src/app/(cap)/dashboard/portefeuille/_components/portfolio-section.a11y.test.tsx`
10. `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-create-form.tsx`
11. `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-create-form.a11y.test.tsx`
12. `apps/web/src/app/(cap)/dashboard/portefeuille/_components/lot-form.tsx`
13. `apps/web/src/app/(cap)/dashboard/portefeuille/_components/lot-form.a11y.test.tsx`
14. `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-close-confirm.tsx`
15. `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-close-confirm.a11y.test.tsx`
16. `apps/web/src/app/(cap)/dashboard/portefeuille/page.tsx`

### Moved (3 files — content unchanged, only path + 26 importer references)

17. `apps/web/src/lib/actions/accounts-actions.ts` → `apps/web/src/app/(cap)/dashboard/parametres/_actions/accounts-actions.ts` (12 importers patched)
18. `apps/web/src/lib/actions/compass-actions.ts` → `apps/web/src/app/(cap)/dashboard/_actions/compass-actions.ts` (5 importers patched, 2 depths)
19. `apps/web/src/lib/actions/milestones-actions.ts` → `apps/web/src/app/(cap)/dashboard/_actions/milestones-actions.ts` (9 importers patched)

### Modified (2 files)

20. `apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx` — add `portfolio` branch in `handleNav`.
21. `apps/web/src/lib/types.ts` — strip 7 holding-related declarations (~50 LOC removed).

### Deleted (17 files + 1 directory)

22. `apps/web/src/lib/actions/portfolio.ts`
23. `apps/web/src/lib/actions/holding-lots.ts`
24. `apps/web/src/lib/actions/monthly.ts`
25. `apps/web/src/lib/actions/transactions.ts`
26. `apps/web/src/lib/actions/hypotheses.ts`
27. `apps/web/src/lib/data/portfolio.ts`
28. `apps/web/src/lib/data/holding-lots.ts`
29. `apps/web/src/lib/derive-portfolio.ts`
30. `apps/web/src/lib/derive-portfolio-fx.ts`
31. `apps/web/src/lib/derive-lots.ts`
32. `apps/web/src/lib/services/prices.ts`
33. `apps/web/src/lib/services/yahoo-finance.ts`
34. `apps/web/src/lib/services/boursorama.ts`
35. `apps/web/src/lib/services/twelve-data.ts`
36. `apps/web/src/lib/services/fx.ts`
37. `apps/web/src/lib/schemas/portfolio.ts`
38. `apps/web/src/lib/schemas/holding-lots.ts`
39. `apps/web/src/lib/actions/` (now-empty directory removed)

## Dev Agent Record

- **Model:** claude-opus-4-7 (Opus 4.7, 1M context)
- **Started:** 2026-05-19T10:00:00Z
- **Completed:** 2026-05-19T17:11:00Z

### Summary

Implemented the `/dashboard/portefeuille` screen end-to-end (hero + répartition + 6 holdings + 3 CRUD dialogs), retired the brownfield `lib/actions/` directory entirely (17 files deleted, 3 SA files co-located under their owning routes — 26 importers patched), and rewired the nav rail Portefeuille → `/dashboard/portefeuille`. The four new components (`portfolio-section`, `holding-create-form`, `lot-form`, `holding-close-confirm`) ship with axe-zero-violation a11y suites. AC-6/7/10 sealed by grep + `find` invariants in T16. Post-feedback polish pass tightened the modal-submit CTA (44 px touch-target, centered label, hover/focus/active states via local CSS module) using guidance from the `ui-ux-pro-max` and `web-design-guidelines` skills.

### Files changed

- `apps/web/src/app/(cap)/dashboard/portefeuille/_actions/holdings-actions.ts` (NEW)
- `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/use-holdings.ts` (NEW)
- `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/use-create-holding.ts` (NEW)
- `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/use-record-lot.ts` (NEW)
- `apps/web/src/app/(cap)/dashboard/portefeuille/_hooks/use-close-holding.ts` (NEW)
- `apps/web/src/app/(cap)/dashboard/portefeuille/_components/class-row.tsx` (NEW)
- `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-row.tsx` (NEW)
- `apps/web/src/app/(cap)/dashboard/portefeuille/_components/portfolio-section.tsx` (NEW)
- `apps/web/src/app/(cap)/dashboard/portefeuille/_components/portfolio-section.a11y.test.tsx` (NEW)
- `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-create-form.tsx` (NEW)
- `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-create-form.a11y.test.tsx` (NEW)
- `apps/web/src/app/(cap)/dashboard/portefeuille/_components/lot-form.tsx` (NEW)
- `apps/web/src/app/(cap)/dashboard/portefeuille/_components/lot-form.a11y.test.tsx` (NEW)
- `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-close-confirm.tsx` (NEW)
- `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-close-confirm.a11y.test.tsx` (NEW)
- `apps/web/src/app/(cap)/dashboard/portefeuille/_components/submit-pill.module.css` (NEW — post-feedback polish for CTA pseudo-classes)
- `apps/web/src/app/(cap)/dashboard/portefeuille/page.tsx` (NEW)
- `apps/web/src/app/(cap)/dashboard/parametres/_actions/accounts-actions.ts` (MOVED from `lib/actions/`)
- `apps/web/src/app/(cap)/dashboard/_actions/compass-actions.ts` (MOVED from `lib/actions/`)
- `apps/web/src/app/(cap)/dashboard/_actions/milestones-actions.ts` (MOVED from `lib/actions/`)
- `apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx` (MODIFIED — `handleNav` portfolio branch + route-aware navActiveKey + hide top-tabs off-root)
- `apps/web/src/app/(cap)/_components/form-primitives.tsx` (MODIFIED — submit padding 16→24, height 40→44, marginTop 8 — applies to all forms)
- `apps/web/src/lib/types.ts` (MODIFIED — 7 holding-related declarations removed)
- `apps/web/src/lib/actions/{portfolio,holding-lots,monthly,transactions,hypotheses}.ts` (DELETED)
- `apps/web/src/lib/data/{portfolio,holding-lots}.ts` (DELETED)
- `apps/web/src/lib/{derive-portfolio,derive-portfolio-fx,derive-lots}.ts` (DELETED)
- `apps/web/src/lib/services/{prices,yahoo-finance,boursorama,twelve-data,fx}.ts` (DELETED)
- `apps/web/src/lib/schemas/{portfolio,holding-lots}.ts` (DELETED)
- 26 importer files patched across `parametres/_hooks`, `parametres/_components`, `dashboard/_hooks`, `dashboard/_components` (T11/T12/T13 sed-driven path rewrites)
- `apps/api/scripts/seed-portfolio-demo.ts` (NEW — dev-only helper, idempotent on `(user_id, label)`, seeds 2 accounts + 6 holdings for the first auth.users row)

### Deviations

- **`bun --filter=@pekulo/web` ≠ realité** — the `apps/web` workspace name is `"web"` not `"@pekulo/web"`. Every command in the story spec assumed the namespaced form; this dev session used `bun --filter=web` for apps/web and `bun --filter='@pekulo/api'` / `bun --filter='@pekulo/*'` for the rest. Lessons file (2026-05-19) already calls out the inverse pitfall; the namespace migration of `apps/web` is a separate concern.
- **`bun --filter=<pkg> test <pattern>`** invokes Bun's native test runner, not the per-package `test` script. Correct invocation is `bun --filter=<pkg> run test <pattern>`. Story spec wrote `test` without `run`. (Confirms lesson "`bun test` ≠ `vitest run`".)
- **`PekuloPopover.Trigger asChild` does not exist** — the primitive already wraps its children in a `<button>` internally (see `packages/ui/src/primitives/PekuloPopover.tsx:10-33`). The story spec called `<PekuloPopover.Trigger asChild><button …>` which TypeScript rejects (`Property 'asChild' does not exist on type ButtonHTMLAttributes<HTMLButtonElement>`). Resolved by passing `aria-label` + `style` directly to `PekuloPopover.Trigger` (precedent: `parametres/_components/accounts-section.tsx:229`).
- **`pekuloRadius` import in `lot-form.tsx`** flagged unused by oxlint — story spec imported it but never used it (the radius is consumed inside `form-primitives`, not at the call-site). Removed.
- **No per-workspace `lint` script** — story spec wrote `bun --filter=@pekulo/web run lint`; the lint script lives only at the monorepo root (`npm run lint` invokes oxlint across all 443 files). Used the root command.
- **T15 visual verification via `mcp__react-grab-mcp__*`** deferred — the MCP server was listed as "still connecting" at session start and never came online. Surfaced via HTTP probe of `/dashboard/portefeuille` (307 → /login on unauth, expected) and via browser feedback from Alex (post-merge polish pass). `aped-review` should pick up the visual audit.
- **`apps/api` port moved 3001 → 3005** (set in `.env.local` only — gitignored). Local 3001 was squatted by another Bun dev server outside the Pekulo repo; `apps/api`'s `env.PORT` default of 3001 reads from env, so adding `PORT=3005` + `API_BASE_URL=http://127.0.0.1:3005` to `.env.local` rerouted both sides without code changes.
- **Post-feedback polish (6 commits after T16 AC-sealing)** : `125b4e8` scrollable dialog forms (8-field form was overflowing), `421d7ab` cap-shell route-aware nav + hide top-tabs off-root, `1bee1eb` sticky submit footer outside scroll area, `dd3d5f0` form-primitives padding bump, `dbca221` submit pill 44px + centered + hover/focus/active states via `submit-pill.module.css`. Driven by Alex's review feedback + `ui-ux-pro-max` + `web-design-guidelines` skill guidance. None of these touch ACs; they polish UX gaps the story spec did not enumerate.
- **`cap-shell.tsx` nav rail "Cap" no-op fix** is pre-existing scope creep (the bug was latent since 1-4 — clicking "Cap" did nothing). Surfaced because 3-4 added the first cross-route navigation source. Fix: `handleNav("cap")` now `router.push("/dashboard")` ; top-tabs Cap/Patrimoine hidden via `usePathname()` on sub-routes; `navActiveKey` derived from pathname.
- **Test framework filter pattern** : `bun --filter=web run test <name>` works as a vitest pattern filter (matches `<name>.test.tsx`), not as a workspace re-filter. Confirms vitest's CLI is forwarded verbatim post-runner-resolution.

### Test output

Final web test suite (fresh, captured at 17:11:06 in this session):

```
 RUN  v2.1.9 /Users/fredericyaba/Documents/test/apps/web

 ✓ src/app/(cap)/dashboard/portefeuille/_components/portfolio-section.a11y.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/portefeuille/_components/holding-create-form.a11y.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/portefeuille/_components/lot-form.a11y.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/portefeuille/_components/holding-close-confirm.a11y.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/parametres/_components/accounts-section.a11y.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/parametres/_components/account-create-form.a11y.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/parametres/_components/account-delete-confirm.a11y.test.tsx (2 tests)
 ✓ src/app/(cap)/dashboard/parametres/_hooks/use-update-account.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/parametres/_hooks/use-create-account.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/parametres/_hooks/use-delete-account.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/parametres/_hooks/use-record-balance-change.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/parametres/_hooks/use-update-compass.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/_components/add-milestone-form.a11y.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/_components/add-milestone-form.spy.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/_components/compass-section.a11y.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/_components/compass-setup-cta.a11y.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/_components/milestones-section.a11y.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/_hooks/use-add-milestone-form.test.tsx (2 tests)
 ✓ src/app/(cap)/dashboard/_hooks/use-delete-milestone.test.tsx (2 tests)
 ✓ src/app/(cap)/dashboard/_hooks/use-update-milestone.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/parametres/_components/compass-edit-form.a11y.test.tsx (1 test)
 ✓ src/app/(cap)/dashboard/parametres/_components/compass-history-panel.a11y.test.tsx (1 test)
 ✓ (2 additional test files in suite)

 Test Files  24 passed (24)
      Tests  41 passed (41)
  Duration   5.88s
```

API tests (re-run at T16): `329 pass, 0 fail` across 41 files.

AC-sealing greps (T16):
- AC-6 PASS — `rg --no-heading -n 'from\("holdings"\)|from\("holding_lots"\)' apps/web/src` produces no matches
- AC-6 legacy PASS — `rg --no-heading -n 'from\("accounts"\)' apps/web/src` produces no matches
- AC-7 PASS — `ls apps/web/src/lib/actions` returns "No such file or directory"
- AC-10 PASS — `find apps/web/src/app/(cap)/dashboard/portefeuille -name "*.types.ts"` returns empty

T15 visual verification deferred to `aped-review` (react-grab MCP server never connected this session); Alex did a manual browser pass and reported 3 UX issues that were addressed in the post-feedback polish commits (form overflow, cap-shell nav, submit CTA proportions).

## Review Record

(filled by aped-review)

### Findings

(filled by aped-review)

### Verification

(filled by aped-review)
