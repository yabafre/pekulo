# Story: 2-3-accounts-ui — Accounts UI + Patrimoine tab assembly

**Epic:** Epic 2 — Accounts (extended brownfield)
**Status:** review
**Ticket:** [#19](https://github.com/yabafre/pekulo/issues/19)
**Branch:** `feature/19-2-3-accounts-ui`
**Commit prefix:** `feat(#19): …`
**Depends on:** 2-1-accounts-orpc-port (done), 2-2-account-balance-history (done), 0-10-pekulo-ui-migration (done)
**Complexity:** M

## User Story

**As a** Pekulo user, **I want** the accounts section in `parametres` and the Patrimoine tab on the dashboard, **so that** I can manage my accounts from settings (create / edit / delete / record balance changes — FR-9, FR-10, FR-11) and see them aggregated under the Patrimoine tab (FR-12, partial FR-43 — liquide only until stories 3-x / 4-x land holdings + real-estate).

## Acceptance Criteria

- **AC-1 (create → list + Patrimoine refresh):** **Given** I open `/dashboard/parametres` and the accounts section renders, **When** I submit `account-create-form` with `{ label: "Livret A", type: "livret", currency: "EUR", cashBalance: 5_000 }`, **Then** the new row appears in `accounts-section.tsx` AND navigating to `/dashboard?tab=patrimoine` shows the new row inside `PekuloAccountsSection` (both surfaces consume `accountsKeys.list()`; the mutation invalidates that key, so both refetch on next subscription tick).
- **AC-2 (FK-guarded delete surfaces the error):** **Given** an account referenced by ≥ 1 holding (existing FK from `holdings.account_id`), **When** I confirm deletion in `account-delete-confirm.tsx`, **Then** the server action returns `{ ok: false, code: "ACCOUNT_REFERENCED_FK", message: <api> }` (NOT throws — see T2) AND the dialog renders the localised message _"Ce compte est référencé par des positions — supprimez-les d'abord."_ inside a `role="alert"` Text node. The account row stays in the list (no optimistic remove on `ok: false`).
- **AC-3 (edit → optimistic-free invalidate):** **Given** the list shows an account, **When** I save changes in `account-edit-form.tsx` (`updateAccount({ id, label: "Nouveau" })`), **Then** the response Account is returned, `accountsKeys.list()` is invalidated, the list refetches, and the row reflects `label: "Nouveau"`.
- **AC-4 (record balance change):** **Given** an account with `cashBalance: 1_000`, **When** I submit `account-balance-form` with `{ valuedOn: <date>, cashBalance: 1_500 }` (calls `recordBalanceChange`), **Then** the response Account has `cashBalance: 1_500`, `accountsKeys.list()` is invalidated, and the row updates to show `1 500 €`. The audit row in `account_balance_log` is the API's responsibility (story 2-2) — this story only verifies the UI invalidation.
- **AC-5 (tab routing via `?tab=patrimoine`):** **Given** I'm on `/dashboard` (default = Cap view), **When** I click the "Patrimoine" top-tab button in `cap-shell.tsx`, **Then** `router.push("/dashboard?tab=patrimoine")` fires AND `dashboard/page.tsx` renders `<PatrimoineView />` instead of `<CapView />`. The `aria-pressed` / `aria-current` attributes flip accordingly. Clicking "Cap" navigates back to `/dashboard` (no `tab` param). Per UX `screen-inventory.md:17`.
- **AC-6 (zero direct Supabase reads of `accounts` from apps/web — NFR-28):** **Given** the story is shipped, **When** `rg --no-heading -n "from\(\"accounts\"\)" apps/web/src` runs, **Then** no match is reported. Specifically, the brownfield `accountRow`, `getAccounts`, `saveAccount`, `deleteAccount` are removed from `apps/web/src/lib/actions/portfolio.ts` (holdings remain — they belong to story 3-1). All reads/writes of `accounts` go through `accountsClient.*` via `accounts-actions.ts`.
- **AC-7 (lint discipline — story 0-12 rules):** **Given** the story diff lands, **When** `bun --filter=web run lint` runs, **Then** lint exits `0`. Specifically:
  - `pekulo/no-server-action-in-component` — components NEVER import from `accounts-actions.ts` directly; they call through hooks (`use-*`).
  - `pekulo/no-cross-feature-action-import` — `accounts-actions.ts` MUST NOT import from `compass-actions.ts`, `milestones-actions.ts`, `holding-lots.ts`, `hypotheses.ts`, `monthly.ts`, `portfolio.ts`, `transactions.ts`.
  - `pekulo/no-tailwind-outside-ui` — apps/web styling stays Tamagui-only (`form-primitives` already enforce this).
- **AC-8 (no `*.types.ts` inside the parametres / dashboard route — L1 invariant):** **Given** the story is shipped, **When** `find apps/web/src/app -name "*.types.ts"` runs, **Then** no match is reported. The `DeleteAccountResult` discriminated union (used as the SA's return envelope) lives **inside** `accounts-actions.ts` as a co-located exported type. Domain entities are inferred from `@pekulo/validators` (`Account`, `CreateAccountInput`, `UpdateAccountInput`, `DeleteAccountInput`, `RecordBalanceChangeInput`).
- **AC-9 (Tamagui + CSS module breakpoint discipline — lesson 2026-05-13):** **Given** the new `patrimoine-view.tsx` ships, **When** I grep it for `$gtMd`, `$gtSm`, `$lg`, `$md`, `$xs` responsive prop syntax AND any CSS-module `@media (min-width: 1020px)` / Tailwind-aligned breakpoint, **Then** at most ONE of the two layers is present in the file. Choice for this story: **Tamagui-only** (flat single-column view, no bento). The dashboard root `cap-shell.tsx` already mixes both — that pre-existing surface stays untouched.
- **AC-10 (a11y — axe-core zero violations on the 5 new components):** **Given** I run `bun --filter=web run test`, **When** the a11y test suite executes, **Then** axe-core reports zero violations on `accounts-section.tsx`, `account-create-form.tsx`, `account-delete-confirm.tsx`. (`account-edit-form` and `account-balance-form` reuse the create-form `form-primitives` shape — covered transitively, no separate axe test needed.)

## Tasks

- [x] **T1 — Add `accountsKeys` / `accountsTags` + registry mapping.** Edit `apps/web/src/lib/zapaction/keys.ts`. Append the two factory calls below at the bottom of the existing `createFeatureKeys` / `createFeatureTags` chain (alphabetical-ish — after `portfolioKeys` is fine since `accounts` extracts the accounts surface out of the legacy `portfolio` umbrella; the file already has both blocks declared per-feature). Then extend the `setTagRegistry({ ... })` payload so the `[accountsTags.list()]` key maps to `[accountsKeys.list()]`. Also append `accountsKeys.list()` to `portfolioTags.accounts()` mapping (transitional — `portfolioTags` will be retired once all features port, but for this story the accounts removal from `portfolio.ts` means `portfolioTags.accounts()` won't be emitted anywhere; the mapping is left in place to avoid a separate cleanup task and is a no-op).

  Full additions, ABOVE the closing `});` of `setTagRegistry`:

  ```ts
  export const accountsKeys = createFeatureKeys("accounts", {
    list: () => ["list"] as const,
  });
  export const accountsTags = createFeatureTags("accounts", {
    list: () => ["list"] as const,
  });
  ```

  Inside `setTagRegistry({ ... })` (add these two lines next to the `[milestonesTags.list()]` entry — same shape):

  ```ts
  [accountsTags.all()]: [accountsKeys.list()],
  [accountsTags.list()]: [accountsKeys.list()],
  ```

  Run: `bun --filter=web run typecheck`. Expected: exit 0 (no output on success).
  Commit: `git add apps/web/src/lib/zapaction/keys.ts && git commit -m "feat(#19): T1 — accountsKeys + accountsTags + registry mapping"`. [AC: AC-1, AC-3, AC-4]

- [x] **T2 — Create the accounts server-action file with the FK-error envelope pattern.** Write `apps/web/src/lib/actions/accounts-actions.ts` with the full content below. Five delegators (`listAccounts`, `createAccount`, `updateAccount`, `deleteAccount`, `recordBalanceChange`). The delete SA wraps the oRPC client call in try/catch on `ORPCError` and returns a discriminated union envelope so the typed `code` survives the Next.js Server Action boundary (Next sanitises thrown Error `message` in production; returned values are JSON-serialised and survive intact). Co-located `DeleteAccountResult` type — NO sibling `*.types.ts` file (AC-8 / L1).

  Full file content:

  ```ts
  "use server";

  import { defineAction } from "@zapaction/core";
  import { revalidatePath } from "next/cache";
  import { z } from "zod";
  import { ORPCError } from "@orpc/client";
  import {
    accountSchema,
    createAccountInputSchema,
    deleteAccountInputSchema,
    listAccountsOutputSchema,
    recordBalanceChangeInputSchema,
    updateAccountInputSchema,
    type Account,
    type CreateAccountInput,
    type DeleteAccountInput,
    type RecordBalanceChangeInput,
    type UpdateAccountInput,
  } from "@pekulo/validators";
  import { accountsClient } from "@/lib/orpc/modules";
  import { ensureRequestContext } from "@/lib/orpc/request-context";
  import { accountsTags } from "@/lib/zapaction/keys";
  import type { ActionContext } from "@/lib/zapaction/context";
  import "@/lib/zapaction/context";

  // Story 2-3 — thin oRPC delegators. MUST NOT import from any sibling
  // feature actions file (pekulo/no-cross-feature-action-import).
  // Each handler ensures request context defensively per lesson L25.
  //
  // Error envelope (deleteAccount only): the API throws typed
  // PekuloError("ACCOUNT_REFERENCED_FK") / ("ACCOUNT_NOT_FOUND") which oRPC
  // surfaces as ORPCError on the client. Next.js Server Actions sanitise
  // thrown Error messages in production (digest-only payload), so we
  // CATCH the ORPCError here and RETURN a discriminated-union envelope —
  // returned values are JSON-serialised and survive intact. The UI hook
  // branches on `result.ok` and `result.code`. First precedent in this
  // monorepo for typed-error surfacing through a server action; carries
  // forward to 3-1 (Holdings), 5-1 (Transactions), 7-3 (Hypothesis).

  /** Envelope for deleteAccount — preserves the typed code across the SA boundary. */
  export type DeleteAccountResult =
    | { ok: true }
    | { ok: false; code: "ACCOUNT_REFERENCED_FK" | "ACCOUNT_NOT_FOUND"; message: string };

  export const listAccounts = defineAction<void, Account[], ActionContext>({
    name: "listAccounts",
    input: z.void(),
    output: listAccountsOutputSchema,
    handler: async () => {
      await ensureRequestContext();
      return accountsClient.list();
    },
  });

  export const createAccount = defineAction<CreateAccountInput, Account, ActionContext>({
    name: "createAccount",
    input: createAccountInputSchema,
    output: accountSchema,
    tags: [accountsTags.list()],
    handler: async ({ input }) => {
      await ensureRequestContext();
      const created = await accountsClient.create(input);
      revalidatePath("/dashboard/parametres");
      revalidatePath("/dashboard");
      return created;
    },
  });

  export const updateAccount = defineAction<UpdateAccountInput, Account, ActionContext>({
    name: "updateAccount",
    input: updateAccountInputSchema,
    output: accountSchema,
    tags: [accountsTags.list()],
    handler: async ({ input }) => {
      await ensureRequestContext();
      const updated = await accountsClient.update(input);
      revalidatePath("/dashboard/parametres");
      revalidatePath("/dashboard");
      return updated;
    },
  });

  export const deleteAccount = defineAction<DeleteAccountInput, DeleteAccountResult, ActionContext>({
    name: "deleteAccount",
    input: deleteAccountInputSchema,
    tags: [accountsTags.list()],
    handler: async ({ input }) => {
      await ensureRequestContext();
      try {
        await accountsClient.delete(input);
        revalidatePath("/dashboard/parametres");
        revalidatePath("/dashboard");
        return { ok: true as const };
      } catch (err) {
        if (
          err instanceof ORPCError &&
          (err.code === "ACCOUNT_REFERENCED_FK" || err.code === "ACCOUNT_NOT_FOUND")
        ) {
          return { ok: false as const, code: err.code, message: err.message };
        }
        throw err;
      }
    },
  });

  export const recordBalanceChange = defineAction<
    RecordBalanceChangeInput,
    Account,
    ActionContext
  >({
    name: "recordBalanceChange",
    input: recordBalanceChangeInputSchema,
    output: accountSchema,
    tags: [accountsTags.list()],
    handler: async ({ input }) => {
      await ensureRequestContext();
      const updated = await accountsClient.recordBalanceChange(input);
      revalidatePath("/dashboard/parametres");
      revalidatePath("/dashboard");
      return updated;
    },
  });
  ```

  Run: `bun --filter=web run typecheck`. Expected: exit 0.
  Commit: `git add apps/web/src/lib/actions/accounts-actions.ts && git commit -m "feat(#19): T2 — accounts-actions.ts with FK-error envelope"`. [AC: AC-1, AC-2, AC-3, AC-4, AC-8]

- [x] **T3 — `use-accounts.ts` query hook.** Write `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-accounts.ts`:

  ```ts
  "use client";

  import { useQuery } from "@tanstack/react-query";
  import type { Account } from "@pekulo/validators";
  import { accountsKeys } from "@/lib/zapaction/keys";
  import { listAccounts } from "@/lib/actions/accounts-actions";

  export function useAccounts() {
    return useQuery<Account[]>({
      queryKey: accountsKeys.list(),
      queryFn: () => listAccounts(),
      staleTime: 30_000,
    });
  }
  ```

  Run: `bun --filter=web run typecheck`. Expected: exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/parametres/_hooks/use-accounts.ts && git commit -m "feat(#19): T3 — useAccounts query hook"`. [AC: AC-1, AC-5]

- [x] **T4 — `use-create-account.ts` + spy test.** Write hook + sibling test.

  `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-create-account.ts`:

  ```ts
  "use client";

  import { useMutation, useQueryClient } from "@tanstack/react-query";
  import type { Account, CreateAccountInput } from "@pekulo/validators";
  import { accountsKeys } from "@/lib/zapaction/keys";
  import { createAccount } from "@/lib/actions/accounts-actions";

  export function useCreateAccount() {
    const queryClient = useQueryClient();
    return useMutation<Account, Error, CreateAccountInput>({
      mutationFn: (input) => createAccount(input),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: accountsKeys.list() });
      },
    });
  }
  ```

  `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-create-account.test.tsx`:

  ```tsx
  import { describe, expect, test, vi } from "vitest";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { renderHook, waitFor } from "@testing-library/react";
  import type { ReactNode } from "react";
  import { accountsKeys } from "@/lib/zapaction/keys";

  vi.mock("@/lib/actions/accounts-actions", () => ({
    createAccount: vi.fn(
      async (input: { label: string; type: string; currency: string; cashBalance: number }) => ({
        id: "acc_aaaaaaaaaaaaaaaaaaaaa",
        userId: "00000000-0000-0000-0000-000000000001",
        label: input.label,
        type: input.type,
        currency: input.currency,
        cashBalance: input.cashBalance,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ),
  }));

  import { useCreateAccount } from "./use-create-account";

  describe("useCreateAccount (AC-1)", () => {
    test("on success → invalidates accountsKeys.list()", async () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateSpy = vi.spyOn(client, "invalidateQueries");
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const { result } = renderHook(() => useCreateAccount(), { wrapper });
      result.current.mutate({
        label: "Livret A",
        type: "livret",
        currency: "EUR",
        cashBalance: 5_000,
      });
      await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: accountsKeys.list() });
    });
  });
  ```

  Run: `bun --filter=web run test -- use-create-account`. Expected: `Tests  1 passed`, exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/parametres/_hooks/use-create-account.ts apps/web/src/app/\(cap\)/dashboard/parametres/_hooks/use-create-account.test.tsx && git commit -m "feat(#19): T4 — useCreateAccount + invalidation test"`. [AC: AC-1]

- [x] **T5 — `use-update-account.ts`.** Write `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-update-account.ts`:

  ```ts
  "use client";

  import { useMutation, useQueryClient } from "@tanstack/react-query";
  import type { Account, UpdateAccountInput } from "@pekulo/validators";
  import { accountsKeys } from "@/lib/zapaction/keys";
  import { updateAccount } from "@/lib/actions/accounts-actions";

  export function useUpdateAccount() {
    const queryClient = useQueryClient();
    return useMutation<Account, Error, UpdateAccountInput>({
      mutationFn: (input) => updateAccount(input),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: accountsKeys.list() });
      },
    });
  }
  ```

  Run: `bun --filter=web run typecheck`. Expected: exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/parametres/_hooks/use-update-account.ts && git commit -m "feat(#19): T5 — useUpdateAccount mutation hook"`. [AC: AC-3]

- [x] **T6 — `use-delete-account.ts` + spy test (optimistic remove + envelope branch).** The hook mirrors `use-delete-milestone.ts` (optimistic remove with surgical restore on `error` OR on `{ ok: false }` envelope) — surgical restore is mandatory because two concurrent deletes capture independent `previous` snapshots; a blanket overwrite resurrects the other mutation's row.

  `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-delete-account.ts`:

  ```ts
  "use client";

  import { useMutation, useQueryClient } from "@tanstack/react-query";
  import type { Account, DeleteAccountInput } from "@pekulo/validators";
  import { accountsKeys } from "@/lib/zapaction/keys";
  import { deleteAccount, type DeleteAccountResult } from "@/lib/actions/accounts-actions";

  export function useDeleteAccount() {
    const queryClient = useQueryClient();
    return useMutation<
      DeleteAccountResult,
      Error,
      DeleteAccountInput,
      { previous: Account[] | undefined }
    >({
      mutationFn: (input) => deleteAccount(input),
      onMutate: async (input) => {
        await queryClient.cancelQueries({ queryKey: accountsKeys.list() });
        const previous = queryClient.getQueryData<Account[]>(accountsKeys.list());
        queryClient.setQueryData<Account[]>(
          accountsKeys.list(),
          (old) => old?.filter((acc) => acc.id !== input.id) ?? [],
        );
        return { previous };
      },
      onSuccess: (result, input, ctx) => {
        // Envelope `{ ok: false }` is NOT a thrown error (Next.js SA serialised
        // it as data); restore the row the same way onError would.
        if (!result.ok) {
          const removed = ctx?.previous?.find((acc) => acc.id === input.id);
          if (!removed) return;
          queryClient.setQueryData<Account[]>(accountsKeys.list(), (cur) => {
            if (!cur) return [removed];
            if (cur.some((acc) => acc.id === removed.id)) return cur;
            return [...cur, removed];
          });
        }
      },
      onError: (_err, input, ctx) => {
        // Surgical restore — only re-add the row this mutation removed.
        // Mirrors use-delete-milestone.ts comment: blanket overwrite would
        // resurrect a concurrent delete's row until onSettled invalidate.
        const removed = ctx?.previous?.find((acc) => acc.id === input.id);
        if (!removed) return;
        queryClient.setQueryData<Account[]>(accountsKeys.list(), (cur) => {
          if (!cur) return [removed];
          if (cur.some((acc) => acc.id === removed.id)) return cur;
          return [...cur, removed];
        });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: accountsKeys.list() });
      },
    });
  }
  ```

  `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-delete-account.test.tsx`:

  ```tsx
  import { describe, expect, test, vi } from "vitest";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { renderHook, waitFor } from "@testing-library/react";
  import type { ReactNode } from "react";
  import { accountsKeys } from "@/lib/zapaction/keys";

  const deleteMock = vi.fn();
  vi.mock("@/lib/actions/accounts-actions", () => ({
    deleteAccount: (input: { id: string }) => deleteMock(input),
  }));

  import { useDeleteAccount } from "./use-delete-account";

  function makeAcc(id: string) {
    return {
      id,
      userId: "00000000-0000-0000-0000-000000000001",
      label: `Acc ${id}`,
      type: "livret" as const,
      currency: "EUR" as const,
      cashBalance: 100,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  describe("useDeleteAccount (AC-2)", () => {
    test("ok=true → invalidates accountsKeys.list()", async () => {
      deleteMock.mockReset().mockResolvedValueOnce({ ok: true });
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      client.setQueryData(accountsKeys.list(), [makeAcc("acc_aaaaaaaaaaaaaaaaaaaaa")]);
      const invalidateSpy = vi.spyOn(client, "invalidateQueries");
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const { result } = renderHook(() => useDeleteAccount(), { wrapper });
      result.current.mutate({ id: "acc_aaaaaaaaaaaaaaaaaaaaa" });
      await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: accountsKeys.list() });
    });

    test("ok=false FK → restores the removed row in cache", async () => {
      deleteMock
        .mockReset()
        .mockResolvedValueOnce({ ok: false, code: "ACCOUNT_REFERENCED_FK", message: "fk" });
      const acc = makeAcc("acc_bbbbbbbbbbbbbbbbbbbbb");
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      client.setQueryData(accountsKeys.list(), [acc]);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const { result } = renderHook(() => useDeleteAccount(), { wrapper });
      result.current.mutate({ id: acc.id });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      // After onSuccess restore + onSettled invalidate the cache should still
      // contain the row (or be empty pending the refetch — what matters is the
      // row was re-added before invalidation, so the next refetch can rebuild
      // from server state).
      const data = client.getQueryData<typeof acc[]>(accountsKeys.list());
      expect(data?.some((a) => a.id === acc.id)).toBe(true);
    });
  });
  ```

  Run: `bun --filter=web run test -- use-delete-account`. Expected: `Tests  2 passed`, exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/parametres/_hooks/use-delete-account.ts apps/web/src/app/\(cap\)/dashboard/parametres/_hooks/use-delete-account.test.tsx && git commit -m "feat(#19): T6 — useDeleteAccount with envelope-aware restore"`. [AC: AC-2]

- [x] **T7 — `use-record-balance-change.ts`.** Write `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-record-balance-change.ts`:

  ```ts
  "use client";

  import { useMutation, useQueryClient } from "@tanstack/react-query";
  import type { Account, RecordBalanceChangeInput } from "@pekulo/validators";
  import { accountsKeys } from "@/lib/zapaction/keys";
  import { recordBalanceChange } from "@/lib/actions/accounts-actions";

  export function useRecordBalanceChange() {
    const queryClient = useQueryClient();
    return useMutation<Account, Error, RecordBalanceChangeInput>({
      mutationFn: (input) => recordBalanceChange(input),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: accountsKeys.list() });
      },
    });
  }
  ```

  Run: `bun --filter=web run typecheck`. Expected: exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/parametres/_hooks/use-record-balance-change.ts && git commit -m "feat(#19): T7 — useRecordBalanceChange mutation hook"`. [AC: AC-4]

- [x] **T8 — `account-create-form.tsx` + a11y test.** Form uses `form-primitives` (shared `<FormField>`, `formInputStyle`, `formSubmitStyle`). Native `<select>` for `type` and `currency` (Tamagui `PekuloSelect` exists but adds focus-management complexity beyond the needs of a settings form — native select is screen-reader-friendly and matches the existing settings forms).

  `apps/web/src/app/(cap)/dashboard/parametres/_components/account-create-form.tsx`:

  ```tsx
  "use client";

  import { useState, type CSSProperties } from "react";
  import { Text, View } from "@pekulo/ui/client";
  import {
    ACCOUNT_CURRENCIES,
    MAX_ACCOUNT_LABEL_LENGTH,
    MAX_ACCOUNT_NOTES_LENGTH,
  } from "@pekulo/validators";
  import { ACCOUNT_TYPES, type AccountType } from "@pekulo/types";
  import { useCreateAccount } from "../_hooks/use-create-account";
  import {
    FormField as Field,
    formInputStyle as inputStyle,
    formSubmitStyle as submitStyle,
  } from "../../../_components/form-primitives";

  const TYPE_LABEL: Record<AccountType, string> = {
    livret: "Livret",
    pea: "PEA",
    cto: "CTO",
    av: "Assurance vie",
    autre: "Autre",
  };

  // Native <select> shares the same token-backed styling as <input> for
  // consistency with the rest of the parametres surface. Inline rather
  // than added to form-primitives because no other form needs select yet.
  const selectStyle: CSSProperties = {
    ...inputStyle,
    appearance: "none",
  };

  export interface AccountCreateFormProps {
    onSuccess?: () => void;
  }

  export function AccountCreateForm({ onSuccess }: AccountCreateFormProps) {
    const [label, setLabel] = useState("");
    const [type, setType] = useState<AccountType>("livret");
    const [currency, setCurrency] = useState<(typeof ACCOUNT_CURRENCIES)[number]>("EUR");
    const [cashBalance, setCashBalance] = useState("0");
    const [notes, setNotes] = useState("");
    const [clientError, setClientError] = useState<string | null>(null);
    const { mutate, isPending, error, isSuccess, reset } = useCreateAccount();

    const onSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setClientError(null);
      const trimmed = label.trim();
      if (trimmed.length === 0) {
        setClientError("Libellé requis");
        return;
      }
      if (trimmed.length > MAX_ACCOUNT_LABEL_LENGTH) {
        setClientError(`Libellé > ${MAX_ACCOUNT_LABEL_LENGTH} caractères`);
        return;
      }
      const balance = Number(cashBalance);
      if (!Number.isFinite(balance) || balance < 0) {
        setClientError("Solde invalide (>= 0)");
        return;
      }
      const trimmedNotes = notes.trim();
      if (trimmedNotes.length > MAX_ACCOUNT_NOTES_LENGTH) {
        setClientError(`Notes > ${MAX_ACCOUNT_NOTES_LENGTH} caractères`);
        return;
      }
      mutate(
        {
          label: trimmed,
          type,
          currency,
          cashBalance: balance,
          notes: trimmedNotes.length > 0 ? trimmedNotes : null,
        },
        {
          onSuccess: () => {
            setLabel("");
            setType("livret");
            setCurrency("EUR");
            setCashBalance("0");
            setNotes("");
            reset();
            onSuccess?.();
          },
        },
      );
    };

    return (
      <form onSubmit={onSubmit} aria-label="Ajouter un compte">
        <View flexDirection="column" gap="$3" padding="$4">
          <Field>
            <Text render="label" htmlFor="acc-label" color="$colorSecondary" fontSize="$caption">
              Libellé
            </Text>
            <input
              id="acc-label"
              type="text"
              maxLength={MAX_ACCOUNT_LABEL_LENGTH}
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
              required
              style={inputStyle}
            />
          </Field>
          <Field>
            <Text render="label" htmlFor="acc-type" color="$colorSecondary" fontSize="$caption">
              Type
            </Text>
            <select
              id="acc-type"
              value={type}
              onChange={(e) => setType(e.currentTarget.value as AccountType)}
              style={selectStyle}
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <Text render="label" htmlFor="acc-currency" color="$colorSecondary" fontSize="$caption">
              Devise
            </Text>
            <select
              id="acc-currency"
              value={currency}
              onChange={(e) =>
                setCurrency(e.currentTarget.value as (typeof ACCOUNT_CURRENCIES)[number])
              }
              style={selectStyle}
            >
              {ACCOUNT_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <Text render="label" htmlFor="acc-balance" color="$colorSecondary" fontSize="$caption">
              Solde initial
            </Text>
            <input
              id="acc-balance"
              type="number"
              min={0}
              step="0.01"
              value={cashBalance}
              onChange={(e) => setCashBalance(e.currentTarget.value)}
              required
              style={inputStyle}
            />
          </Field>
          <Field>
            <Text render="label" htmlFor="acc-notes" color="$colorSecondary" fontSize="$caption">
              Notes (optionnel)
            </Text>
            <input
              id="acc-notes"
              type="text"
              maxLength={MAX_ACCOUNT_NOTES_LENGTH}
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
          {error && !clientError && (
            <Text role="alert" color="$danger" fontSize="$caption">
              {error.message}
            </Text>
          )}
          {isSuccess && !clientError && !error && (
            <Text role="status" color="$success" fontSize="$caption">
              Compte ajouté.
            </Text>
          )}
          <button
            type="submit"
            disabled={isPending}
            aria-disabled={isPending}
            style={submitStyle(isPending)}
          >
            {isPending ? "Ajout…" : "Ajouter le compte"}
          </button>
        </View>
      </form>
    );
  }
  ```

  `apps/web/src/app/(cap)/dashboard/parametres/_components/account-create-form.a11y.test.tsx`:

  ```tsx
  import { describe, expect, test, vi } from "vitest";
  import { render } from "@testing-library/react";
  import { axe, toHaveNoViolations } from "jest-axe";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { TamaguiProvider } from "@pekulo/ui";
  import { pekuloTamaguiConfig } from "@pekulo/ui";

  expect.extend(toHaveNoViolations);

  vi.mock("@/lib/actions/accounts-actions", () => ({
    createAccount: vi.fn(),
  }));

  import { AccountCreateForm } from "./account-create-form";

  describe("AccountCreateForm a11y", () => {
    test("has no axe violations", async () => {
      const client = new QueryClient();
      const { container } = render(
        <TamaguiProvider config={pekuloTamaguiConfig}>
          <QueryClientProvider client={client}>
            <AccountCreateForm />
          </QueryClientProvider>
        </TamaguiProvider>,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
  ```

  Run: `bun --filter=web run test -- account-create-form`. Expected: `Tests  1 passed`, exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/parametres/_components/account-create-form.tsx apps/web/src/app/\(cap\)/dashboard/parametres/_components/account-create-form.a11y.test.tsx && git commit -m "feat(#19): T8 — AccountCreateForm + a11y test"`. [AC: AC-1, AC-10]

- [x] **T9 — `account-edit-form.tsx`.** Same shape as create-form but prefilled from an `Account` prop and submits to `useUpdateAccount`. Only sends fields that changed (per `updateAccountInputSchema.refine` — at least one of label/type/currency/cashBalance/notes must be provided; the refine fires if all are absent).

  `apps/web/src/app/(cap)/dashboard/parametres/_components/account-edit-form.tsx`:

  ```tsx
  "use client";

  import { useState, type CSSProperties } from "react";
  import { Text, View } from "@pekulo/ui/client";
  import {
    ACCOUNT_CURRENCIES,
    MAX_ACCOUNT_LABEL_LENGTH,
    MAX_ACCOUNT_NOTES_LENGTH,
    type Account,
    type UpdateAccountInput,
  } from "@pekulo/validators";
  import { ACCOUNT_TYPES, type AccountType } from "@pekulo/types";
  import { useUpdateAccount } from "../_hooks/use-update-account";
  import {
    FormField as Field,
    formInputStyle as inputStyle,
    formSubmitStyle as submitStyle,
  } from "../../../_components/form-primitives";

  const TYPE_LABEL: Record<AccountType, string> = {
    livret: "Livret",
    pea: "PEA",
    cto: "CTO",
    av: "Assurance vie",
    autre: "Autre",
  };

  const selectStyle: CSSProperties = { ...inputStyle, appearance: "none" };

  export interface AccountEditFormProps {
    account: Account;
    onSuccess?: () => void;
  }

  export function AccountEditForm({ account, onSuccess }: AccountEditFormProps) {
    const [label, setLabel] = useState(account.label);
    const [type, setType] = useState<AccountType>(account.type);
    const [currency, setCurrency] = useState<(typeof ACCOUNT_CURRENCIES)[number]>(account.currency);
    const [cashBalance, setCashBalance] = useState(String(account.cashBalance));
    const [notes, setNotes] = useState(account.notes ?? "");
    const [clientError, setClientError] = useState<string | null>(null);
    const { mutate, isPending, error, isSuccess, reset } = useUpdateAccount();

    const onSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setClientError(null);
      const trimmed = label.trim();
      if (trimmed.length === 0) {
        setClientError("Libellé requis");
        return;
      }
      const balance = Number(cashBalance);
      if (!Number.isFinite(balance) || balance < 0) {
        setClientError("Solde invalide (>= 0)");
        return;
      }
      // Build a diff payload — only include keys that actually changed,
      // and ALWAYS include `id`. The Zod refine on updateAccountInputSchema
      // demands at least one of label/type/currency/cashBalance/notes.
      const patch: UpdateAccountInput = { id: account.id } as UpdateAccountInput;
      if (trimmed !== account.label) patch.label = trimmed;
      if (type !== account.type) patch.type = type;
      if (currency !== account.currency) patch.currency = currency;
      if (balance !== account.cashBalance) patch.cashBalance = balance;
      const trimmedNotes = notes.trim();
      const nextNotes = trimmedNotes.length > 0 ? trimmedNotes : null;
      if (nextNotes !== account.notes) patch.notes = nextNotes;

      // Nothing changed — no-op without surfacing the Zod refine error.
      const hasChange =
        patch.label !== undefined ||
        patch.type !== undefined ||
        patch.currency !== undefined ||
        patch.cashBalance !== undefined ||
        patch.notes !== undefined;
      if (!hasChange) {
        onSuccess?.();
        return;
      }

      mutate(patch, {
        onSuccess: () => {
          reset();
          onSuccess?.();
        },
      });
    };

    return (
      <form onSubmit={onSubmit} aria-label="Modifier le compte">
        <View flexDirection="column" gap="$3" padding="$4">
          <Field>
            <Text render="label" htmlFor="acc-edit-label" color="$colorSecondary" fontSize="$caption">
              Libellé
            </Text>
            <input
              id="acc-edit-label"
              type="text"
              maxLength={MAX_ACCOUNT_LABEL_LENGTH}
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
              required
              style={inputStyle}
            />
          </Field>
          <Field>
            <Text render="label" htmlFor="acc-edit-type" color="$colorSecondary" fontSize="$caption">
              Type
            </Text>
            <select
              id="acc-edit-type"
              value={type}
              onChange={(e) => setType(e.currentTarget.value as AccountType)}
              style={selectStyle}
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <Text
              render="label"
              htmlFor="acc-edit-currency"
              color="$colorSecondary"
              fontSize="$caption"
            >
              Devise
            </Text>
            <select
              id="acc-edit-currency"
              value={currency}
              onChange={(e) =>
                setCurrency(e.currentTarget.value as (typeof ACCOUNT_CURRENCIES)[number])
              }
              style={selectStyle}
            >
              {ACCOUNT_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <Text
              render="label"
              htmlFor="acc-edit-balance"
              color="$colorSecondary"
              fontSize="$caption"
            >
              Solde
            </Text>
            <input
              id="acc-edit-balance"
              type="number"
              min={0}
              step="0.01"
              value={cashBalance}
              onChange={(e) => setCashBalance(e.currentTarget.value)}
              required
              style={inputStyle}
            />
          </Field>
          <Field>
            <Text render="label" htmlFor="acc-edit-notes" color="$colorSecondary" fontSize="$caption">
              Notes
            </Text>
            <input
              id="acc-edit-notes"
              type="text"
              maxLength={MAX_ACCOUNT_NOTES_LENGTH}
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
          {error && !clientError && (
            <Text role="alert" color="$danger" fontSize="$caption">
              {error.message}
            </Text>
          )}
          {isSuccess && !clientError && !error && (
            <Text role="status" color="$success" fontSize="$caption">
              Compte mis à jour.
            </Text>
          )}
          <button
            type="submit"
            disabled={isPending}
            aria-disabled={isPending}
            style={submitStyle(isPending)}
          >
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </View>
      </form>
    );
  }
  ```

  Run: `bun --filter=web run typecheck`. Expected: exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/parametres/_components/account-edit-form.tsx && git commit -m "feat(#19): T9 — AccountEditForm with diff payload"`. [AC: AC-3]

- [x] **T10 — `account-balance-form.tsx`.** Single-purpose form: `valuedOn` (date input — ISO date string converted to a Date) + `cashBalance` (number). Calls `useRecordBalanceChange`.

  `apps/web/src/app/(cap)/dashboard/parametres/_components/account-balance-form.tsx`:

  ```tsx
  "use client";

  import { useState } from "react";
  import { Text, View } from "@pekulo/ui/client";
  import type { Account } from "@pekulo/validators";
  import { useRecordBalanceChange } from "../_hooks/use-record-balance-change";
  import {
    FormField as Field,
    formInputStyle as inputStyle,
    formSubmitStyle as submitStyle,
  } from "../../../_components/form-primitives";

  function isoToday(): string {
    const d = new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  export interface AccountBalanceFormProps {
    account: Account;
    onSuccess?: () => void;
  }

  export function AccountBalanceForm({ account, onSuccess }: AccountBalanceFormProps) {
    const [valuedOn, setValuedOn] = useState(isoToday());
    const [cashBalance, setCashBalance] = useState(String(account.cashBalance));
    const [clientError, setClientError] = useState<string | null>(null);
    const { mutate, isPending, error, isSuccess, reset } = useRecordBalanceChange();

    const onSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setClientError(null);
      if (!valuedOn || valuedOn.length === 0) {
        setClientError("Date requise");
        return;
      }
      const balance = Number(cashBalance);
      if (!Number.isFinite(balance) || balance < 0) {
        setClientError("Solde invalide (>= 0)");
        return;
      }
      // Treat the date input as UTC midnight; matches the API's z.coerce.date
      // behavior on an ISO date string.
      const valued = new Date(`${valuedOn}T00:00:00.000Z`);
      if (Number.isNaN(valued.getTime())) {
        setClientError("Date invalide");
        return;
      }
      mutate(
        { id: account.id, valuedOn: valued, cashBalance: balance },
        {
          onSuccess: () => {
            reset();
            onSuccess?.();
          },
        },
      );
    };

    return (
      <form onSubmit={onSubmit} aria-label={`Modifier le solde de ${account.label}`}>
        <View flexDirection="column" gap="$3" padding="$4">
          <Field>
            <Text render="label" htmlFor="acc-bal-date" color="$colorSecondary" fontSize="$caption">
              Date
            </Text>
            <input
              id="acc-bal-date"
              type="date"
              value={valuedOn}
              onChange={(e) => setValuedOn(e.currentTarget.value)}
              required
              style={inputStyle}
            />
          </Field>
          <Field>
            <Text render="label" htmlFor="acc-bal-amount" color="$colorSecondary" fontSize="$caption">
              Nouveau solde
            </Text>
            <input
              id="acc-bal-amount"
              type="number"
              min={0}
              step="0.01"
              value={cashBalance}
              onChange={(e) => setCashBalance(e.currentTarget.value)}
              required
              style={inputStyle}
            />
          </Field>
          {clientError && (
            <Text role="alert" color="$danger" fontSize="$caption">
              {clientError}
            </Text>
          )}
          {error && !clientError && (
            <Text role="alert" color="$danger" fontSize="$caption">
              {error.message}
            </Text>
          )}
          {isSuccess && !clientError && !error && (
            <Text role="status" color="$success" fontSize="$caption">
              Solde enregistré.
            </Text>
          )}
          <button
            type="submit"
            disabled={isPending}
            aria-disabled={isPending}
            style={submitStyle(isPending)}
          >
            {isPending ? "Enregistrement…" : "Enregistrer le solde"}
          </button>
        </View>
      </form>
    );
  }
  ```

  Run: `bun --filter=web run typecheck`. Expected: exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/parametres/_components/account-balance-form.tsx && git commit -m "feat(#19): T10 — AccountBalanceForm (FR-11 UI surface)"`. [AC: AC-4]

- [x] **T11 — `account-delete-confirm.tsx` + a11y test.** PekuloDialog-framed confirmation. Branches on `result.code === "ACCOUNT_REFERENCED_FK"` to surface the localised FK message inline; on `ok: true` the dialog closes via `onSuccess`.

  `apps/web/src/app/(cap)/dashboard/parametres/_components/account-delete-confirm.tsx`:

  ```tsx
  "use client";

  import { useState, type CSSProperties } from "react";
  import { Text, View } from "@pekulo/ui/client";
  import { PekuloDialog, pekuloRadius } from "@pekulo/ui";
  import type { Account } from "@pekulo/validators";
  import { useDeleteAccount } from "../_hooks/use-delete-account";

  const FK_MESSAGE = "Ce compte est référencé par des positions — supprimez-les d'abord.";
  const NOT_FOUND_MESSAGE =
    "Ce compte est introuvable (déjà supprimé ?). Recharge la page.";

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

  export interface AccountDeleteConfirmProps {
    account: Account;
    open: boolean;
    onOpenChange: (next: boolean) => void;
  }

  export function AccountDeleteConfirm({ account, open, onOpenChange }: AccountDeleteConfirmProps) {
    const { mutate, isPending, error, reset } = useDeleteAccount();
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
        { id: account.id },
        {
          onSuccess: (result) => {
            if (result.ok) {
              onOpenChange(false);
              return;
            }
            // Envelope failure — surface the localised message inline.
            if (result.code === "ACCOUNT_REFERENCED_FK") {
              setEnvelopeError(FK_MESSAGE);
              return;
            }
            // ACCOUNT_NOT_FOUND
            setEnvelopeError(NOT_FOUND_MESSAGE);
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
              <PekuloDialog.Title>Supprimer « {account.label} » ?</PekuloDialog.Title>
              <PekuloDialog.Description>
                Cette action est irréversible. Le solde et l'historique du compte seront effacés.
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
                  {isPending ? "Suppression…" : "Supprimer"}
                </button>
                <PekuloDialog.Close asChild>
                  <View
                    render="button"
                    paddingVertical="$2"
                    cursor="pointer"
                    backgroundColor="transparent"
                    borderWidth={0}
                  >
                    <Text color="$colorTertiary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
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

  `apps/web/src/app/(cap)/dashboard/parametres/_components/account-delete-confirm.a11y.test.tsx`:

  ```tsx
  import { describe, expect, test, vi } from "vitest";
  import { render, screen, fireEvent, waitFor } from "@testing-library/react";
  import { axe, toHaveNoViolations } from "jest-axe";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { TamaguiProvider, pekuloTamaguiConfig } from "@pekulo/ui";

  expect.extend(toHaveNoViolations);

  const deleteMock = vi.fn();
  vi.mock("@/lib/actions/accounts-actions", () => ({
    deleteAccount: (input: { id: string }) => deleteMock(input),
  }));

  import { AccountDeleteConfirm } from "./account-delete-confirm";

  const acc = {
    id: "acc_aaaaaaaaaaaaaaaaaaaaa",
    userId: "00000000-0000-0000-0000-000000000001",
    label: "Livret A",
    type: "livret" as const,
    currency: "EUR" as const,
    cashBalance: 5_000,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function Wrap(props: { children: React.ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return (
      <TamaguiProvider config={pekuloTamaguiConfig}>
        <QueryClientProvider client={client}>{props.children}</QueryClientProvider>
      </TamaguiProvider>
    );
  }

  describe("AccountDeleteConfirm a11y + FK surfacing (AC-2)", () => {
    test("axe: no violations when open", async () => {
      const { container } = render(
        <Wrap>
          <AccountDeleteConfirm account={acc} open={true} onOpenChange={() => {}} />
        </Wrap>,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test("FK envelope → surfaces localised FK message in role=alert", async () => {
      deleteMock
        .mockReset()
        .mockResolvedValueOnce({ ok: false, code: "ACCOUNT_REFERENCED_FK", message: "fk" });
      render(
        <Wrap>
          <AccountDeleteConfirm account={acc} open={true} onOpenChange={() => {}} />
        </Wrap>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
      await waitFor(() =>
        expect(screen.getByRole("alert").textContent).toContain("référencé par des positions"),
      );
    });
  });
  ```

  Run: `bun --filter=web run test -- account-delete-confirm`. Expected: `Tests  2 passed`, exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/parametres/_components/account-delete-confirm.tsx apps/web/src/app/\(cap\)/dashboard/parametres/_components/account-delete-confirm.a11y.test.tsx && git commit -m "feat(#19): T11 — AccountDeleteConfirm with FK error surfacing"`. [AC: AC-2, AC-10]

- [x] **T12 — `accounts-section.tsx` + a11y test.** Lists accounts via `useAccounts`. Header with "+ Ajouter un compte" pill that opens an AccountCreateForm in a PekuloDialog. Per-row trailing action group: `Solde · Modifier · Supprimer` — each opens its own dialog with the relevant form. Handles `isLoading` (Skeleton via PekuloEmptyState-style placeholder), `error` (role=alert), and empty state.

  `apps/web/src/app/(cap)/dashboard/parametres/_components/accounts-section.tsx`:

  ```tsx
  "use client";

  import { useState, type CSSProperties } from "react";
  import { Text, View } from "@pekulo/ui/client";
  import { PekuloDialog, pekuloRadius } from "@pekulo/ui";
  import type { Account, AccountCurrency } from "@pekulo/validators";
  import type { AccountType } from "@pekulo/types";
  import { useAccounts } from "../_hooks/use-accounts";
  import { AccountCreateForm } from "./account-create-form";
  import { AccountEditForm } from "./account-edit-form";
  import { AccountBalanceForm } from "./account-balance-form";
  import { AccountDeleteConfirm } from "./account-delete-confirm";

  const TYPE_LABEL: Record<AccountType, string> = {
    livret: "Livret",
    pea: "PEA",
    cto: "CTO",
    av: "Assurance vie",
    autre: "Autre",
  };

  const eur0 = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  function formatBalance(amount: number, currency: AccountCurrency): string {
    if (currency === "EUR") return eur0.format(amount);
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  const addBtn: CSSProperties = {
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

  const rowActionBtn: CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--colorTertiary)",
    fontSize: 12,
    padding: "4px 8px",
  };

  const dangerRowActionBtn: CSSProperties = { ...rowActionBtn, color: "var(--danger)" };

  type DialogKind = "create" | "edit" | "balance" | "delete" | null;

  export function AccountsSection() {
    const { data, isLoading, error } = useAccounts();
    const [openDialog, setOpenDialog] = useState<DialogKind>(null);
    const [activeAccount, setActiveAccount] = useState<Account | null>(null);

    const closeAll = () => {
      setOpenDialog(null);
      setActiveAccount(null);
    };

    const openFor = (kind: Exclude<DialogKind, null | "create">, account: Account) => {
      setActiveAccount(account);
      setOpenDialog(kind);
    };

    return (
      <View
        flexDirection="column"
        gap="$3"
        padding="$4"
        backgroundColor="$backgroundCard"
        borderRadius="$xl"
      >
        <View flexDirection="row" alignItems="center" justifyContent="space-between">
          <Text color="$color" fontSize="$h3" fontWeight="600">
            Comptes
          </Text>
          <button
            type="button"
            onClick={() => setOpenDialog("create")}
            style={addBtn}
            aria-label="Ajouter un compte"
          >
            + Ajouter un compte
          </button>
        </View>

        {isLoading && (
          <Text color="$colorTertiary" fontSize="$caption" role="status">
            Chargement…
          </Text>
        )}
        {error && !isLoading && (
          <Text color="$danger" fontSize="$caption" role="alert">
            {error.message}
          </Text>
        )}
        {!isLoading && !error && data && data.length === 0 && (
          <Text color="$colorTertiary" fontSize="$caption">
            Aucun compte. Ajoute ton premier compte pour démarrer.
          </Text>
        )}

        {data && data.length > 0 && (
          <View
            flexDirection="column"
            role="list"
            aria-label="Liste des comptes"
          >
            {data.map((acc) => (
              <View
                key={acc.id}
                role="listitem"
                flexDirection="row"
                alignItems="center"
                justifyContent="space-between"
                paddingVertical="$3"
              >
                <View flex={1}>
                  <Text color="$color" fontSize="$bodySm" fontWeight="500">
                    {acc.label}
                  </Text>
                  <Text color="$colorTertiary" fontSize="$xs">
                    {TYPE_LABEL[acc.type]} · {acc.currency}
                  </Text>
                </View>
                <Text color="$color" fontSize="$bodySm" fontWeight="500">
                  {formatBalance(acc.cashBalance, acc.currency)}
                </Text>
                <View flexDirection="row" gap="$2" marginLeft="$3">
                  <button
                    type="button"
                    onClick={() => openFor("balance", acc)}
                    style={rowActionBtn}
                    aria-label={`Modifier le solde de ${acc.label}`}
                  >
                    Solde
                  </button>
                  <button
                    type="button"
                    onClick={() => openFor("edit", acc)}
                    style={rowActionBtn}
                    aria-label={`Modifier ${acc.label}`}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => openFor("delete", acc)}
                    style={dangerRowActionBtn}
                    aria-label={`Supprimer ${acc.label}`}
                  >
                    Supprimer
                  </button>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Create dialog (no active account needed) */}
        <PekuloDialog open={openDialog === "create"} onOpenChange={(o) => !o && closeAll()}>
          <PekuloDialog.Portal>
            <PekuloDialog.Overlay />
            <PekuloDialog.Content>
              <View flexDirection="column" gap="$3">
                <PekuloDialog.Title>Ajouter un compte</PekuloDialog.Title>
                <PekuloDialog.Description>
                  Renseigne le libellé, le type et le solde initial.
                </PekuloDialog.Description>
              </View>
              <AccountCreateForm onSuccess={closeAll} />
              <PekuloDialog.Close asChild>
                <View
                  render="button"
                  paddingVertical="$2"
                  cursor="pointer"
                  backgroundColor="transparent"
                  borderWidth={0}
                  alignItems="center"
                >
                  <Text color="$colorTertiary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
                    Annuler
                  </Text>
                </View>
              </PekuloDialog.Close>
            </PekuloDialog.Content>
          </PekuloDialog.Portal>
        </PekuloDialog>

        {/* Edit dialog */}
        {activeAccount && (
          <PekuloDialog open={openDialog === "edit"} onOpenChange={(o) => !o && closeAll()}>
            <PekuloDialog.Portal>
              <PekuloDialog.Overlay />
              <PekuloDialog.Content>
                <View flexDirection="column" gap="$3">
                  <PekuloDialog.Title>Modifier « {activeAccount.label} »</PekuloDialog.Title>
                </View>
                <AccountEditForm account={activeAccount} onSuccess={closeAll} />
                <PekuloDialog.Close asChild>
                  <View
                    render="button"
                    paddingVertical="$2"
                    cursor="pointer"
                    backgroundColor="transparent"
                    borderWidth={0}
                    alignItems="center"
                  >
                    <Text color="$colorTertiary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
                      Annuler
                    </Text>
                  </View>
                </PekuloDialog.Close>
              </PekuloDialog.Content>
            </PekuloDialog.Portal>
          </PekuloDialog>
        )}

        {/* Balance dialog */}
        {activeAccount && (
          <PekuloDialog open={openDialog === "balance"} onOpenChange={(o) => !o && closeAll()}>
            <PekuloDialog.Portal>
              <PekuloDialog.Overlay />
              <PekuloDialog.Content>
                <View flexDirection="column" gap="$3">
                  <PekuloDialog.Title>Modifier le solde — {activeAccount.label}</PekuloDialog.Title>
                  <PekuloDialog.Description>
                    Saisis la date et le nouveau solde — une entrée d'audit sera enregistrée.
                  </PekuloDialog.Description>
                </View>
                <AccountBalanceForm account={activeAccount} onSuccess={closeAll} />
                <PekuloDialog.Close asChild>
                  <View
                    render="button"
                    paddingVertical="$2"
                    cursor="pointer"
                    backgroundColor="transparent"
                    borderWidth={0}
                    alignItems="center"
                  >
                    <Text color="$colorTertiary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
                      Annuler
                    </Text>
                  </View>
                </PekuloDialog.Close>
              </PekuloDialog.Content>
            </PekuloDialog.Portal>
          </PekuloDialog>
        )}

        {/* Delete confirm */}
        {activeAccount && (
          <AccountDeleteConfirm
            account={activeAccount}
            open={openDialog === "delete"}
            onOpenChange={(o) => !o && closeAll()}
          />
        )}
      </View>
    );
  }
  ```

  `apps/web/src/app/(cap)/dashboard/parametres/_components/accounts-section.a11y.test.tsx`:

  ```tsx
  import { describe, expect, test, vi } from "vitest";
  import { render } from "@testing-library/react";
  import { axe, toHaveNoViolations } from "jest-axe";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { TamaguiProvider, pekuloTamaguiConfig } from "@pekulo/ui";
  import { accountsKeys } from "@/lib/zapaction/keys";

  expect.extend(toHaveNoViolations);

  vi.mock("@/lib/actions/accounts-actions", () => ({
    listAccounts: vi.fn(),
    createAccount: vi.fn(),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
    recordBalanceChange: vi.fn(),
  }));

  import { AccountsSection } from "./accounts-section";

  describe("AccountsSection a11y", () => {
    test("no axe violations with 2 accounts", async () => {
      const client = new QueryClient();
      client.setQueryData(accountsKeys.list(), [
        {
          id: "acc_aaaaaaaaaaaaaaaaaaaaa",
          userId: "00000000-0000-0000-0000-000000000001",
          label: "Livret A",
          type: "livret",
          currency: "EUR",
          cashBalance: 5_000,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "acc_bbbbbbbbbbbbbbbbbbbbb",
          userId: "00000000-0000-0000-0000-000000000001",
          label: "PEA Bourso",
          type: "pea",
          currency: "EUR",
          cashBalance: 45_200,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const { container } = render(
        <TamaguiProvider config={pekuloTamaguiConfig}>
          <QueryClientProvider client={client}>
            <AccountsSection />
          </QueryClientProvider>
        </TamaguiProvider>,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
  ```

  Run: `bun --filter=web run test -- accounts-section`. Expected: `Tests  1 passed`, exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/parametres/_components/accounts-section.tsx apps/web/src/app/\(cap\)/dashboard/parametres/_components/accounts-section.a11y.test.tsx && git commit -m "feat(#19): T12 — AccountsSection (list + per-row dialog actions)"`. [AC: AC-1, AC-3, AC-4, AC-10]

- [x] **T13 — Wire `<AccountsSection>` into `parametres/page.tsx`.** Add the import and render under the compass blocks. The page stays an async Server Component (compass fetch is async); AccountsSection is a Client Component so it adds a client boundary — no other change needed.

  Replace the body of `apps/web/src/app/(cap)/dashboard/parametres/page.tsx` with:

  ```tsx
  import { readCompass } from "@/lib/data/compass";
  import { CompassEditForm } from "./_components/compass-edit-form";
  import { CompassHistoryPanel } from "./_components/compass-history-panel";
  import { AccountsSection } from "./_components/accounts-section";

  export default async function ParametresPage() {
    const { compass } = await readCompass();
    return (
      <div style={{ display: "flex", padding: 16, alignItems: "center", flexDirection: "column" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 720,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <CompassEditForm initial={compass} />
          <CompassHistoryPanel />
          <AccountsSection />
        </div>
      </div>
    );
  }
  ```

  Run: `bun --filter=web run typecheck`. Expected: exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/parametres/page.tsx && git commit -m "feat(#19): T13 — wire AccountsSection into parametres page"`. [AC: AC-1, AC-3, AC-4]

- [x] **T14 — `patrimoine-view.tsx`.** New file `apps/web/src/app/(cap)/dashboard/_components/patrimoine-view.tsx`. Renders `PekuloHero` (variant `mobile`, label `Liquide`, `totalEur` = sum of cashBalance, `aheadEur` = 0 — delta arrives with story 7-1 dashboard orchestration), `PekuloAccountsSection` mapped from live accounts (drop `institution` — not in `Account` schema), then two `<PlaceholderCard>` cells for Composition (story 5-x) and Recent Activity (story 5-x) — same precedent as story 1-4's Cap view. **Tamagui-only layout per AC-9** (no CSS module).

  ```tsx
  "use client";

  // Patrimoine view — `?tab=patrimoine` on /dashboard.
  // Hero: total liquide (sum of cashBalance) — delta vs plan arrives with
  // story 7-1 (dashboard orchestration). AccountsSection: live-wired via
  // useAccounts. Composition + Recent activity: PlaceholderCard pending
  // stories 3-x / 5-x — mirrors how story 1-4 placeheld the Cap view's
  // trajectory/composition/activity cells.

  import { View } from "@pekulo/ui/client";
  import { PekuloHero, PekuloAccountsSection } from "@pekulo/ui";
  import type { AccountCardItem, AccountType } from "@pekulo/types";
  import type { Account } from "@pekulo/validators";
  import { useAccounts } from "../../parametres/_hooks/use-accounts";
  import { PlaceholderCard } from "./placeholder-card";

  function toCardItem(acc: Account): AccountCardItem {
    return {
      label: acc.label,
      type: acc.type as AccountType,
      // institution is intentionally omitted — not part of the live Account
      // schema (story 2-1). PekuloAccountRow handles the absence by
      // rendering the type label without the institution suffix.
      balanceEur: acc.cashBalance,
    };
  }

  export function PatrimoineView() {
    const { data, isLoading, error } = useAccounts();
    const accounts = data ?? [];
    const totalLiquide = accounts.reduce((sum, acc) => sum + acc.cashBalance, 0);
    const items = accounts.map(toCardItem);

    return (
      <View
        flexDirection="column"
        gap="$6"
        width="100%"
        maxWidth={920}
        marginHorizontal="auto"
      >
        <View
          padding="$5"
          backgroundColor="$backgroundCard"
          borderRadius="$xl"
        >
          <PekuloHero variant="mobile" totalEur={totalLiquide} aheadEur={0} label="Liquide" />
        </View>

        {isLoading && (
          <View padding="$4">
            <PlaceholderCard variant="composition" ownerStory="chargement comptes…" />
          </View>
        )}
        {error && !isLoading && (
          <View padding="$4">
            <PlaceholderCard variant="composition" ownerStory={`Erreur — ${error.message}`} />
          </View>
        )}
        {!isLoading && !error && (
          <PekuloAccountsSection accounts={items} />
        )}

        <PlaceholderCard variant="composition" ownerStory="5-x" />
        <PlaceholderCard variant="activity" ownerStory="5-x" />
      </View>
    );
  }
  ```

  Run: `bun --filter=web run typecheck`. Expected: exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/_components/patrimoine-view.tsx && git commit -m "feat(#19): T14 — PatrimoineView (live hero + accounts + placeholders)"`. [AC: AC-1, AC-5, AC-9]

- [x] **T15 — Extract `cap-view.tsx` from `page.tsx` and switch on `?tab`.** The current dashboard `page.tsx` is a single Cap view. Move that JSX into a new `cap-view.tsx` component, then have `page.tsx` switch on `useSearchParams().get("tab")`.

  **15a — Create `apps/web/src/app/(cap)/dashboard/_components/cap-view.tsx`** with the current page body verbatim:

  ```tsx
  "use client";

  // Cap view — `/dashboard` default. Extracted from page.tsx in story 2-3
  // to allow the page to switch between Cap and Patrimoine via `?tab`.
  // The body below is the verbatim page.tsx implementation prior to 2-3.

  import { AddMilestoneDialogProvider } from "./add-milestone-dialog";
  import { CompassSection, useCapDashboardState } from "./compass-section";
  import { MilestonesSection } from "./milestones-section";
  import { PlaceholderCard } from "./placeholder-card";
  import styles from "./bento.module.css";

  export function CapView() {
    const cap = useCapDashboardState();
    const horizonMax = cap?.horizonAbsoluteYearMax ?? new Date().getUTCFullYear() + 1;

    return (
      <AddMilestoneDialogProvider horizonAbsoluteYearMax={horizonMax}>
        <div className={styles.bento}>
          <div className={styles.heroCard}>
            <PlaceholderCard variant="hero" ownerStory="7-1" />
          </div>
          <div className={styles.donutCard}>
            <CompassSection />
          </div>
          <div className={styles.trajectoryCard}>
            <PlaceholderCard variant="trajectory" ownerStory="7-1" />
          </div>
          <div className={styles.milestonesCard}>
            {cap ? (
              <MilestonesSection
                currentWealth={cap.currentWealth}
                compassObjectif={cap.compassObjectif}
                compassHorizonYears={cap.compassHorizonYears}
              />
            ) : (
              <PlaceholderCard variant="hypothesis" ownerStory="story 1-4 (en attente du cap)" />
            )}
          </div>
          <div className={styles.compositionCard}>
            <PlaceholderCard variant="composition" ownerStory="5-x" />
          </div>
          <div className={styles.recentActivityCard}>
            <PlaceholderCard variant="activity" ownerStory="5-x" />
          </div>
          <div className={styles.hypothesisCard}>
            <PlaceholderCard variant="hypothesis" ownerStory="6-x" />
          </div>
        </div>
      </AddMilestoneDialogProvider>
    );
  }
  ```

  **15b — Replace `apps/web/src/app/(cap)/dashboard/page.tsx` body** with the search-param switch:

  ```tsx
  "use client";

  // apps/web/src/app/(cap)/dashboard/page.tsx
  // Top-tab switch — `?tab=patrimoine` renders <PatrimoineView/>, default
  // renders <CapView/>. The toggle UI lives in `cap-shell.tsx` (layout).
  // Story 2-3 introduced the split.

  import { useSearchParams } from "next/navigation";
  import { CapView } from "./_components/cap-view";
  import { PatrimoineView } from "./_components/patrimoine-view";

  export default function DashboardPage() {
    const params = useSearchParams();
    const tab = params.get("tab");
    if (tab === "patrimoine") return <PatrimoineView />;
    return <CapView />;
  }
  ```

  Run: `bun --filter=web run typecheck`. Expected: exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/_components/cap-view.tsx apps/web/src/app/\(cap\)/dashboard/page.tsx && git commit -m "feat(#19): T15 — split page into Cap/Patrimoine via ?tab"`. [AC: AC-5]

- [x] **T16 — Wire the Patrimoine top-tab in `cap-shell.tsx`.** Replace the toast call on the Patrimoine button with `router.push("/dashboard?tab=patrimoine")` and flip `aria-pressed` / `aria-current` based on the current `?tab`. The Cap tab navigates to `/dashboard` (no tab param).

  Edit `apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx`. Change the imports + button block.

  Replace the existing line `import { useRouter } from "next/navigation";` with:

  ```tsx
  import { useRouter, useSearchParams } from "next/navigation";
  ```

  Inside the `CapShell` function, immediately after `const router = useRouter();`, add:

  ```tsx
    const searchParams = useSearchParams();
    const activeTab = searchParams.get("tab") === "patrimoine" ? "patrimoine" : "cap";
  ```

  Then replace the entire `<div className={styles.headerLeft}>` block (currently two button JSX nodes — one for Cap, one for Patrimoine using `toast.info`) with:

  ```tsx
        <div className={styles.headerLeft}>
          <p className={styles.dateLabel} translate="no">
            {today}
          </p>
          <button
            type="button"
            className={`${styles.topTab} ${activeTab === "cap" ? styles.topTabActive : styles.topTabInactive}`}
            aria-pressed={activeTab === "cap"}
            aria-current={activeTab === "cap" ? "page" : undefined}
            onClick={() => router.push("/dashboard")}
          >
            Cap
          </button>
          <button
            type="button"
            className={`${styles.topTab} ${activeTab === "patrimoine" ? styles.topTabActive : styles.topTabInactive}`}
            aria-pressed={activeTab === "patrimoine"}
            aria-current={activeTab === "patrimoine" ? "page" : undefined}
            onClick={() => router.push("/dashboard?tab=patrimoine")}
          >
            Patrimoine
          </button>
        </div>
  ```

  The `toast` reference for Patrimoine is removed. `toast` is still used by the `handleNewTx` callback, so the `useToast()` import stays.

  Run: `bun --filter=web run typecheck`. Expected: exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/_components/cap-shell.tsx && git commit -m "feat(#19): T16 — wire Patrimoine top-tab to ?tab=patrimoine"`. [AC: AC-5]

- [x] **T17 — Remove brownfield account actions from `portfolio.ts` (NFR-28).** Delete the `accountRow` mapper, `getAccounts`, `saveAccount`, `deleteAccount` from `apps/web/src/lib/actions/portfolio.ts`. Leave holdings actions intact (those belong to story 3-1). Also drop the `accountSchema` import line — it becomes unused once the three account actions are gone (keep `holdingSchema`, `idSchema`, `updatePriceSchema`).

  Specifically, in `apps/web/src/lib/actions/portfolio.ts`:

  1. Edit the schema import line from:
     ```ts
     import { accountSchema, holdingSchema, idSchema, updatePriceSchema } from "@/lib/schemas/portfolio";
     ```
     to:
     ```ts
     import { holdingSchema, idSchema, updatePriceSchema } from "@/lib/schemas/portfolio";
     ```

  2. Edit the types import line from:
     ```ts
     import type {
       Account,
       AccountType,
       Currency,
       Holding,
       HoldingKind,
       RefreshSummary,
     } from "@/lib/types";
     ```
     to:
     ```ts
     import type { Currency, Holding, HoldingKind, RefreshSummary } from "@/lib/types";
     ```

  3. Delete the `accountRow` function (lines ~21-29 in current file — the const declaration + body).

  4. Delete `export const getAccounts = defineAction<void, Account[], ActionContext>({ ... });` (current lines ~52-64).

  5. Delete `export const saveAccount = defineAction<...>({ ... });` (current lines ~80-107).

  6. Delete `export const deleteAccount = defineAction<...>({ ... });` (current lines ~109-123).

  Verify no in-tree consumers remain:

  ```bash
  rg --no-heading -n "from \"@/lib/actions/portfolio\"" apps/web/src | rg "getAccounts|saveAccount|deleteAccount"
  ```

  Expected: empty output. The brownfield UI under `apps/web/src/components/portfolio-section.tsx` was removed during story 0-10 (pekulo-ui-migration), so nothing imports these any more. If matches appear, HALT — story 2-3 cannot land without rewriting those consumers.

  Run: `bun --filter=web run typecheck && bun --filter=web run lint`. Expected: both exit 0.
  Commit: `git add apps/web/src/lib/actions/portfolio.ts && git commit -m "feat(#19): T17 — remove brownfield account actions (NFR-28)"`. [AC: AC-6, AC-7]

- [x] **T18 — Final guards: typecheck, lint, full test suite, AC-6 grep.** Run the full battery against the web workspace to surface any cross-file regressions the per-task checks didn't catch.

  ```bash
  bun --filter=web run typecheck
  bun --filter=web run lint
  bun --filter=web run test
  rg --no-heading -n "from\(\"accounts\"\)" apps/web/src
  ```

  Expected:
  - `typecheck` exits 0 (no output).
  - `lint` exits 0 (no `pekulo/no-*` rule violations on the new files).
  - `test` exits 0 — all suites pass including the 4 new test files (`use-create-account.test.tsx`, `use-delete-account.test.tsx`, `account-create-form.a11y.test.tsx`, `account-delete-confirm.a11y.test.tsx`, `accounts-section.a11y.test.tsx`).
  - `rg` for AC-6 returns no matches.

  No file changes; no commit. If any check fails, HALT and triage before requesting review. [AC: AC-6, AC-7, AC-10]

## Dev Notes

### Architecture references

- **ADR-0009 (Elysia + oRPC + zapaction bridge):** apps/web calls oRPC procedures **through** server actions (`'use server'`). The action layer is the only place the typed `accountsClient` is invoked; UI components MUST NOT import the client directly. Forward enforcement via `pekulo/no-server-action-in-component`.
- **ADR-0010 (hard layering, lint-enforced):** Component → Hook → Server Action → oRPC client. Lint rules: `pekulo/no-server-action-in-component`, `pekulo/no-cross-feature-action-import`. The 5 hooks in T3–T7 are the *only* layer that imports the server actions; the 5 components in T8–T12 import the hooks.
- **Decimal coercion (L24 + ADR architecture L25):** apps/web does NOT see `Prisma.Decimal` — the API already coerces via `decimalToNumber()` at the row → DTO boundary (story 2-1). The wire format for `cashBalance` is a JS `number`. No coercion needed in the web tier; treat as plain number.
- **TR-strict palette feedback (memory `feedback_trade_republic_fidelity.md`):** Use `$color`, `$colorSecondary`, `$colorTertiary`, `$backgroundCard`, `$backgroundMuted`. `$danger` for destructive states. `$accent` (emerald) is reserved STRICTLY for monetary deltas — do NOT use it for confirmation states (use `$success` token where needed). Zero card borders.

### ADRs in scope

- `docs/adr/0009-elysia-orpc-with-zapaction-bridge.md`
- `docs/adr/0010-hooks-orchestration-boundary.md`
- `docs/adr/0011-packages-reorg-pekulo-namespace.md` (`@pekulo/types` re-exports)
- `docs/adr/0012-prisma-7-schema-folder-prefixed-ids.md` (account ids are `acc_<base62-21>` post-2-1)

### Lessons re-applied (verbatim from `docs/lessons.md`)

- **L (2026-05-13) — Pekulo Tamagui media keys ≠ Tailwind**: never mix Tamagui `$lg / $md` responsive props with a CSS module driven by Tailwind breakpoints in the same surface. **Applied:** `patrimoine-view.tsx` uses Tamagui-only layout (View + tokens). `cap-shell.tsx` and `bento.module.css` stay pre-existing mixed-mode surfaces; T16 only changes the button handlers, not the responsive layer.
- **L (2026-05-13) — Tamagui `styled(View, ...)` rejects text-style props**: in forms, all text-style is on `<Text>` and inputs/buttons use plain HTML elements with token-backed inline styles (the `form-primitives` already do this).
- **L1 (2026-05-09) — Zero `*.types.ts` files**: `DeleteAccountResult` is co-located in `accounts-actions.ts`; domain entities come from `@pekulo/validators` (Zod-inferred).
- **L25 (2026-05-04) — `AsyncLocalStorage.enterWith` correctness**: every action handler calls `ensureRequestContext()` before invoking the oRPC client — same defensive pattern as `compass-actions.ts` and `milestones-actions.ts`.
- **L (2026-05-07) — Tamagui in pure Server Components crashes Next.js build**: `parametres/page.tsx` stays async Server Component and renders `<AccountsSection>` as a Client Component (`"use client"` boundary lives in the section file). No Tamagui import in the page itself.
- **L (2026-05-06) — `@tamagui/popover|tooltip|select` triggers must `render="button"`**: `PekuloDialog.Close asChild` wraps a `View render="button"` (same pattern as `add-milestone-dialog.tsx`).

### Story 2-1 / 2-2 decisions re-applied

- **`Account.id` is `acc_<base62-21>` TEXT** (story 2-1 chose the migration path, not the brownfield-UUID null-prefix shortcut). The `accountIdSchema` regex enforces it.
- **`recordBalanceChange` mounts at `/rpc/v1/accounts/recordBalanceChange`** (story 2-2). The web `accountsClient.recordBalanceChange(...)` is already wired through the contract router barrel.
- **The `accounts` table holds the live `cash_balance`** — the audit log doesn't lag the parent. Reading `account.cashBalance` after `recordBalanceChange` returns the new value (story 2-2 atomic-write pattern).

### Step-0 quotes (verbatim current state at story-write time)

#### `apps/web/src/lib/zapaction/keys.ts` (current tail — lines 45-60)

```ts
export const portfolioKeys = createFeatureKeys("portfolio", {
  accounts: () => ["accounts"] as const,
  holdings: () => ["holdings"] as const,
  snapshot: () => ["snapshot"] as const,
});
export const portfolioTags = createFeatureTags("portfolio", {
  accounts: () => ["accounts"] as const,
  holdings: () => ["holdings"] as const,
  snapshot: () => ["snapshot"] as const,
});

export const lotsKeys = createFeatureKeys("lots", {
  byHolding: (holdingId: string) => ["holding", holdingId] as const,
});
export const lotsTags = createFeatureTags("lots", {
  byHolding: (holdingId: string) => ["holding", holdingId] as const,
});
```

This story APPENDS `accountsKeys` / `accountsTags` blocks and adds two entries inside the existing `setTagRegistry({ ... })` call. `portfolioKeys.accounts()` is left in place — it becomes orphaned after T17 removes the actions that tag with `portfolioTags.accounts()`, but the cleanup of the orphan belongs to story 3-1 (when holdings ports and `portfolioKeys` retires entirely).

#### `apps/web/src/lib/actions/portfolio.ts` (lines to delete — current 21-29, 52-64, 80-107, 109-123)

```ts
const accountRow = (row: Record<string, unknown>): Account => ({
  id: String(row.id),
  label: String(row.label),
  type: row.type as AccountType,
  currency: (row.currency as Currency) ?? "EUR",
  cashBalance: Number(row.cash_balance),
  notes: row.notes != null ? String(row.notes) : null,
  createdAt: String(row.created_at),
});
```

```ts
export const getAccounts = defineAction<void, Account[], ActionContext>({
  name: "getAccounts",
  input: z.void(),
  handler: async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("accounts")
      .select("*")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(accountRow);
  },
});
```

```ts
export const saveAccount = defineAction<z.infer<typeof accountSchema>, Account, ActionContext>({
  name: "saveAccount",
  input: accountSchema,
  tags: [portfolioTags.accounts()],
  handler: async ({ input, ctx }) => {
    const payload = {
      user_id: ctx.userId,
      label: input.label,
      type: input.type,
      currency: input.currency,
      cash_balance: input.cashBalance,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = input.id
      ? await ctx.supabase
          .from("accounts")
          .update(payload)
          .eq("id", input.id)
          .eq("user_id", ctx.userId)
          .select("*")
          .single()
      : await ctx.supabase.from("accounts").insert(payload).select("*").single();
    if (error) throw error;
    bumpPaths();
    return accountRow(data);
  },
});
```

```ts
export const deleteAccount = defineAction<z.infer<typeof idSchema>, { ok: true }, ActionContext>({
  name: "deleteAccount",
  input: idSchema,
  tags: [portfolioTags.accounts(), portfolioTags.holdings()],
  handler: async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from("accounts")
      .delete()
      .eq("id", input.id)
      .eq("user_id", ctx.userId);
    if (error) throw error;
    bumpPaths();
    return { ok: true as const };
  },
});
```

All four blocks are removed in T17. The import lines for `accountSchema`, `Account`, and `AccountType` are pruned in the same task.

#### `apps/web/src/app/(cap)/dashboard/page.tsx` (full current file)

```tsx
"use client";

import { AddMilestoneDialogProvider } from "./_components/add-milestone-dialog";
import { CompassSection, useCapDashboardState } from "./_components/compass-section";
import { MilestonesSection } from "./_components/milestones-section";
import { PlaceholderCard } from "./_components/placeholder-card";
import styles from "./_components/bento.module.css";

export default function DashboardPage() {
  const cap = useCapDashboardState();
  const horizonMax = cap?.horizonAbsoluteYearMax ?? new Date().getUTCFullYear() + 1;

  return (
    <AddMilestoneDialogProvider horizonAbsoluteYearMax={horizonMax}>
      <div className={styles.bento}>
        {/* ... Cap bento cells ... */}
      </div>
    </AddMilestoneDialogProvider>
  );
}
```

T15 moves this body verbatim into `cap-view.tsx` and replaces `page.tsx` with the `?tab` switch.

#### `apps/web/src/app/(cap)/dashboard/parametres/page.tsx` (full current file)

```tsx
import { readCompass } from "@/lib/data/compass";
import { CompassEditForm } from "./_components/compass-edit-form";
import { CompassHistoryPanel } from "./_components/compass-history-panel";

export default async function ParametresPage() {
  const { compass } = await readCompass();
  return (
    <div style={{ display: "flex", padding: 16, alignItems: "center", flexDirection: "column" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <CompassEditForm initial={compass} />
        <CompassHistoryPanel />
      </div>
    </div>
  );
}
```

T13 appends `<AccountsSection />` to the inner column.

#### `apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx` (relevant slice — lines 40-104, the handler + headerLeft block)

```tsx
  const handleNav = (key: PekuloNavKey) => {
    if (key === "cap") return;
    if (key === "settings") {
      router.push("/dashboard/parametres");
      return;
    }
    // ...
  };

  return (
    <div className={styles.shell}>
      <PekuloNavRail activeKey="cap" onSelect={handleNav} />
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.dateLabel} translate="no">
            {today}
          </p>
          <button
            type="button"
            className={`${styles.topTab} ${styles.topTabActive}`}
            aria-pressed={true}
            aria-current="page"
          >
            Cap
          </button>
          <button
            type="button"
            className={`${styles.topTab} ${styles.topTabInactive}`}
            aria-pressed={false}
            onClick={() => toast.info("Bientôt", "La vue Patrimoine arrive plus tard.")}
          >
            Patrimoine
          </button>
        </div>
        {/* ... */}
      </header>
    </div>
  );
```

T16 adds `useSearchParams` + `activeTab` derivation and replaces the `headerLeft` block so both top-tab buttons drive routing. Note: `PekuloNavRail activeKey="cap"` stays — that left-rail surface tracks the sidebar selection (Cap / Transactions / Mensuel / Portefeuille / Immobilier / Settings), not the top-tab toggle.

#### `packages/contracts/src/accounts.contract.ts` (full current file post-2-2)

```ts
export const accountsContractV1 = {
  create: oc.input(createAccountInputSchema).output(accountSchema),
  update: oc.input(updateAccountInputSchema).output(accountSchema),
  delete: oc.input(deleteAccountInputSchema).output(deleteAccountOutputSchema),
  list: oc.output(listAccountsOutputSchema),
  recordBalanceChange: oc
    .input(recordBalanceChangeInputSchema)
    .output(recordBalanceChangeOutputSchema),
} as const;
```

5 procedures — story 2-3 consumes all of them through `accountsClient.*`.

#### `apps/web/src/lib/orpc/modules.ts` (relevant slice — lines 47-50)

```ts
export const accountsClient: ContractRouterClient<typeof accountsContract> = createORPCClient(
  orpcLink,
  { path: ["accounts"] },
);
```

Already wired by story 2-1. `recordBalanceChange` arrived with story 2-2's contract addition.

## File List

### Created (15 new files)

- `apps/web/src/lib/actions/accounts-actions.ts`
- `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-accounts.ts`
- `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-create-account.ts`
- `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-create-account.test.tsx`
- `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-update-account.ts`
- `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-delete-account.ts`
- `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-delete-account.test.tsx`
- `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-record-balance-change.ts`
- `apps/web/src/app/(cap)/dashboard/parametres/_components/account-create-form.tsx`
- `apps/web/src/app/(cap)/dashboard/parametres/_components/account-create-form.a11y.test.tsx`
- `apps/web/src/app/(cap)/dashboard/parametres/_components/account-edit-form.tsx`
- `apps/web/src/app/(cap)/dashboard/parametres/_components/account-balance-form.tsx`
- `apps/web/src/app/(cap)/dashboard/parametres/_components/account-delete-confirm.tsx`
- `apps/web/src/app/(cap)/dashboard/parametres/_components/account-delete-confirm.a11y.test.tsx`
- `apps/web/src/app/(cap)/dashboard/parametres/_components/accounts-section.tsx`
- `apps/web/src/app/(cap)/dashboard/parametres/_components/accounts-section.a11y.test.tsx`
- `apps/web/src/app/(cap)/dashboard/_components/patrimoine-view.tsx`
- `apps/web/src/app/(cap)/dashboard/_components/cap-view.tsx`

### Modified (4 files)

- `apps/web/src/lib/zapaction/keys.ts` (append `accountsKeys`/`accountsTags` + registry entries)
- `apps/web/src/app/(cap)/dashboard/page.tsx` (replace body with `?tab` switch)
- `apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx` (Patrimoine tab routing)
- `apps/web/src/app/(cap)/dashboard/parametres/page.tsx` (mount `<AccountsSection/>`)
- `apps/web/src/lib/actions/portfolio.ts` (remove `accountRow`/`getAccounts`/`saveAccount`/`deleteAccount` — NFR-28)

## Dev Agent Record

- **Model:** claude-opus-4-7 (1M context)
- **Started:** 2026-05-16T18:00:00Z
- **Completed:** 2026-05-17T00:09:00Z

### Summary

Accounts UI ships end-to-end: 5 SA delegators (`accounts-actions.ts`) with the
FK-error envelope precedent, 5 React Query hooks (list/create/update/delete/
balance), 5 client components (forms + section + delete confirm), the
`?tab=patrimoine` split (cap-view / patrimoine-view), and the cap-shell top-tab
routing. NFR-28 closed — zero `from("accounts")` reads remain in `apps/web/src`.

### Files changed

- apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx
- apps/web/src/app/(cap)/dashboard/_components/cap-view.tsx
- apps/web/src/app/(cap)/dashboard/_components/patrimoine-view.tsx
- apps/web/src/app/(cap)/dashboard/page.tsx
- apps/web/src/app/(cap)/dashboard/parametres/_components/account-balance-form.tsx
- apps/web/src/app/(cap)/dashboard/parametres/_components/account-create-form.a11y.test.tsx
- apps/web/src/app/(cap)/dashboard/parametres/_components/account-create-form.tsx
- apps/web/src/app/(cap)/dashboard/parametres/_components/account-delete-confirm.a11y.test.tsx
- apps/web/src/app/(cap)/dashboard/parametres/_components/account-delete-confirm.tsx
- apps/web/src/app/(cap)/dashboard/parametres/_components/account-edit-form.tsx
- apps/web/src/app/(cap)/dashboard/parametres/_components/accounts-section.a11y.test.tsx
- apps/web/src/app/(cap)/dashboard/parametres/_components/accounts-section.tsx
- apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-accounts.ts
- apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-create-account.test.tsx
- apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-create-account.ts
- apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-delete-account.test.tsx
- apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-delete-account.ts
- apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-record-balance-change.ts
- apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-update-account.ts
- apps/web/src/app/(cap)/dashboard/parametres/page.tsx
- apps/web/src/lib/actions/accounts-actions.ts
- apps/web/src/lib/actions/portfolio.ts
- apps/web/src/lib/data/portfolio.ts
- apps/web/src/lib/zapaction/keys.ts

### Deviations

- **Test infrastructure adaptation (all 5 test files).** Story snippets used
  `jest-axe` + raw `<TamaguiProvider>`. Existing project tests use `vitest-axe`
  + `renderWithTamagui` helper at `apps/web/test/setup.tsx` (matchers already
  registered globally). Adapted every test to match the existing pattern per
  "Existing Patterns Are Law".
- **T14 import path bug in story spec.** Story specified
  `import { useAccounts } from "../../parametres/_hooks/use-accounts"` from
  `dashboard/_components/patrimoine-view.tsx`. `parametres/` is a child of
  `dashboard/`, not its sibling — corrected to `../parametres/_hooks/use-accounts`.
- **T17 follow-up commit.** AC-6 grep (`from("accounts")` in `apps/web/src`)
  surfaced a second offender in `apps/web/src/lib/data/portfolio.ts`
  (`readAccounts` + `readPortfolioSnapshot`, both unconsumed dead code from the
  brownfield pile). Story T17 only spec'd `actions/portfolio.ts`. Removed the
  dead reads in a follow-up commit; verified zero consumers via `rg readAccounts
  apps/web/src`. The NFR-28 contract is now fully closed.
- **AC-5 has no automated test.** The `?tab=patrimoine` top-tab routing is
  wired in `cap-shell.tsx` + `dashboard/page.tsx`, but the story specified no
  test for the navigation behavior. Manual / review-time verification only.
- **React Grab MCP unavailable.** Visual Dev Loop fallback applied — no
  `mcp__react-grab-mcp__get_element_context` checks at GREEN. Deferred to
  `aped-review` (Aria persona).
- **Pre-existing oxlint warning untouched.** `apps/api/src/modules/accounts/
  accounts.module.test.ts:297` reports a `noUnderscoreDangle` warning on
  `__seenBalanceLogRows` (story 2-2 origin). Not a `pekulo/*` rule, not on a
  file I edited — out of scope.

### Test output

```
bun --filter=web run test
 Test Files  17 passed (17)
      Tests  30 passed (30)
Exited with code 0
```

Including the 4 new test files: `use-create-account.test.tsx` (1),
`use-delete-account.test.tsx` (2), `account-create-form.a11y.test.tsx` (1),
`account-delete-confirm.a11y.test.tsx` (2), `accounts-section.a11y.test.tsx` (1).

Final guards: `bun --filter=web run typecheck` exit 0 · `bun run lint` exit 0
(1 pre-existing warning, no errors) · AC-6 grep
`rg 'from\("accounts"\)' apps/web/src` exit 1 (no matches).

### Post-completion polish — 2026-05-17 (user-driven visual fidelity)

After the initial Dev Agent Record landed at `76e50a2`, side-by-side visual
verification against `docs/ux-preview/src/App.tsx` via `next-browser` (headed
mode on viewports 390 / 768 / 1440) surfaced layout regressions the spec did
not anticipate. The user explicitly broadened story 2-3's scope to cover the
whole front (cap-shell + cap-view + patrimoine-view + mobile bottom nav)
rather than spin a follow-up story. Six additional commits landed on the
feature branch.

**Architectural pivot — accounts CRUD relocated**

- Story T13 had wired `<AccountsSection/>` into `parametres/page.tsx`. The
  user pushed back: ux-preview Settings (`SettingsScreen` at App.tsx:1730)
  has zero account CRUD — accounts management lives on the Patrimoine view
  per ux-preview's design intent. Pivoted: removed `<AccountsSection/>` from
  `parametres/page.tsx` (reverts to compass-only) and mounted it inside
  `patrimoine-view.tsx` instead. AC-1 / AC-3 / AC-4 verification surface
  shifts from `/dashboard/parametres` to `/dashboard?tab=patrimoine`.

**Visual fixes shipped (6 commits)**

1. `a83e500` — `PekuloMobileBottomNav` added to `@pekulo/ui` (5 icons,
   `lg:hidden` equivalent). Wired into `cap-shell.tsx`. Mirrors ux-preview
   App.tsx:180-202.
2. `ae42436` — pivot: drop accounts from `/paramètres`, mount in patrimoine
   view. Rewrite `accounts-section.tsx` as a flat section (no card wrapper).
   Rewrite `patrimoine-view.tsx` to use the same flat hero + flat
   AccountsSection pattern as ux-preview L359-377. `$lg`-gated max-w-3xl
   centering on desktop.
3. `b72bfa0` — fix Tamagui media keys. `$max-md` / `$gtSm` / `$gtMd` do NOT
   exist in `@tamagui/config/v5`; the actual keys are `$sm` (min-width:640),
   `$md` (min-width:768), `$lg` (min-width:1024), and `$max-sm` / `$max-md`
   / `$max-lg` for max-width. Pre-existing `PekuloNavRail` `$max-md` was a
   no-op — replaced with `$max-lg` so the rail correctly hides below 1024.
4. `f8ecd00` — mobile header trim: `dateLabel` + `newTxPill` hidden at
   `<1020 px` via `bento.module.css`. Kebab menu (`PekuloPopover` with
   `MoreHorizontal` icon) for account row actions on mobile/tablet; inline
   Solde·Modifier·Supprimer buttons on desktop only — via Tamagui `$lg`.
5. `89afd66` — replace `PlaceholderCard` (which wraps in `Section` =
   card) usage on `patrimoine-view.tsx` with inline flat
   `FlatListPlaceholder` for Composition + Activité. Avoids changing the DS
   primitive globally (Settings still wants cards from `Section`).
6. `018cabb` — fix `PekuloMobileBottomNav` truncation. Initial impl used
   `flex: 1` per button which rounded unevenly at 390 px and cut "Transactions"
   / "Portefeuille" labels. Switched to `display: grid;
   gridTemplateColumns: repeat(5, 1fr)` for true equal columns. Reduced font
   to 10 px with `letterSpacing: -0.1` for clean fit.
7. `e067a66` — Cap view mobile fidelity: added `flat?: boolean` to
   `Section` primitive (`packages/ui/src/primitives/Section.tsx`) +
   forwarded through `MilestonesSection`. Rewrote `cap-view.tsx` with
   dual mobile/desktop rendering: mobile branch (`$lg={{display:"none"}}`)
   renders 7 flat sections (Hero + MiniKpis + Trajectoire + Paliers flat +
   Hypothèse + Composition + Activité); desktop branch
   (`display:"none" $lg={{display:"block"}}`) keeps the existing bento.
   Mirrors ux-preview App.tsx:331-356 (`lg:hidden flex flex-col` /
   `hidden lg:grid`).

**Additional files changed (post-completion)**

- Created: `packages/ui/src/components/PekuloMobileBottomNav.tsx`
- Modified: `packages/ui/src/components/index.ts` (export barrel),
  `packages/ui/src/components/PekuloNavRail.tsx` (`$max-md` → `$max-lg`),
  `packages/ui/src/primitives/Section.tsx` (+ `flat` prop),
  `apps/web/src/app/(cap)/dashboard/_components/bento.module.css` (mobile
  header hide rules), `apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx`
  (mount mobile bottom nav), `apps/web/src/app/(cap)/dashboard/_components/cap-view.tsx`
  (dual rendering), `apps/web/src/app/(cap)/dashboard/_components/milestones-section.tsx`
  (+ `flat` prop), `apps/web/src/app/(cap)/dashboard/_components/patrimoine-view.tsx`
  (flat placeholders), `apps/web/src/app/(cap)/dashboard/parametres/page.tsx`
  (drop `<AccountsSection/>`), `apps/web/src/app/(cap)/dashboard/parametres/_components/accounts-section.tsx`
  (flat layout + kebab menu).

**Final visual state — 3 viewports verified via next-browser**

| Viewport | Patrimoine | Cap | Nav |
|---|---|---|---|
| 1440 desktop | Hero flat + Comptes flat with inline actions + flat Composition/Activité + max-w-3xl centred | 12-col bento (cards) | `PekuloNavRail` left |
| 768 tablet | Hero flat + Comptes flat with kebab + flat Composition/Activité | Flat single-column | `PekuloMobileBottomNav` |
| 390 mobile | Idem tablet | Idem tablet | Idem tablet |

**Tests:** still 17 files / 30 pass. Typecheck 0. Lint 0 (same pre-existing
warning as before).

**Lessons captured in `docs/lessons.md`** (6 new entries dated 2026-05-17 — see
file for full Mistake/Correction/Rule blocks): Tamagui v5 media keys; Section
`flat` prop pattern + dual mobile/desktop rendering; mobile bottom nav grid
layout; per-row CRUD kebab on mobile / inline on desktop; cross-check ux-preview
UX placement against story-spec; `flex:1 + minHeight:0 + overflowY:auto` requires
fixed-height parent — break in flat (natural-flow) parents.

**Final commit (post-Pass-2 visual review)**

8. `dda0f46` — fix: mobile/tablet Cap KPIs were rendering skeletons even
   after compass data resolved. Root cause: the mobile branch placeholders
   were not wired to `useDashboardCompass()`. Wired live data into the hero
   ("Aujourd'hui" + currentWealth + objectif/targetYear) and the 3 MiniKpis
   tiles (Cap pct + remaining + mini-donut · Horizon targetYear + yearsLeft ·
   Plan/an linear required). Also fixed `MilestonesSection`'s inner `<ul>`
   `flex:1 + minHeight:0 + overflowY:auto` which collapsed to 0 height when
   `flat={true}` (no fixed-height parent) — gated on `flat` so flat mode uses
   natural flow. Tablet/mobile cap now show identical data to desktop.
