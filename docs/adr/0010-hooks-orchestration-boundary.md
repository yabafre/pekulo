# Component → Hook → Server Action — hard orchestration boundary

**Date:** 2026-05-03
**Status:** accepted
**Decided by:** Alex

## Context

Brownfield Pekulo had components free to import server actions directly. The Bonjour-proven pattern Alex is adopting introduces a hard boundary: components never consume server actions directly ; every action is wrapped in a custom hook that owns the UX orchestration (optimistic state, success/error toast, query invalidation, navigation, retry). This makes mutation flows uniformly testable and prevents UI components from tangling with side-effect plumbing.

## Decision

Three hook tiers, lint-enforced:

| Tier | Convention | Pekulo example |
|---|---|---|
| Query (read) | `use<Feature><Resource>` | `useDashboardCompass`, `usePortfolioHoldings`, `useTransactionsPending` |
| Mutation (write) | `use<Verb><Resource>` | `useUpdateCompass`, `useRecordValuation`, `useConfirmCategorisation` |
| Form orchestrator | `use<Feature>Form` | `useEditCompassForm`, `useAddMilestoneForm`, `useImportTransactionsCsvForm` |

Form orchestrators wrap **TanStack Form's `useForm` together with the corresponding mutation hook** (`use<Verb><Resource>`) and expose a unified API to the component: `{ form, send, isSubmitting, … }`. Components consume only the orchestrator — never `useForm` directly, never the mutation hook directly when both are needed in the same form.

Layering (hard):

```
Component (.tsx)
  └─ uses → Custom Hook (use<Verb><Resource> or use<Feature>Form)
              └─ uses → Server Action (<feature>-actions.ts, 'use server')
                          └─ uses → oRPC client → Elysia handler
```

Local (route-scoped) vs Global (cross-route) split:

| Family | Local | Global |
|---|---|---|
| Hooks | `apps/web/src/app/<route>/_hooks/` | `apps/web/src/lib/hooks/` |
| Components | `apps/web/src/app/<route>/_components/` | `apps/web/src/components/` (top-level, **NOT** inside `lib/`) |
| Server Actions | `apps/web/src/app/<route>/_actions/<feature>-actions.ts` | `apps/web/src/lib/actions/<feature>-actions.ts` |

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
