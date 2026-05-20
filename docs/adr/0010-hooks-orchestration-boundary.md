# Component → Hook → Server Action — hard orchestration boundary

**Date:** 2026-05-03
**Status:** accepted
**Decided by:** Alex

## Context

Brownfield Pekulo had components free to import server actions directly. The Bonjour-proven pattern Alex is adopting introduces a hard boundary: components never consume server actions directly ; every action is wrapped in a custom hook that owns the UX orchestration (optimistic state, success/error toast, query invalidation, navigation, retry). This makes mutation flows uniformly testable and prevents UI components from tangling with side-effect plumbing.

## Decision

Three hook tiers, lint-enforced:

| Tier              | Convention               | Pekulo example                                                              |
| ----------------- | ------------------------ | --------------------------------------------------------------------------- |
| Query (read)      | `use<Feature><Resource>` | `useDashboardCompass`, `usePortfolioHoldings`, `useTransactionsPending`     |
| Mutation (write)  | `use<Verb><Resource>`    | `useUpdateCompass`, `useRecordValuation`, `useConfirmCategorisation`        |
| Form orchestrator | `use<Feature>Form`       | `useEditCompassForm`, `useAddMilestoneForm`, `useImportTransactionsCsvForm` |

Form orchestrators wrap **TanStack Form's `useForm` together with the corresponding mutation hook** (`use<Verb><Resource>`) and expose a unified API to the component: `{ form, send, isSubmitting, … }`. Components consume only the orchestrator — never `useForm` directly, never the mutation hook directly when both are needed in the same form.

Layering (hard):

```
Component (.tsx)
  └─ uses → Custom Hook (use<Verb><Resource> or use<Feature>Form)
              └─ uses → Server Action (<feature>-actions.ts, 'use server')
                          └─ uses → oRPC client → Elysia handler
```

Local (route-scoped) vs Global (cross-route) split:

| Family         | Local                                                    | Global                                                        |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| Hooks          | `apps/web/src/app/<route>/_hooks/`                       | `apps/web/src/lib/hooks/`                                     |
| Components     | `apps/web/src/app/<route>/_components/`                  | `apps/web/src/components/` (top-level, **NOT** inside `lib/`) |
| Server Actions | `apps/web/src/app/<route>/_actions/<feature>-actions.ts` | `apps/web/src/lib/actions/<feature>-actions.ts`               |

A custom oxlint rule in `@pekulo/oxlint-config` (`no-server-action-in-component`) fails the build on any `<feature>-actions.ts` import inside a `.tsx` file under `_components/` or `components/`.

## Why

- **Testability** — mutation orchestration is unit-testable in isolation ; components stay presentation-focused with mocked hook returns.
- **Consistency** — every mutation flow has the same shape ; reviewers know exactly where optimistic state, toasts, invalidation, and retry live.
- **Refactor safety** — a server action's signature change blast radius stops at the hook ; components never need to update.
- **Alignment with proven Bonjour pattern** — Alex carries forward the orchestration discipline that worked on the prior project.

## Considered options

- **Components import server actions directly** — rejected: tangles UX orchestration with rendering, makes optimistic state ad-hoc, and bypasses the centralised toast/retry policy.
- **Hooks layer optional** — rejected: optionality erodes the convention ; one PR with a direct import normalises bypass.

## Consequences

- **Every mutation requires a hook** — no shortcut path for "just a quick action". Even one-line mutations get a one-line hook.
- **Form components depend exclusively on `use<Feature>Form`** — components never see TanStack Form internals. Documentation and onboarding emphasise this.
- **Lint rule maintenance** — the `no-server-action-in-component` oxlint rule lives in `@pekulo/oxlint-config` ; edge cases (e.g. logout from a Server Component) handled via explicit-allow comments.
- **Local vs global tier discipline** — promoting a local hook to global requires renaming the import path ; tracked at code-review time.

## Amendments

### 2026-05-20 — PR #86 (archi-deadcode audit)

Three refinements ratified in `architecture.md` Phase 3 (Audit-derived conventions). The original ADR established the Component → Hook → Server Action layering but was silent on the React-Query consumption shape inside the hook — sub-agents reading the ADR assumed the hook layer could call raw `useQuery` / `useMutation` from `@tanstack/react-query` as long as the action layer used `defineAction`. PR #86 (ZAP-1 finding) caught 18 hooks doing exactly that ; codifying explicitly :

- **R3** — ZapAction is the ONLY allowed React-Query consumer in `apps/web/src/app/**/_hooks/`. Hooks MUST consume actions via `useActionQuery` (reads, `readPolicy: "read-only"`) / `useActionMutation` (writes, `invalidateOnSuccess: true`) from `@zapaction/query`, or `useAction` from `@zapaction/react` for imperative flows. Direct `useQuery` / `useMutation` imports from `@tanstack/react-query` are BANNED in hooks ; review fail. The only legitimate `@tanstack/react-query` import outside a hook is the `QueryClient` + `QueryClientProvider` boot in `apps/web/src/components/providers.tsx`.
- **R4** — Tag registry centralises invalidation ; hooks NEVER invalidate manually. Cross-feature invalidation maps live in `apps/web/src/lib/zapaction/keys.ts` via `setTagRegistry({...})`. Manual `queryClient.invalidateQueries({ queryKey })` in a hook body bypasses the registry and is a review fail.
- **R9** — Optimistic mutation recipe with ZapAction. `useQueryClient` from `@tanstack/react-query` is allowed ONLY inside `onMutate` / `onError` / `onSettled` of `useActionMutation` for the documented optimistic-update recipe (snapshot → optimistic apply → rollback on error → trust tag registry for success). Envelope `{ ok: false, code, message }` returns are DATA, not errors ; the tag registry still invalidates on the false-ok path (acceptable no-op refetch).

Codified in PR #86 commits 2c293ca + 0f5013c (Pekulo bumped to `@zapaction/*@0.2.3` to pick up the upstream `TError = Error` default fix, see yabafre/zapaction#2 → v0.2.3).

See `docs/architecture.md` Phase 3 — Audit-derived conventions (2026-05-20 — PR #86) for the canonical statement.
